// src/pages/Messages.tsx
import { useEffect, useState, useRef, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Send, MessageCircle, Users, MoreVertical, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { z } from "zod";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MentionInput } from "@/components/MentionInput";
import { RankBadge } from "@/components/RankBadge";

const messageSchema=z.object({content:z.string().trim().min(1,"Message cannot be empty").max(2000,"Message is too long")});
interface Message{ id:string; user_id:string; content:string; created_at:string; edited_at?:string|null; is_deleted?:boolean; profiles?:{ full_name:string; avatar_url:string|null; role:string; }; }

const Messages=()=> {
  const navigate=useNavigate();
  const [messages,setMessages]=useState<Message[]>([]);
  const [newMessage,setNewMessage]=useState("");
  const [currentUser,setCurrentUser]=useState<any>(null);
  const [globalConversation,setGlobalConversation]=useState<any>(null);
  const [loading,setLoading]=useState(true);
  const [sending,setSending]=useState(false);
  const [followedUsers,setFollowedUsers]=useState<any[]>([]);
  const [userGroups,setUserGroups]=useState<any[]>([]);
  const [editingMessageId,setEditingMessageId]=useState<string|null>(null);
  const [editContent,setEditContent]=useState("");
  const [followQuery,setFollowQuery]=useState("");
  const [topFollowers, setTopFollowers] = useState<any[]>([]);
  const [topLiked, setTopLiked] = useState<any[]>([]);
  const messagesViewportRef=useRef<HTMLDivElement>(null);

  const followerRankMap = useMemo(() =>
    new Map(topFollowers.slice(0, 3).map((u, i) => [u.id, i + 1]))
  , [topFollowers]);

  const likerRankMap = useMemo(() =>
    new Map(topLiked.slice(0, 3).map((u, i) => [u.id, i + 1]))
  , [topLiked]);

  useEffect(()=>{ checkUser(); },[]);
  useEffect(()=>{ const el=messagesViewportRef.current; if(el) el.scrollTop=el.scrollHeight; },[messages]);

  const checkUser=async()=>{
    const { data:{ user } }=await supabase.auth.getUser();
    if(!user){ navigate("/auth"); return; }
    setCurrentUser(user);
    const [_, __, ___, tfData, tlData] = await Promise.all([
      loadGlobalChat(user.id),
      loadFollowedUsers(user.id),
      loadUserGroups(user.id),
      supabase.rpc("get_top_5_followers"),
      supabase.rpc("get_top_5_liked_users") 
    ]);
    if (tfData.data) setTopFollowers(tfData.data);
    if (tlData.data) setTopLiked(tlData.data);
    setLoading(false);
  };

  const loadGlobalChat=async(userId:string)=>{
    try{
      let { data:globalConv }=await supabase.from("conversations").select("*").eq("type","global").maybeSingle();
      if(!globalConv){
        const { data:newGlobal,error:e }=await supabase.from("conversations").insert({ name:"Global Chat",type:"global",created_by:userId }).select().single();
        if(e){ toast.error("Gagal membuat global chat: "+e.message); return; }
        globalConv=newGlobal;
      }
      if(globalConv){
        setGlobalConversation(globalConv);
        const { data:existing }=await supabase.from("conversation_participants").select("*").eq("conversation_id",globalConv.id).eq("user_id",userId).maybeSingle();
        if(!existing) await supabase.from("conversation_participants").insert({ conversation_id:globalConv.id,user_id:userId });
        await loadMessages(globalConv.id);
      }
    }catch{ toast.error("Gagal memuat global chat"); }
  };

  const loadFollowedUsers=async(userId:string)=>{
    const { data }=await supabase.from("follows").select("following_id, profiles!follows_following_id_fkey(id,full_name,avatar_url,role)").eq("follower_id",userId);
    if(data) setFollowedUsers(data.map(f=>f.profiles).filter(Boolean) as any[]);
  };

  const loadUserGroups=async(userId:string)=>{
    const { data }=await supabase.from("group_members").select("group_id, groups(id,name,cover_image)").eq("user_id",userId);
    if(data) setUserGroups(data.map(g=>g.groups).filter(Boolean) as any[]);
  };

  const loadMessages=async(conversationId:string)=>{
    const { data:rows,error }=await supabase.from("messages").select("*").eq("conversation_id",conversationId).order("created_at",{ascending:true}).limit(100);
    if(error){ toast.error(error.message); return; }
    if(!rows?.length){ setMessages([]); return; }
    const uids=[...new Set(rows.map(m=>m.user_id))];
    const { data:profiles }=await supabase.from("profiles").select("id,full_name,avatar_url,role").in("id",uids);
    const map=new Map((profiles||[]).map(p=>[p.id,p]));
    setMessages(rows.map(m=>({ ...m, profiles:map.get(m.user_id)||{ full_name:"Unknown User",avatar_url:null,role:"siswa" } })));
  };

  useEffect(()=>{ if(globalConversation?.id){ const unsub=setupRealtimeSubscription(globalConversation.id); return unsub; }},[globalConversation?.id]);
  const setupRealtimeSubscription=(conversationId:string)=>{
    const channel=supabase.channel(`messages-${conversationId}`)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"messages",filter:`conversation_id=eq.${conversationId}`},async payload=>{
        const { data:m }=await supabase.from("messages").select("*").eq("id",payload.new.id).single(); if(!m) return;
        const { data:p }=await supabase.from("profiles").select("id,full_name,avatar_url,role").eq("id",m.user_id).single();
        setMessages(v=>[...v,{...m,profiles:p||{full_name:"Unknown User",avatar_url:null,role:"siswa"}}]);
      })
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"messages",filter:`conversation_id=eq.${conversationId}`},p=>{
        setMessages(v=>v.map(x=>x.id===p.new.id?{...x,content:p.new.content,edited_at:p.new.edited_at,is_deleted:p.new.is_deleted}:x));
      })
      .on("postgres_changes",{event:"DELETE",schema:"public",table:"messages",filter:`conversation_id=eq.${conversationId}`},p=>{
        setMessages(v=>v.filter(x=>x.id!==p.old.id));
      }).subscribe();
    return()=>{ supabase.removeChannel(channel); };
  };

  const handleSendMessage=async(e:React.FormEvent)=>{
    e.preventDefault(); if(!newMessage.trim()) return;
    try{ messageSchema.parse({content:newMessage}); }catch(err){ if(err instanceof z.ZodError) toast.error(err.errors[0].message); return; }
    if(!globalConversation){ toast.error("Global chat belum tersedia"); return; }
    setSending(true);
    try{ const { error }=await supabase.from("messages").insert({ conversation_id:globalConversation.id,user_id:currentUser.id,content:newMessage.trim() }); if(error) throw error; setNewMessage(""); const el=messagesViewportRef.current; if(el) el.scrollTop=el.scrollHeight; }catch(err:any){ toast.error("Gagal mengirim pesan: "+err.message); }finally{ setSending(false); }
  };

  const createDirectChat=async(id:string)=>{ try{ const { data:cid,error }=await supabase.rpc("create_direct_conversation",{ target_user_id:id }); if(error) throw error; if(cid) navigate(`/chat/${cid}`); }catch(err:any){ toast.error("Gagal membuat chat: "+err.message); } };
  const createGroupChat=async(id:string)=>{ try{ const { data:cid,error }=await supabase.rpc("create_group_conversation",{ p_group_id:id }); if(error) throw error; if(cid) navigate(`/chat/${cid}`); }catch(err:any){ toast.error("Gagal membuat chat grup: "+err.message); } };

  const getInitials=(n:string)=>{ const a=n.trim().split(" "); const s=((a[0]?.[0]||"")+(a[1]?.[0]||"")).toUpperCase(); return s||"U"; };
  const startEdit=(m:Message)=>{ setEditingMessageId(m.id); setEditContent(m.content); };
  const cancelEdit=()=>{ setEditingMessageId(null); setEditContent(""); };
  const handleEditMessage=async(id:string)=>{ if(!editContent.trim()){ toast.error("Pesan tidak boleh kosong"); return; } try{ messageSchema.parse({content:editContent}); }catch(err){ if(err instanceof z.ZodError) toast.error(err.errors[0].message); return; } try{ const { error }=await supabase.from("messages").update({ content:editContent.trim(),edited_at:new Date().toISOString() }).eq("id",id); if(error) throw error; setEditingMessageId(null); setEditContent(""); toast.success("Pesan berhasil diubah"); }catch(err:any){ toast.error("Gagal mengubah pesan: "+err.message); } };
  const handleDeleteMessage=async(id:string)=>{ try{ const { error }=await supabase.from("messages").delete().eq("id",id); if(error) throw error; toast.success("Pesan berhasil dihapus"); }catch(err:any){ toast.error("Gagal menghapus pesan: "+err.message); } };
  const formatTime=(ts:string)=>new Date(ts).toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"});

  const filteredFollowed=followedUsers.filter(u=>(u.full_name||"").toLowerCase().includes(followQuery.toLowerCase()));

  if(loading) return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-b from-background to-background/60">
      <div className="text-center"><div className="h-12 w-12 mx-auto animate-spin rounded-full border-2 border-border border-t-accent"/><p className="mt-4 text-muted-foreground">Memuat chat...</p></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 border-b border-border bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={()=>navigate("/")} className="rounded-xl"><ArrowLeft className="h-5 w-5"/></Button>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">Global Chat</h1>
        </div>
      </header>

      <div className="flex-1 container mx-auto px-4 py-6 flex gap-6 max-w-7xl">
        <Card className="flex-1 border-border bg-card/60 backdrop-blur rounded-2xl flex flex-col h-[calc(100vh-125px)]">
          <div ref={messagesViewportRef} className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              {messages.length===0?(<div className="text-center py-10 text-muted-foreground">Belum ada pesan. Mulai percakapan!</div>):messages.map(m=>{
                const own=m.user_id===currentUser?.id; const editing=editingMessageId===m.id;
                return (
                  <div key={m.id} className={`flex gap-3 ${own?"flex-row-reverse":"flex-row"}`}>
                    <Link to={`/profile/${m.user_id}`} className="shrink-0" onClick={(e)=>e.stopPropagation()}>
                      <Avatar className="h-8 w-8"><AvatarImage src={m.profiles?.avatar_url||undefined}/><AvatarFallback className="bg-primary text-primary-foreground font-semibold">{getInitials(m.profiles?.full_name||"U")}</AvatarFallback></Avatar>
                    </Link>
                    <div className={`flex flex-col max-w-[70%] ${own?"items-end":"items-start"}`}>
                      <div className="flex items-center flex-wrap gap-2 mb-1">
                        <Link to={`/profile/${m.user_id}`} className="text-sm font-medium" onClick={(e) => e.stopPropagation()}>{m.profiles?.full_name}</Link>
                        <RankBadge rank={followerRankMap.get(m.user_id)} type="follower" />
                        <RankBadge rank={likerRankMap.get(m.user_id)} type="like" />
                        <span className="text-xs text-muted-foreground">{m.profiles?.role}</span>
                      </div>
                      {editing?(
                        <div className="flex gap-2 w-full">
                          <Input value={editContent} onChange={e=>setEditContent(e.target.value)} className="flex-1" autoFocus onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); handleEditMessage(m.id); } if(e.key==="Escape") cancelEdit(); }}/>
                          <Button size="sm" onClick={()=>handleEditMessage(m.id)}>Simpan</Button>
                          <Button size="sm" variant="ghost" onClick={cancelEdit}>Batal</Button>
                        </div>
                      ):(
                        <div className="flex items-start gap-2">
                          <div className={`rounded-2xl px-4 py-2 shadow-sm ${own?"bg-accent text-accent-foreground":"bg-muted/70 text-foreground"}`}>
                            <p className="text-sm whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{__html:m.content.replace(/@\[([^\]]+)\]\([a-f0-9\-]+\)/g,'<span class="text-primary font-semibold">@$1</span>')}}/>
                            {m.edited_at&&<span className="text-xs opacity-70 italic">diedit</span>}
                          </div>
                          {own&&(
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6"><MoreVertical className="h-4 w-4"/></Button></DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={()=>startEdit(m)}><Pencil className="h-4 w-4 mr-2"/>Edit</DropdownMenuItem>
                                <DropdownMenuItem onClick={()=>handleDeleteMessage(m.id)} className="text-destructive"><Trash2 className="h-4 w-4 mr-2"/>Hapus</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      )}
                      <span className="text-xs text-muted-foreground mt-1">{formatTime(m.created_at)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <form onSubmit={handleSendMessage} className="border-t border-border p-4 bg-card/70 backdrop-blur">
            <div className="flex gap-2">
              <MentionInput value={newMessage} onChange={setNewMessage} placeholder="Ketik pesan..." className="flex-1 bg-input/60 border-border rounded-xl" disabled={sending} currentUserId={currentUser?.id} onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); handleSendMessage(e as any);} }}/>
              <Button type="submit" size="icon" disabled={sending||!newMessage.trim()} className="rounded-xl bg-accent text-accent-foreground hover:bg-accent/90"><Send className="h-5 w-5"/></Button>
            </div>
          </form>
        </Card>

        <div className="w-80 space-y-4 hidden lg:block">
          <Card className="p-4 border-border bg-card/60 backdrop-blur rounded-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2"><MessageCircle className="h-4 w-4"/>User yang Diikuti</h3>
            </div>
            <div className="relative mb-3">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
              <Input value={followQuery} onChange={e=>setFollowQuery(e.target.value)} placeholder="Cari pengguna..." className="pl-9 h-9 bg-input/60 border-border rounded-xl"/>
            </div>
            <ScrollArea className="h-72">
              <div className="space-y-2 pr-2">
                {filteredFollowed.length===0?(<p className="text-sm text-muted-foreground text-center py-4">Tidak ada hasil</p>):filteredFollowed.map(u=>(
                  <div key={u.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/10 cursor-pointer transition-colors" onClick={()=>createDirectChat(u.id)}>
                    <Avatar className="h-8 w-8"><AvatarImage src={u.avatar_url||undefined}/><AvatarFallback className="bg-primary text-primary-foreground font-semibold">{getInitials(u.full_name||"U")}</AvatarFallback></Avatar>
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{u.full_name}</p><p className="text-xs text-muted-foreground">{u.role}</p></div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </Card>

          <Card className="p-4 border-border bg-card/60 backdrop-blur rounded-2xl">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Users className="h-4 w-4"/>Grup Chat</h3>
            <ScrollArea className="h-72">
              <div className="space-y-2 pr-2">
                {userGroups.length===0?(<p className="text-sm text-muted-foreground text-center py-4">Belum bergabung grup</p>):userGroups.map(g=>(
                  <div key={g.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/10 cursor-pointer transition-colors" onClick={()=>createGroupChat(g.id)}>
                    <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center shrink-0 overflow-hidden">{g.cover_image?(<img src={g.cover_image} alt={g.name} className="h-full w-full object-cover"/>):(<Users className="h-4 w-4 text-accent-foreground"/>)}</div>
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{g.name}</p></div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Messages;