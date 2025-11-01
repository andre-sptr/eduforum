import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useChat } from "@/hooks/useChat";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { InfiniteScrollTrigger } from "@/components/InfiniteScrollTrigger";
import { ArrowLeft, ChevronDown, MoreHorizontal, Send } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";

type ChatPartner = { id: string; name: string; avatar_text: string; username: string; role: string };
const pad = (n: number) => `${n}`.padStart(2, "0");
const fmtTime = (t?: string | null) => { if (!t) return ""; const d = new Date(t); if (Number.isNaN(d.getTime())) return "—"; const now = new Date(), y = new Date(now); y.setDate(now.getDate() - 1); const hhmm = `${pad(d.getHours())}:${pad(d.getMinutes())}`; return d.toDateString() === now.toDateString() ? hhmm : d.toDateString() === y.toDateString() ? `Kemarin, ${hhmm}` : `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; };
const sameDay = (a: string, b: string) => new Date(a).toDateString() === new Date(b).toDateString();
const dayLabel = (t: string) => { const d = new Date(t), now = new Date(), y = new Date(now); y.setDate(now.getDate() - 1); return d.toDateString() === now.toDateString() ? "Hari ini" : d.toDateString() === y.toDateString() ? "Kemarin" : d.toLocaleDateString(); };

export default function ChatPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { user, loading: authLoading } = useAuth();
  const [text, setText] = useState(""), [showDown, setShowDown] = useState(false), [editingId, setEditingId] = useState<string | null>(null), [editText, setEditText] = useState(""), [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null), bottomRef = useRef<HTMLDivElement>(null), didFirstScroll = useRef(false);
  const qc = useQueryClient();
  const getVP = () => scrollRef.current?.querySelector<HTMLDivElement>('[data-radix-scroll-area-viewport]');

  const { messages, isLoading: loadingMsg, sendMessage: sendMut, hasNextPage, fetchNextPage, isFetchingNextPage } = useChat(roomId ?? "", user?.id);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    let tries = 0;
    const attempt = () => {
      const vp = getVP(), anchor = bottomRef.current;
      if (vp && anchor) { anchor.scrollIntoView({ behavior: behavior === "smooth" ? "smooth" : "auto", block: "end" }); return; }
      if (++tries <= 10) setTimeout(attempt, 32);
    };
    requestAnimationFrame(attempt);
  };

  useEffect(() => { didFirstScroll.current = false; }, [roomId]);

  useLayoutEffect(() => {
    if (!didFirstScroll.current && !loadingMsg && messages.length) { didFirstScroll.current = true; scrollToBottom("instant"); }
  }, [loadingMsg, messages.length]);

  useEffect(() => {
    const vp = getVP(); if (!vp) return;
    const onScroll = () => setShowDown(vp.scrollHeight - (vp.scrollTop + vp.clientHeight) > 200);
    vp.addEventListener("scroll", onScroll, { passive: true });
    return () => vp.removeEventListener("scroll", onScroll);
  }, [roomId]);

  const { data: partner, isLoading: loadingPartner } = useQuery<ChatPartner | null>({
    queryKey: ["chatPartner", roomId, user?.id],
    enabled: !!user && !!roomId,
    queryFn: async () => {
      if (!user || !roomId) return null;
      const { data: p1, error: e1 } = await supabase.from("chat_participants").select("user_id").eq("room_id", roomId).neq("user_id", user.id).limit(1).maybeSingle();
      if (e1) throw e1; if (!p1?.user_id) return null;
      const { data: p2, error: e2 } = await supabase.from("profiles").select("id,name,avatar_text,username,role").eq("id", p1.user_id).maybeSingle();
      if (e2) throw e2; return p2 ?? null;
    },
  });

  const onSend = (e: React.FormEvent) => { e.preventDefault(); const v = text.trim(); if (!v) return; sendMut.mutate(v, { onSuccess: () => requestAnimationFrame(() => scrollToBottom("smooth")) }); setText(""); };

  const updateMut = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => { const { error } = await supabase.from("chat_messages").update({ content }).eq("id", id); if (error) throw error; return { id, content }; },
    onMutate: async ({ id, content }) => { const key = ["chatMessages", roomId, 50] as const; await qc.cancelQueries({ queryKey: key }); const prev = qc.getQueryData<any>(key); qc.setQueryData<any>(key, (old: any) => !old?.pages ? old : ({ ...old, pages: old.pages.map((pg: any) => ({ ...pg, rows: pg.rows.map((m: any) => m.id === id ? { ...m, content } : m) })) })); return { prev }; },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(["chatMessages", roomId, 50], ctx.prev); toast.error("Gagal mengedit pesan."); },
    onSuccess: () => toast.success("Pesan diperbarui."),
    onSettled: () => qc.invalidateQueries({ queryKey: ["chatMessages", roomId] }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("chat_messages").delete().eq("id", id); if (error) throw error; return id; },
    onMutate: async (id) => { const key = ["chatMessages", roomId, 50] as const; await qc.cancelQueries({ queryKey: key }); const prev = qc.getQueryData<any>(key); qc.setQueryData<any>(key, (old: any) => !old?.pages ? old : ({ ...old, pages: old.pages.map((pg: any) => ({ ...pg, rows: pg.rows.filter((m: any) => m.id !== id) })) })); return { prev }; },
    onError: (_e, _id, ctx) => { if (ctx?.prev) qc.setQueryData(["chatMessages", roomId, 50], ctx.prev); toast.error("Gagal menghapus pesan."); },
    onSuccess: () => toast.success("Pesan dihapus."),
    onSettled: () => qc.invalidateQueries({ queryKey: ["chatMessages", roomId] }),
  });

  const items = useMemo(() => {
    const out: Array<{ type: "day" | "msg"; id: string; label?: string; i?: number }> = [];
    messages.forEach((m, i) => { if (i === 0 || !sameDay(m.created_at, messages[i - 1].created_at)) out.push({ type: "day", id: `d-${i}`, label: dayLabel(m.created_at) }); out.push({ type: "msg", id: m.id, i }); });
    return out;
  }, [messages]);

  if (!roomId) return <div className="p-6 text-center">Room ID tidak ditemukan.</div>;
  if (authLoading || loadingPartner) return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center gap-3 p-4 border-b"><Skeleton className="h-10 w-10 rounded-full" /><Skeleton className="h-6 w-32" /></div>
      <div className="flex-1 p-4 space-y-4"><Skeleton className="h-10 w-3/4" /><Skeleton className="h-10 w-1/2 ml-auto" /><Skeleton className="h-10 w-2/3" /></div>
      <div className="p-4 border-t"><Skeleton className="h-10 w-full" /></div>
    </div>
  );
  if (!partner) return <div className="p-6 text-center">Error: chat partner tidak ditemukan / room tidak valid.</div>;

  return (
    <div className="flex h-screen w-full items-center justify-center bg-[radial-gradient(1200px_500px_at_10%_-10%,theme(colors.primary/15),transparent_45%),radial-gradient(900px_600px_at_110%_10%,theme(colors.accent/15),transparent_35%)] p-4">
      <div className="relative flex flex-col h-[calc(100vh-2rem)] max-h-[860px] w-full max-w-[580px] overflow-hidden rounded-3xl border bg-card/70 backdrop-blur-xl shadow-[0_10px_60px_-15px_rgba(0,0,0,0.35)] ring-1 ring-border">
        <header className="flex items-center gap-2 p-3 pl-2 border-b bg-gradient-to-r from-background/60 to-background/20">
          <Button asChild variant="ghost" size="icon" className="rounded-full hover:bg-muted/60"><Link to="/"><ArrowLeft className="h-5 w-5" /></Link></Button>
          <Link to={`/profile/u/${encodeURIComponent(partner.username)}`} className="flex items-center gap-3 group">
            <div className="relative">
              <Avatar className="h-10 w-10 ring-2 ring-primary/20 group-hover:ring-primary/40 transition"><AvatarFallback className="bg-primary text-primary-foreground">{partner.avatar_text || "?"}</AvatarFallback></Avatar>
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-background" />
            </div>
            <div className="leading-tight"><h2 className="font-semibold">{partner.name}</h2><p className="text-xs text-muted-foreground">{partner.role}</p></div>
          </Link>
        </header>

        <ScrollArea key={roomId} className="flex-1 bg-gradient-to-b from-muted/20 to-transparent" ref={scrollRef}>
          <div className="p-4 space-y-2">
            <InfiniteScrollTrigger onLoadMore={fetchNextPage} disabled={!hasNextPage || isFetchingNextPage} />
            {isFetchingNextPage && <p className="text-xs text-center text-muted-foreground py-2">Memuat pesan lama…</p>}
            {loadingMsg && !isFetchingNextPage && <p className="text-xs text-center text-muted-foreground pt-10">Memuat pesan…</p>}

            {items.map(it => it.type === "day" ? (
              <div key={it.id} className="sticky top-2 z-10 mx-auto w-fit rounded-full border bg-background/70 px-3 py-0.5 text-[10px] text-muted-foreground backdrop-blur">{it.label}</div>
            ) : (() => {
              const i = it.i!, m = messages[i], me = m.sender_id === user?.id, prev = messages[i - 1], samePrev = prev && sameDay(prev.created_at, m.created_at) && prev.sender_id === m.sender_id;
              const startEdit = () => { setEditingId(m.id); setEditText(m.content); };
              const saveEdit = () => { const v = editText.trim(); if (!v) return toast.info("Pesan kosong."); updateMut.mutate({ id: m.id, content: v }, { onSuccess: () => setEditingId(null) }); };
              return (
                <div key={`${m.id}-${i}`} className={`group/message flex items-end gap-2 ${me ? "justify-end" : "justify-start"} ${samePrev ? "mt-1" : "mt-3"}`}>
                  {!me && <Avatar className={`h-6 w-6 ${samePrev ? "invisible" : "visible"}`}><AvatarFallback className="text-[10px] bg-primary text-primary-foreground">{partner.avatar_text || "?"}</AvatarFallback></Avatar>}
                  <div className={`relative max-w-[75%] rounded-2xl px-3 pt-1.5 pb-1 text-sm shadow-md ${me ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-background/80 backdrop-blur border rounded-bl-sm"}`}>
                    {editingId === m.id ? (
                      <div className="space-y-2">
                        <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={2} className="bg-background/80 text-foreground" />
                        <div className={`flex gap-2 ${me ? "justify-end" : "justify-start"}`}><Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>Batal</Button><Button size="sm" onClick={saveEdit} disabled={updateMut.isPending}>{updateMut.isPending ? "Menyimpan..." : "Simpan"}</Button></div>
                      </div>
                    ) : (<><p className="whitespace-pre-wrap break-words">{m.content}</p><p className={`text-[10px] mt-1 opacity-65 ${me ? "text-right" : "text-left"}`}>{fmtTime(m.created_at)}</p></>)}
                    {me && editingId !== m.id && (
                      <div className="absolute -top-2 -right-2 opacity-0 group-hover/message:opacity-100 transition">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button size="icon" variant="secondary" className="h-6 w-6 rounded-full shadow"><MoreHorizontal className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-32">
                            <DropdownMenuItem onClick={startEdit}>Edit</DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600" onClick={() => setConfirmDeleteId(m.id)}>Hapus</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </div>
                </div>
              );
            })())}
            <div ref={bottomRef} />
          </div>
          <ScrollBar orientation="vertical" />
        </ScrollArea>

        {showDown && (
          <Button onClick={() => scrollToBottom("smooth")} className="absolute bottom-20 right-4 rounded-full shadow-lg bg-card border hover:bg-card/90" variant="outline" size="icon" aria-label="Scroll ke bawah">
            <ChevronDown className="h-5 w-5" />
          </Button>
        )}

        <footer className="p-3 border-t bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <form onSubmit={onSend} className="flex items-center gap-2">
            <Input value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" placeholder="Ketik pesan…" className="flex-1 rounded-full border-muted-foreground/20 bg-background/60 focus-visible:ring-1 focus-visible:ring-primary/40" />
            <Button type="submit" size="icon" className="rounded-full shadow hover:shadow-lg transition" disabled={sendMut.isPending || !text.trim()} aria-label="Kirim pesan"><Send className="h-4 w-4" /></Button>
          </form>
          <p className="mt-1 text-[10px] text-muted-foreground text-center">Tekan Enter untuk kirim</p>
        </footer>
      </div>

      <AlertDialog open={!!confirmDeleteId} onOpenChange={(o) => !o && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Hapus pesan ini?</AlertDialogTitle></AlertDialogHeader>
          <p className="text-sm text-muted-foreground">Tindakan ini tidak dapat dibatalkan.</p>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirmDeleteId) deleteMut.mutate(confirmDeleteId); setConfirmDeleteId(null); }} className="bg-red-600 hover:bg-red-600/90">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}