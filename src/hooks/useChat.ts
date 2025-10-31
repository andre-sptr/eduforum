import { useEffect, useRef } from "react";
import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ChatMessage = { id: string; room_id: string; sender_id: string; content: string; created_at: string };

type PageResult = { rows: ChatMessage[]; nextOffset: number | null };

async function fetchMessagesPage(roomId: string, offset: number, pageSize: number): Promise<PageResult> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true })
    .range(offset, offset + pageSize - 1);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as ChatMessage[];
  const nextOffset = rows.length < pageSize ? null : offset + pageSize;
  return { rows, nextOffset };
}

export function useChat(roomId: string, userId: string | null | undefined, pageSize = 50) {
  const qc = useQueryClient();
  const subscribedRef = useRef(false);

  const query = useInfiniteQuery<PageResult, Error, InfiniteData<PageResult>, [string, string, { pageSize: number }], number>({
    queryKey: ["chatMessages", roomId, { pageSize }],
    enabled: !!roomId,
    initialPageParam: 0,
    getNextPageParam: (lastPage: PageResult) => lastPage.nextOffset,
    queryFn: async ({ pageParam }) => fetchMessagesPage(roomId, pageParam as number, pageSize),
    staleTime: 15000,
    gcTime: 300000,
  });

  const messages = (query.data?.pages ?? []).flatMap((p) => p.rows);

  useEffect(() => {
    if (!roomId || subscribedRef.current) return;
    subscribedRef.current = true;
    const channel = supabase
      .channel(`chat_room_${roomId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `room_id=eq.${roomId}` }, (payload) => {
        const incoming = payload.new as ChatMessage;
        qc.setQueriesData({ queryKey: ["chatMessages", roomId], exact: false }, (old: InfiniteData<PageResult> | undefined) => {
          if (!old?.pages) return old;
          const exists = old.pages.some((pg) => pg.rows.some((m) => m.id === incoming.id));
          if (exists) return old;
          const lastIdx = old.pages.length - 1;
          const newPages = old.pages.slice();
          newPages[lastIdx] = { ...newPages[lastIdx], rows: [...newPages[lastIdx].rows, incoming] };
          return { ...old, pages: newPages, pageParams: old.pageParams };
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
        if (!old?.pages) return old as any;
        const lastIdx = old.pages.length - 1;
        const newPages = old.pages.slice();
        newPages[lastIdx] = { ...newPages[lastIdx], rows: [...newPages[lastIdx].rows, temp] };
        return { ...old, pages: newPages };
      });
      return { prev, tempId: temp.id };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["chatMessages", roomId, { pageSize }], ctx.prev);
    },
    onSuccess: (serverMsg, _v, ctx) => {
      qc.setQueryData<InfiniteData<PageResult>>(["chatMessages", roomId, { pageSize }], (old) => {
        if (!old?.pages) return old as any;
        const newPages = old.pages.map((pg) => ({
          ...pg,
          rows: pg.rows.map((m) => (m.id === ctx?.tempId ? serverMsg : m)),
        }));
        return { ...old, pages: newPages };
      });
    },
  });

  return {
    ...query,
    messages,
    sendMessage,
  };
}