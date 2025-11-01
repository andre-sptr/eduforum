import { useEffect, useMemo, useRef } from "react";
import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ChatMessage = {
  id: string; room_id: string; sender_id: string; content: string; created_at: string;
  profiles?: { name: string; avatar_text: string; role: string } | null;
};
type Page = { rows: ChatMessage[]; nextCursor: string | null };
const MAX_CACHED_PAGES = 10;

async function fetchPage(roomId: string, cursor: string | null, pageSize: number): Promise<Page> {
  let q = supabase.from("chat_messages").select("*").eq("room_id", roomId).order("created_at", { ascending: false }).limit(pageSize);
  if (cursor) q = q.lt("created_at", cursor);
  const { data, error } = await q; if (error) throw error;
  const desc = (data ?? []) as ChatMessage[];
  return { rows: [...desc].reverse(), nextCursor: desc.length < pageSize ? null : desc[desc.length - 1]?.created_at ?? null };
}

export function useChat(roomId: string, userId: string | null | undefined, pageSize = 50) {
  const qc = useQueryClient(), subscribed = useRef(false);
  const KEY = ["chatMessages", roomId, pageSize] as const;

  const query = useInfiniteQuery<Page, Error>({
    queryKey: KEY, enabled: !!roomId, initialPageParam: null,
    getNextPageParam: l => l.nextCursor,
    queryFn: ({ pageParam }) => fetchPage(roomId, (pageParam as string) ?? null, pageSize),
    staleTime: 15_000, gcTime: 300_000,
  });

  const messages = useMemo(() => {
    const seen = new Set<string>();
    return (query.data?.pages ?? []).flatMap(p => p.rows).filter(m => (seen.has(m.id) ? false : (seen.add(m.id), true)));
  }, [query.data]);

  useEffect(() => {
    if (!roomId || subscribed.current) return;
    subscribed.current = true;

    const upsertInsert = (incoming: ChatMessage) => qc.setQueryData<InfiniteData<Page>>(KEY, old => {
      if (!old?.pages) return old;
      if (old.pages.some(pg => pg.rows.some(m => m.id === incoming.id))) return old;
      const pages = old.pages.map(pg => ({ ...pg, rows: [...pg.rows] })), params = [...old.pageParams], i = pages.length - 1;
      if (i < 0) return { pages: [{ rows: [incoming], nextCursor: null }], pageParams: [null] };
      if (pages[i].rows.length >= pageSize) { pages.push({ rows: [incoming], nextCursor: pages[i].nextCursor }); params.push(pages[i].nextCursor ?? null); }
      else pages[i].rows.push(incoming);
      while (pages.length > MAX_CACHED_PAGES) { pages.shift(); params.shift(); }
      return { pages, pageParams: params };
    });

    const applyUpdate = (updated: ChatMessage) => qc.setQueryData<InfiniteData<Page>>(KEY, old => {
      if (!old?.pages) return old;
      const pages = old.pages.map(pg => ({ ...pg, rows: pg.rows.map(m => m.id === updated.id ? { ...m, ...updated } : m) }));
      return { ...old, pages };
    });

    const applyDelete = (id: string) => qc.setQueryData<InfiniteData<Page>>(KEY, old => {
      if (!old?.pages) return old;
      const pages = old.pages.map(pg => ({ ...pg, rows: pg.rows.filter(m => m.id !== id) }));
      return { ...old, pages };
    });

    const ch = supabase
      .channel(`chat_room_${roomId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `room_id=eq.${roomId}` }, p => upsertInsert(p.new as ChatMessage))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_messages", filter: `room_id=eq.${roomId}` }, p => applyUpdate(p.new as ChatMessage))
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "chat_messages", filter: `room_id=eq.${roomId}` }, p => applyDelete((p.old as ChatMessage).id))
      .subscribe();

    return () => { supabase.removeChannel(ch); subscribed.current = false; };
  }, [roomId, qc, pageSize]);

  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      if (!userId || !roomId) throw new Error("User atau Room ID tidak valid");
      const { data, error } = await supabase.from("chat_messages").insert({ room_id: roomId, sender_id: userId, content }).select("*").single();
      if (error) throw error; return data as ChatMessage;
    },
    onMutate: async content => {
      await qc.cancelQueries({ queryKey: KEY });
      const prev = qc.getQueryData<InfiniteData<Page>>(KEY);
      const temp: ChatMessage = { id: "optimistic-" + Date.now(), room_id: roomId, sender_id: userId as string, content, created_at: new Date().toISOString(), profiles: null };
      qc.setQueryData<InfiniteData<Page>>(KEY, old => {
        if (!old?.pages) return { pages: [{ rows: [temp], nextCursor: null }], pageParams: [null] };
        const pages = old.pages.map(pg => ({ ...pg, rows: [...pg.rows] })), params = [...old.pageParams], i = pages.length - 1;
        if (pages[i].rows.length >= pageSize) { pages.push({ rows: [temp], nextCursor: pages[i].nextCursor }); params.push(pages[i].nextCursor ?? null); }
        else pages[i].rows.push(temp);
        while (pages.length > MAX_CACHED_PAGES) { pages.shift(); params.shift(); }
        return { ...old, pages, pageParams: params };
      });
      return { prev, tempId: temp.id };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(KEY, ctx.prev); },
    onSuccess: (serverMsg, _v, ctx) => qc.setQueryData<InfiniteData<Page>>(KEY, old => {
      if (!old?.pages) return old as any;
      const pages = old.pages.map(pg => ({ ...pg, rows: pg.rows.map(m => (m.id === ctx?.tempId ? serverMsg : m)) }));
      return { ...old, pages };
    }),
  });

  return { ...query, messages, sendMessage };
}