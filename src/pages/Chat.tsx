import { useEffect, useRef, useState } from "react";
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

const messageSchema = z.object({ content: z.string().trim().min(1,"Message cannot be empty").max(2000,"Message is too long (max 2000 characters)") });

interface Message { id:string; user_id:string; content:string; created_at:string; edited_at?:string|null; is_deleted?:boolean; profiles?:{ full_name:string; avatar_url:string|null; role:string } }

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
  const cardRef=useRef<HTMLDivElement|null>(null);
  const bottomRef=useRef<HTMLDivElement|null>(null);
  const unsubscribeRef=useRef<null|(()=>void)>(null);
  const atBottomRef=useRef(true);
  const pendingSmoothRef=useRef(false);

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
    const { data:conv }=await supabase.from("conversations").select("*").eq("id",conversationId).single();
    if(!conv){ toast.error("Percakapan tidak ditemukan"); navigate("/messages"); return; }
    setConversation(conv);
    if(conv.type==="group"&&conv.group_id){ const { data:members }=await supabase.from("group_members").select("user_id").eq("group_id",conv.group_id); if(members) setGroupMembers(members.map(m=>m.user_id)); }
    if(conv.type==="global"){ const { data:exist }=await supabase.from("conversation_participants").select("*").eq("conversation_id",conversationId).eq("user_id",user.id).single(); if(!exist) await supabase.from("conversation_participants").insert({conversation_id:conversationId,user_id:user.id}); }
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

  if(loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center"><div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-accent"/><p className="mt-4 text-muted-foreground">Memuat chat...</p></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 bg-card/90 backdrop-blur border-b border-border">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={()=>navigate("/messages")} className="rounded-xl"><ArrowLeft className="h-5 w-5"/></Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">{conversation?.name||"Chat"}</h1>
            <p className="text-xs text-muted-foreground">
              {conversation?.type==="global"&&"Chat Global"}
              {conversation?.type==="group"&&"Grup Chat"}
              {conversation?.type==="direct"&&"Chat Pribadi"}
            </p>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-4xl flex-1 flex">
        <Card ref={cardRef} className="flex-1 border-border bg-card shadow-sm overflow-hidden flex flex-col">
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.length===0?(
                <div className="py-10 text-center text-muted-foreground">Belum ada pesan. Mulai percakapan!</div>
              ):messages.map(m=>{
                const mine=m.user_id===currentUser?.id; const editing=editingMessageId===m.id;
                return (
                  <div key={m.id} className={`flex gap-3 ${mine?"flex-row-reverse":"flex-row"}`}>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={m.profiles?.avatar_url||undefined}/>
                      <AvatarFallback className="bg-primary text-primary-foreground font-semibold">{getInitials(m.profiles?.full_name||"U")}</AvatarFallback>
                    </Avatar>
                    <div className={`max-w-[72%] ${mine?"items-end text-right":"items-start"} flex flex-col`}>
                      <div className={`mb-1 flex items-baseline gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                        <Link to={`/profile/${m.user_id}`}className="text-sm font-medium hover:text-accent">{m.profiles?.full_name}</Link>
                      </div>
                      {editing?(
                        <div className={`flex ${mine?"flex-row-reverse":""} items-center gap-2`}>
                          <Input value={editContent} onChange={e=>setEditContent(e.target.value)} className="h-9" autoFocus onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); handleEditMessage(m.id); } if(e.key==="Escape") cancelEdit(); }}/>
                          <Button size="sm" onClick={()=>handleEditMessage(m.id)}>Simpan</Button>
                          <Button size="sm" variant="ghost" onClick={cancelEdit}>Batal</Button>
                        </div>
                      ):(
                        <div className={`group relative inline-flex rounded-2xl px-4 py-2 ${mine?"bg-primary text-primary-foreground":"bg-muted text-foreground"}`}>
                          <p className="text-sm whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{ __html:m.content.replace(/@\[([^\]]+)\]\([a-f0-9\-]+\)/g,'<span class="text-primary font-semibold">@$1</span>') }}/>
                          {m.edited_at&&<span className={`ml-2 self-end text-[10px] opacity-70 italic ${mine?"text-primary-foreground/70":"text-muted-foreground"}`}>diedit</span>}
                          {mine&&(
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="ml-1 h-6 w-6 opacity-0 group-hover:opacity-100"><MoreVertical className="h-4 w-4"/></Button></DropdownMenuTrigger>
                              <DropdownMenuContent align={mine?"start":"end"}>
                                <DropdownMenuItem onClick={()=>startEdit(m)}><Pencil className="mr-2 h-4 w-4"/>Edit</DropdownMenuItem>
                                <DropdownMenuItem onClick={()=>handleDeleteMessage(m.id)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4"/>Hapus</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      )}
                      <span className="mt-1 text-[11px] text-muted-foreground">{formatTime(m.created_at)}</span>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef}/>
            </div>
          </ScrollArea>

          <form onSubmit={handleSendMessage} className="border-t border-border p-3">
            <div className="flex gap-2">
              {conversation?.type==="direct"?(
                <Input value={newMessage} onChange={e=>setNewMessage(e.target.value)} placeholder="Ketik pesan..." className="flex-1 rounded-xl" disabled={sending}
                  onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); handleSendMessage(e as any); } }}/>
              ):(
                <MentionInput value={newMessage} onChange={setNewMessage} placeholder="Ketik pesan... (gunakan @ untuk mention)" className="flex-1 rounded-xl" disabled={sending}
                  currentUserId={currentUser?.id} allowedUserIds={conversation?.type==="group"?groupMembers:undefined}
                  onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); handleSendMessage(e as any); } }}/>
              )}
              <Button type="submit" size="icon" disabled={sending||!newMessage.trim()} className="rounded-xl bg-accent text-accent-foreground hover:bg-accent/90"><Send className="h-5 w-5"/></Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default Chat;