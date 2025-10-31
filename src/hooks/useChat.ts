import { useEffect, useMemo, useRef } from "react";
import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ChatMessage = { id: string; room_id: string; sender_id: string; content: string; created_at: string };

type PageResult = { rows: ChatMessage[]; nextCursor: string | null };

async function fetchMessagesPage(roomId: string, cursor: string | null, pageSize: number): Promise<PageResult> {
  let query = supabase
    .from("chat_messages")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(pageSize);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rowsDesc = (data ?? []) as ChatMessage[];
  const rows = rowsDesc.slice().reverse();
  const nextCursor = rowsDesc.length < pageSize ? null : rowsDesc[rowsDesc.length - 1]?.created_at ?? null;
  return { rows, nextCursor };
}

const MAX_CACHED_PAGES = 10;

export function useChat(roomId: string, userId: string | null | undefined, pageSize = 50) {
  const qc = useQueryClient();
  const subscribedRef = useRef(false);

  const query = useInfiniteQuery<PageResult, Error, InfiniteData<PageResult>, [string, string, { pageSize: number }], string | null>({
    queryKey: ["chatMessages", roomId, { pageSize }],
    enabled: !!roomId,
    initialPageParam: null,
    getNextPageParam: (lastPage: PageResult) => lastPage.nextCursor,
    queryFn: async ({ pageParam }) => fetchMessagesPage(roomId, pageParam as string | null, pageSize),
    staleTime: 15000,
    gcTime: 300000,
  });

  const messages = useMemo(() => (query.data?.pages ?? []).flatMap((p) => p.rows), [query.data]);

  useEffect(() => {
    if (!roomId || subscribedRef.current) return;
    subscribedRef.current = true;
    const channel = supabase
      .channel(`chat_room_${roomId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `room_id=eq.${roomId}` }, (payload) => {
        const incoming = payload.new as ChatMessage;
        qc.setQueriesData({ queryKey: ["chatMessages", roomId], exact: false }, (old: InfiniteData<PageResult> | undefined) => {
          if (!old?.pages) return old;
          if (old.pages.some((pg) => pg.rows.some((m) => m.id === incoming.id))) return old;
          const pages = old.pages.map((pg) => ({ ...pg, rows: [...pg.rows] }));
          const pageParams = [...old.pageParams];
          if (pages.length === 0) {
            return {
              pages: [{ rows: [incoming], nextCursor: null }],
              pageParams: [null],
            } as InfiniteData<PageResult>;
          }
          const lastIndex = pages.length - 1;
          const lastPage = pages[lastIndex];
          if (lastPage.rows.length >= pageSize) {
            pages.push({ rows: [incoming], nextCursor: lastPage.nextCursor });
            pageParams.push(lastPage.nextCursor ?? null);
          } else {
            pages[lastIndex] = { ...lastPage, rows: [...lastPage.rows, incoming] };
          }
          while (pages.length > MAX_CACHED_PAGES) {
            pages.shift();
            pageParams.shift();
          }
          return { pages, pageParams };
        });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
      subscribedRef.current = false;
    };
  }, [roomId, qc]);

  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      if (!userId || !roomId) throw new Error("User atau Room ID tidak valid");
      const { data, error } = await supabase
        .from("chat_messages")
        .insert({ room_id: roomId, sender_id: userId, content })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return data as ChatMessage;
    },
    onMutate: async (content) => {
      await qc.cancelQueries({ queryKey: ["chatMessages", roomId] });
      const prev = qc.getQueryData<InfiniteData<PageResult>>(["chatMessages", roomId, { pageSize }]);
      const temp: ChatMessage = {
        id: "optimistic-" + Date.now(),
        room_id: roomId,
        sender_id: userId as string,
        content,
        created_at: new Date().toISOString(),
      };
      qc.setQueryData<InfiniteData<PageResult>>(["chatMessages", roomId, { pageSize }], (old) => {
        if (!old?.pages) {
          return {
            pages: [{ rows: [temp], nextCursor: null }],
            pageParams: [null],
          } as InfiniteData<PageResult>;
        }
        const pages = old.pages.map((pg) => ({ ...pg, rows: [...pg.rows] }));
        const pageParams = [...old.pageParams];
        const lastIndex = pages.length - 1;
        const lastPage = pages[lastIndex];
        if (lastPage.rows.length >= pageSize) {
          pages.push({ rows: [temp], nextCursor: lastPage.nextCursor });
          pageParams.push(lastPage.nextCursor ?? null);
        } else {
          pages[lastIndex] = { ...lastPage, rows: [...lastPage.rows, temp] };
        }
        while (pages.length > MAX_CACHED_PAGES) {
          pages.shift();
          pageParams.shift();
        }
        return { ...old, pages, pageParams };
      });
      return { prev, tempId: temp.id };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["chatMessages", roomId, { pageSize }], ctx.prev);
    },
    onSuccess: (serverMsg, _v, ctx) => {
      qc.setQueryData<InfiniteData<PageResult>>(["chatMessages", roomId, { pageSize }], (old) => {
        if (!old?.pages) return old as any;
        const pages = old.pages.map((pg) => ({
          ...pg,
          rows: pg.rows.map((m) => (m.id === ctx?.tempId ? serverMsg : m)),
        }));
        return { ...old, pages };
      });
    },
  });

  return {
    ...query,
    messages,
    sendMessage,
  };
}