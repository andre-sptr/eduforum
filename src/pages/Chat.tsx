import { useEffect, useRef, useState, useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Send, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { z } from "zod";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MentionInput } from "@/components/MentionInput";
import { RankBadge } from "@/components/RankBadge";
import { ContentRenderer } from "@/components/ContentRenderer";

import { useLeaderboardData } from "@/hooks/useLeaderboardData";

const messageSchema = z.object({ content: z.string().trim().min(1,"Message cannot be empty").max(2000,"Message is too long (max 2000 characters)") });

interface Message { id:string; user_id:string; content:string; created_at:string; edited_at?:string|null; is_deleted?:boolean; profiles?:{ full_name:string; avatar_url:string|null; role:string } }

const GROUP_WINDOW_MS = 5 * 60 * 1000;

const Chat = () => {
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const [messages,setMessages]=useState<Message[]>([]);
  const [newMessage,setNewMessage]=useState("");
  const [currentUser,setCurrentUser]=useState<any>(null);
  const [conversation,setConversation]=useState<any>(null);
  const [loading,setLoading]=useState(true);
  const [sending,setSending]=useState(false);
  const [editingMessageId,setEditingMessageId]=useState<string|null>(null);
  const [editContent,setEditContent]=useState("");
  const [groupMembers,setGroupMembers]=useState<string[]>([]);
  const { topFollowers, topLiked } = useLeaderboardData();
  const cardRef=useRef<HTMLDivElement|null>(null);
  const bottomRef=useRef<HTMLDivElement|null>(null);
  const unsubscribeRef=useRef<null|(()=>void)>(null);
  const atBottomRef=useRef(true);
  const pendingSmoothRef=useRef(false);

  const followerRankMap = useMemo(() =>
    new Map(topFollowers.slice(0, 3).map((u, i) => [u.id, i + 1]))
  , [topFollowers]);

  const likerRankMap = useMemo(() =>
    new Map(topLiked.slice(0, 3).map((u, i) => [u.id, i + 1]))
  , [topLiked]);

  useEffect(()=>{ checkUser(); return()=>{ unsubscribeRef.current?.(); }; },[conversationId]);
  useEffect(()=>{ attachScrollListener(); return detachScrollListener; },[cardRef.current]);
  useEffect(()=>{
    const scroll = () => bottomRef.current?.scrollIntoView({ behavior: pendingSmoothRef.current ? "smooth" : "auto", block:"end" });
    if (atBottomRef.current || pendingSmoothRef.current) requestAnimationFrame(scroll);
    pendingSmoothRef.current = false;
  },[messages]);

  const getViewport = () => (cardRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLDivElement | null);
  const onViewportScroll = () => {
    const v=getViewport(); if(!v) return;
    const threshold=32;
    atBottomRef.current = v.scrollTop + v.clientHeight >= v.scrollHeight - threshold;
  };
  const attachScrollListener = () => { const v=getViewport(); if(!v) return; v.addEventListener("scroll", onViewportScroll, { passive:true }); onViewportScroll(); };
  const detachScrollListener = () => { const v=getViewport(); if(!v) return; v.removeEventListener("scroll", onViewportScroll); };

  const checkUser=async()=> {
    const { data:{ user } }=await supabase.auth.getUser(); if(!user){ navigate("/auth"); return; }
    setCurrentUser(user);
    const { data: conv } = await supabase.from("conversations").select("*").eq("id", conversationId).single();
    if (!conv) { toast.error("Percakapan tidak ditemukan"); navigate("/messages"); return; }
    setConversation(conv);
    if (conv.type === "group" && conv.group_id) {
      const { data: members } = await supabase.from("group_members").select("user_id").eq("group_id", conv.group_id);
      if (members) setGroupMembers(members.map(m => m.user_id));
    }
    if (conv.type === "global") {
      const { data: exist } = await supabase.from("conversation_participants").select("*").eq("conversation_id", conversationId).eq("user_id", user.id).single();
      if (!exist) await supabase.from("conversation_participants").insert({ conversation_id: conversationId, user_id: user.id });
    }
    await loadMessages();
    unsubscribeRef.current = setupRealtimeSubscription();
    setLoading(false);
  };

  const loadMessages=async()=> {
    const { data:rows,error }=await supabase.from("messages").select("*").eq("conversation_id",conversationId).order("created_at",{ascending:true}).limit(100);
    if(error){ toast.error(error.message); return; }
    if(!rows?.length){ setMessages([]); return; }
    const ids=[...new Set(rows.map(m=>m.user_id))];
    const { data:profiles }=await supabase.from("profiles").select("id,full_name,avatar_url,role").in("id",ids);
    const pmap=new Map((profiles||[]).map(p=>[p.id,p]));
    setMessages(rows.map(m=>({ ...m, profiles:pmap.get(m.user_id)||{ full_name:"Unknown User", avatar_url:null, role:"siswa" } })));
  };

  const setupRealtimeSubscription=()=> {
    const ch=supabase
      .channel(`messages-${conversationId}`)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"messages",filter:`conversation_id=eq.${conversationId}`},async (payload:any)=>{
        const { data:msg }=await supabase.from("messages").select("*").eq("id",payload.new.id).single(); if(!msg) return;
        const { data:p }=await supabase.from("profiles").select("id,full_name,avatar_url,role").eq("id",msg.user_id).single();
        const isMine = msg.user_id === currentUser?.id;
        if (isMine) pendingSmoothRef.current = true;
        setMessages(prev=>[...prev,{ ...msg, profiles:p||{ full_name:"Unknown User", avatar_url:null, role:"siswa" } }]);
      })
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"messages",filter:`conversation_id=eq.${conversationId}`},(payload:any)=>{
        setMessages(prev=>prev.map(m=>m.id===payload.new.id?{ ...m, content:payload.new.content, edited_at:payload.new.edited_at, is_deleted:payload.new.is_deleted }:m));
      })
      .on("postgres_changes",{event:"DELETE",schema:"public",table:"messages",filter:`conversation_id=eq.${conversationId}`},(payload:any)=>{
        setMessages(prev=>prev.filter(m=>m.id!==payload.old.id));
      })
      .subscribe();
    return ()=>{ supabase.removeChannel(ch); };
  };

  const handleSendMessage=async(e:React.FormEvent)=> {
    e.preventDefault();
    try{ messageSchema.parse({content:newMessage}); }catch(err:any){ if(err instanceof z.ZodError) toast.error(err.errors[0].message); return; }
    setSending(true);
    try{
      const { error }=await supabase.from("messages").insert({ conversation_id:conversationId, user_id:currentUser.id, content:newMessage.trim() });
      if(error) throw error;
      setNewMessage("");
      pendingSmoothRef.current = true;
    }catch(err:any){ toast.error(err.message); } finally{ setSending(false); }
  };

  const getInitials=(n:string)=>{ const a=n.split(" "); return a.length>=2?(a[0][0]+a[1][0]).toUpperCase():n.slice(0,2).toUpperCase(); };
  const handleEditMessage=async(id:string)=>{ if(!editContent.trim()) return toast.error("Pesan tidak boleh kosong");
    try{ messageSchema.parse({content:editContent}); }catch(err:any){ if(err instanceof z.ZodError){ toast.error(err.errors[0].message); return; } }
    try{ const { error }=await supabase.from("messages").update({ content:editContent.trim(), edited_at:new Date().toISOString() }).eq("id",id); if(error) throw error; setEditingMessageId(null); setEditContent(""); toast.success("Pesan berhasil diubah"); }
    catch(err:any){ toast.error("Gagal mengubah pesan: "+err.message); }
  };
  const handleDeleteMessage=async(id:string)=>{ try{ const { error }=await supabase.from("messages").delete().eq("id",id); if(error) throw error; toast.success("Pesan berhasil dihapus"); }catch(err:any){ toast.error("Gagal menghapus pesan: "+err.message); } };
  const startEdit=(m:Message)=>{ setEditingMessageId(m.id); setEditContent(m.content); };
  const cancelEdit=()=>{ setEditingMessageId(null); setEditContent(""); };
  const formatTime=(ts:string)=>new Date(ts).toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"});

  const isGrouped = (prev?: Message, curr?: Message) => {
    if (!prev || !curr) return false;
    if (prev.user_id !== curr.user_id) return false;
    const dt = new Date(curr.created_at).getTime() - new Date(prev.created_at).getTime();
    return dt >= 0 && dt <= GROUP_WINDOW_MS;
  };

  if(loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center"><div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-primary"/><p className="mt-4 text-muted-foreground animate-pulse">Memuat chat...</p></div>
    </div>
  );

  return (
    <div className="space-y-4 h-[calc(100vh-120px)] pb-10">
      <header className="border-b border-white/10 bg-card/40 backdrop-blur-xl rounded-t-3xl shadow-sm z-20 sticky top-0">
        <div className="flex items-center gap-4 px-6 py-4">
          <Button variant="ghost" size="icon" onClick={()=>navigate("/messages")} className="rounded-xl hover:bg-white/10 transition-colors"><ArrowLeft className="h-5 w-5"/></Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">{conversation?.name||"Chat"}</h1>
            <p className="text-xs font-medium text-muted-foreground/80 flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${conversation?.type==="global"?"bg-blue-500":conversation?.type==="group"?"bg-emerald-500":"bg-pink-500"}`} />
              {conversation?.type==="global"&&"Chat Global"}
              {conversation?.type==="group"&&"Grup Chat"}
              {conversation?.type==="direct"&&"Chat Pribadi"}
            </p>
          </div>
        </div>
      </header>

      <Card ref={cardRef} className="flex-1 border-white/10 bg-card/30 backdrop-blur-md shadow-2xl overflow-hidden flex flex-col h-full rounded-b-3xl rounded-t-none mt-0 relative">
          {}
          <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />
          
          <ScrollArea className="flex-1 p-6">
            <div className="space-y-4 max-w-4xl mx-auto">
              {messages.length===0?(
                <div className="py-20 text-center flex flex-col items-center justify-center opacity-60">
                    <div className="w-16 h-16 bg-muted/30 rounded-full flex items-center justify-center mb-4">
                        <Send className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground font-medium">Belum ada pesan. Mulai percakapan!</p>
                </div>
              ):messages.map((m, idx)=>{
                const mine=m.user_id===currentUser?.id;
                const editing=editingMessageId===m.id;
                const prev=messages[idx-1];
                const grouped=isGrouped(prev,m);
                return (
                  <div key={m.id} className={`flex ${mine?"flex-row-reverse":"flex-row"} ${grouped?"mt-1":"mt-4"} gap-4 group/msg animate-in slide-in-from-bottom-2 duration-500`}>
                    {grouped ? (
                      <div className="h-10 w-10 opacity-0 pointer-events-none" />
                    ) : (
                      <Link to={`/profile/${m.user_id}`} className="transition-transform hover:scale-110">
                        <Avatar className="h-10 w-10 ring-2 ring-white/10 shadow-md">
                          <AvatarImage src={m.profiles?.avatar_url||undefined} className="object-cover"/>
                          <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60 text-primary-foreground font-bold text-xs">{getInitials(m.profiles?.full_name||"U")}</AvatarFallback>
                        </Avatar>
                      </Link>
                    )}

                    <div className={`max-w-[75%] ${mine?"items-end text-right":"items-start"} flex flex-col`}>
                      {!grouped && (
                        <div className={`mb-1.5 flex items-center flex-wrap gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                          <Link to={`/profile/${m.user_id}`} className="text-sm font-bold hover:text-primary transition-colors">{m.profiles?.full_name}</Link>
                          <RankBadge rank={followerRankMap.get(m.user_id)} type="follower" />
                          <RankBadge rank={likerRankMap.get(m.user_id)} type="like" />
                        </div>
                      )}

                      {editing?(
                        <div className={`flex ${mine?"flex-row-reverse":""} items-center gap-2 w-full`}>
                          <Input value={editContent} onChange={e=>setEditContent(e.target.value)} className="h-10 bg-background/50 backdrop-blur-sm border-white/10 rounded-xl" autoFocus onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); handleEditMessage(m.id); } if(e.key==="Escape") cancelEdit(); }}/>
                          <Button size="sm" onClick={()=>handleEditMessage(m.id)} className="rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 shadow-md">Simpan</Button>
                          <Button size="sm" variant="ghost" onClick={cancelEdit} className="rounded-lg hover:bg-white/10">Batal</Button>
                        </div>
                      ):(
                        <div className={`group relative inline-flex flex-col rounded-2xl px-5 py-3 shadow-sm border border-white/5 transition-all ${mine?"bg-primary text-primary-foreground rounded-tr-sm":"bg-muted/40 backdrop-blur-md text-foreground rounded-tl-sm hover:bg-muted/50"}`}>
                          <ContentRenderer content={m.content} className={`text-[15px] whitespace-pre-wrap break-words leading-relaxed ${mine ? "text-primary-foreground/95" : "text-foreground/90"}`} />
                          
                          <div className={`flex items-center gap-2 mt-1 ${mine ? "justify-end text-primary-foreground/70" : "text-muted-foreground/70"}`}>
                             <span className="text-[10px] font-medium">{formatTime(m.created_at)}</span>
                             {m.edited_at&&<span className="text-[10px] italic opacity-80 flex items-center gap-0.5"><Pencil className="h-2 w-2"/> diedit</span>}
                          </div>

                          {mine&&(
                            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <DropdownMenu>
                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6 rounded-full hover:bg-black/10 text-current"><MoreVertical className="h-3 w-3"/></Button></DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-card/95 backdrop-blur-xl border-white/10">
                                    <DropdownMenuItem onClick={()=>startEdit(m)} className="cursor-pointer"><Pencil className="mr-2 h-3.5 w-3.5"/>Edit</DropdownMenuItem>
                                    <DropdownMenuItem onClick={()=>handleDeleteMessage(m.id)} className="text-destructive cursor-pointer focus:bg-destructive/10"><Trash2 className="mr-2 h-3.5 w-3.5"/>Hapus</DropdownMenuItem>
                                </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef}/>
            </div>
          </ScrollArea>

          <form onSubmit={handleSendMessage} className="border-t border-white/10 p-4 bg-card/40 backdrop-blur-xl">
            <div className="flex gap-3 max-w-4xl mx-auto items-end">
              {conversation?.type==="direct"?(
                <Input value={newMessage} onChange={e=>setNewMessage(e.target.value)} placeholder="Ketik pesan..." className="flex-1 rounded-2xl bg-white/5 border-white/10 focus:bg-white/10 transition-all h-12 px-4 shadow-inner" disabled={sending}
                  onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); handleSendMessage(e as any); } }}/>
              ):(
                <MentionInput value={newMessage} onChange={setNewMessage} placeholder="Ketik pesan (@user)..." className="flex-1 rounded-2xl bg-white/5 border-white/10 focus:bg-white/10 transition-all min-h-[48px] px-4 py-3 shadow-inner resize-none" disabled={sending}
                  currentUserId={currentUser?.id} allowedUserIds={conversation?.type==="group"?groupMembers:undefined}
                  onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); handleSendMessage(e as any); } }}/>
              )}
              <Button type="submit" size="icon" disabled={sending||!newMessage.trim()} className="rounded-2xl h-12 w-12 bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 hover:scale-105 transition-all flex-shrink-0"><Send className="h-5 w-5 ml-0.5"/></Button>
            </div>
          </form>
      </Card>
    </div>
  );
};

export default Chat;