
import { useEffect, useState, useRef, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, MessageCircle, Users, MoreVertical, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { z } from "zod";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MentionInput } from "@/components/MentionInput";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLeaderboardData } from "@/hooks/useLeaderboardData";
import { RankBadge } from "@/components/RankBadge";
import { ContentRenderer } from "@/components/ContentRenderer";
import MessagesSkeleton from "@/components/MessagesSkeleton";

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
  const { topFollowers, topLiked } = useLeaderboardData();
  const messagesViewportRef=useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const followerRankMap = useMemo(() =>
    new Map(topFollowers.slice(0, 3).map((u, i) => [u.id, i + 1]))
  , [topFollowers]);

  const likerRankMap = useMemo(() =>
    new Map(topLiked.slice(0, 3).map((u, i) => [u.id, i + 1]))
  , [topLiked]);

  useEffect(()=>{ checkUser(); },[]);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
    // Fallback in case of image loading
    const timeoutId = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timeoutId);
  }, [messages, loading]);

  const checkUser=async()=>{
    const { data:{ user } }=await supabase.auth.getUser();
    if(!user){ navigate("/auth"); return; }
    setCurrentUser(user);
    const [_, __, ___] = await Promise.all([
      loadGlobalChat(user.id),
      loadFollowedUsers(user.id),
      loadUserGroups(user.id)
    ]);
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

  if (loading) return <MessagesSkeleton />;

  return (
    <div className="space-y-6 h-[calc(100vh-140px)] flex flex-col">
      <Tabs defaultValue="global" className="w-full">
        <TabsList className="w-full justify-start rounded-xl bg-muted/50 p-1 mb-6">
          <TabsTrigger value="global" className="rounded-lg px-6">Global Chat</TabsTrigger>
          <TabsTrigger value="direct" className="rounded-lg px-6">Direct Messages</TabsTrigger>
          <TabsTrigger value="groups" className="rounded-lg px-6">Grup Chat</TabsTrigger>
        </TabsList>

        <TabsContent value="global" className="h-[calc(100vh-183px)]">
          <Card className="flex-1 border-border bg-card shadow-xl rounded-2xl flex flex-col h-full overflow-hidden relative">
            <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#000000_1px,transparent_1px)] dark:bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />
            <div ref={messagesViewportRef} className="flex-1 overflow-y-auto p-4 sm:p-6 z-10">
              <div className="space-y-6">
                {messages.length===0?(
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-60">
                    <div className="w-16 h-16 bg-muted/30 rounded-full flex items-center justify-center mb-4">
                      <MessageCircle className="h-8 w-8" />
                    </div>
                    <p className="font-medium">Belum ada pesan. Mulai percakapan!</p>
                  </div>
                ):messages.map((m, idx)=>{
                  const own=m.user_id===currentUser?.id; 
                  const editing=editingMessageId===m.id;
                  const prev=messages[idx-1];
                  const isGrouped = prev && prev.user_id === m.user_id && (new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60 * 1000);

                  return (
                    <div key={m.id} className={`flex gap-4 group/msg animate-in slide-in-from-bottom-2 duration-300 ${own?"flex-row-reverse":"flex-row"} ${isGrouped ? "mt-1" : "mt-6"}`}>
                      {!isGrouped ? (
                        <Link to={`/profile/${m.user_id}`} className="shrink-0 transition-transform hover:scale-105" onClick={(e)=>e.stopPropagation()}>
                          <Avatar className="h-9 w-9 ring-2 ring-border/50 shadow-sm"><AvatarImage src={m.profiles?.avatar_url||undefined} className="object-cover"/><AvatarFallback className="bg-gradient-to-br from-primary to-primary/60 text-primary-foreground font-bold text-xs">{getInitials(m.profiles?.full_name||"U")}</AvatarFallback></Avatar>
                        </Link>
                      ) : (
                        <div className="w-9 shrink-0" />
                      )}
                      
                      <div className={`flex flex-col max-w-[75%] sm:max-w-[70%] ${own?"items-end":"items-start"}`}>
                        {!isGrouped && (
                          <div className={`flex items-center flex-wrap gap-2 mb-1.5 ${own ? "flex-row-reverse" : ""}`}>
                            <Link to={`/profile/${m.user_id}`} className="text-sm font-bold hover:text-primary transition-colors" onClick={(e) => e.stopPropagation()}>{m.profiles?.full_name}</Link>
                            <RankBadge rank={followerRankMap.get(m.user_id)} type="follower" />
                            <RankBadge rank={likerRankMap.get(m.user_id)} type="like" />
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium uppercase tracking-wide">{m.profiles?.role}</span>
                          </div>
                        )}
                        
                        {editing?(
                          <div className={`flex gap-2 w-full ${own?"flex-row-reverse":""} animate-in fade-in zoom-in-95 duration-200`}>
                            <Input value={editContent} onChange={e=>setEditContent(e.target.value)} className="flex-1 bg-background/50 backdrop-blur-sm border-primary/50 ring-2 ring-primary/20 rounded-xl" autoFocus onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); handleEditMessage(m.id); } if(e.key==="Escape") cancelEdit(); }}/>
                            <Button size="sm" onClick={()=>handleEditMessage(m.id)} className="rounded-lg shadow-md">Simpan</Button>
                            <Button size="sm" variant="ghost" onClick={cancelEdit} className="rounded-lg hover:bg-destructive/10 hover:text-destructive">Batal</Button>
                          </div>
                        ):(
                          <div className="group relative flex items-start gap-2">
                            <div className={`relative px-5 py-3 shadow-sm border transition-all duration-200 ${
                              own
                                ? "bg-primary text-primary-foreground border-primary rounded-2xl rounded-tr-sm"
                                : "bg-card text-foreground border-border rounded-2xl rounded-tl-sm hover:border-border/80 hover:bg-accent/5"
                            }`}>
                              <ContentRenderer content={m.content} className={`text-[15px] whitespace-pre-wrap break-words leading-relaxed ${own ? "text-primary-foreground/95" : "text-foreground/90"}`} />
                              <div className={`flex items-center gap-1.5 mt-1.5 ${own ? "justify-end text-primary-foreground/70" : "text-muted-foreground/60"}`}>
                                <span className="text-[10px] font-medium">{formatTime(m.created_at)}</span>
                                {m.edited_at && <Pencil className="h-2.5 w-2.5 opacity-70" />}
                              </div>
                            </div>
                            
                            {own&&(
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-0 -right-8">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-muted"><MoreVertical className="h-3.5 w-3.5 text-muted-foreground"/></Button></DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-32">
                                    <DropdownMenuItem onClick={()=>startEdit(m)} className="cursor-pointer"><Pencil className="h-3.5 w-3.5 mr-2"/>Edit</DropdownMenuItem>
                                    <DropdownMenuItem onClick={()=>handleDeleteMessage(m.id)} className="text-destructive cursor-pointer focus:bg-destructive/10"><Trash2 className="h-3.5 w-3.5 mr-2"/>Hapus</DropdownMenuItem>
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
                <div ref={messagesEndRef} />
              </div>
            </div>

            <form onSubmit={handleSendMessage} className="border-t border-border p-4 bg-card/80 backdrop-blur-sm z-20">
              <div className="flex gap-3 items-end max-w-5xl mx-auto">
                <div className="flex-1 relative">
                  <MentionInput value={newMessage} onChange={setNewMessage} placeholder="Ketik pesan..." className="w-full bg-muted/50 border-transparent focus:border-primary/30 focus:bg-background rounded-2xl px-4 py-3 min-h-[48px] shadow-inner transition-all resize-none" disabled={sending} currentUserId={currentUser?.id} onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); handleSendMessage(e as any);} }}/>
                </div>
                <Button type="submit" size="icon" disabled={sending||!newMessage.trim()} className="h-12 w-12 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg hover:shadow-primary/25 hover:scale-105 transition-all flex-shrink-0"><Send className="h-5 w-5 ml-0.5"/></Button>
              </div>
            </form>
          </Card>
        </TabsContent>

        <TabsContent value="direct">
          <Card className="p-4 border-border bg-card shadow-xl rounded-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2"><MessageCircle className="h-4 w-4"/>User yang Diikuti</h3>
            </div>
            <div className="relative mb-3">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
              <Input value={followQuery} onChange={e=>setFollowQuery(e.target.value)} placeholder="Cari pengguna..." className="pl-9 h-9 bg-muted/50 border-muted rounded-xl focus:bg-background transition-all"/>
            </div>
            <ScrollArea className="h-[calc(100vh-320px)] sm:h-[calc(100vh-300px)]">
              <div className="space-y-2 pr-2">
                {filteredFollowed.length===0?(<p className="text-sm text-muted-foreground text-center py-4">Tidak ada hasil</p>):filteredFollowed.map(u=>(
                  <div key={u.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors" onClick={()=>createDirectChat(u.id)}>
                    <Avatar className="h-8 w-8 ring-1 ring-border"><AvatarImage src={u.avatar_url||undefined}/><AvatarFallback className="bg-primary text-primary-foreground font-semibold">{getInitials(u.full_name||"U")}</AvatarFallback></Avatar>
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{u.full_name}</p><p className="text-xs text-muted-foreground">{u.role}</p></div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </Card>
        </TabsContent>

        <TabsContent value="groups">
          <Card className="p-4 border-border bg-card shadow-xl rounded-2xl">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Users className="h-4 w-4"/>Grup Chat</h3>
            <ScrollArea className="h-[calc(100vh-320px)] sm:h-[calc(100vh-300px)]">
              <div className="space-y-2 pr-2">
                {userGroups.length===0?(<p className="text-sm text-muted-foreground text-center py-4">Belum bergabung grup</p>):userGroups.map(g=>(
                  <div key={g.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors" onClick={()=>createGroupChat(g.id)}>
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden ring-1 ring-border">{g.cover_image?(<img src={g.cover_image} alt={g.name} className="h-full w-full object-cover"/>):(<Users className="h-4 w-4 text-muted-foreground"/>)}</div>
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{g.name}</p></div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Messages;