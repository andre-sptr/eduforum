import React, { useMemo, useRef, useState, useEffect } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar"; import { LeftSidebar } from "@/components/LeftSidebar"; import { RightSidebar } from "@/components/RightSidebar";
import { PostCard, PostWithAuthor } from "@/components/PostCard"; import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth"; import { useQuery } from "@tanstack/react-query"; import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card"; import { UserAvatar } from "@/components/UserAvatar"; import { Button } from "@/components/ui/button"; import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type PostLike={user_id:string}; interface Post extends Omit<PostWithAuthor,"viewer_has_liked">{user_like:PostLike[]}
type SearchedProfile={id:string;name:string;username:string;bio:string|null;avatar_text:string;role:string}
type CurrentProfileData={id:string;name:string;avatar_text:string}
const PAGE_SIZE=4;

const AutoLoadMore=({enabled,onLoad,rootMargin="600px"}:{enabled:boolean;onLoad:()=>void;rootMargin?:string})=>{
  const ref=useRef<HTMLDivElement|null>(null);
  useEffect(()=>{ if(!enabled||!ref.current) return; let once=false; const io=new IntersectionObserver(e=>{ if(!once&&e[0]?.isIntersecting){ once=true; onLoad(); }},{rootMargin}); io.observe(ref.current); return()=>io.disconnect();},[enabled,onLoad,rootMargin]);
  return <div ref={ref} aria-hidden className="h-6" />;
};

export default function SearchPage(){
  const [sp]=useSearchParams(); const q=sp.get("q")||""; const {user,loading:authLoading}=useAuth(); const nav=useNavigate();
  const [loadingChat,setLoadingChat]=useState(false); const [pages,setPages]=useState(1);

  const {data:me,isLoading:isProfileLoading}=useQuery<CurrentProfileData|null>({
    queryKey:["profile",user?.id], enabled:!!user,
    queryFn:async()=>{ if(!user) return null; const {data}=await supabase.from("profiles").select("id,name,avatar_text").eq("id",user.id).maybeSingle(); return data;}
  });

  const {data:posts=[],isLoading:isPostsLoading}=useQuery<Post[]>({
    queryKey:["searchPosts",q,user?.id], enabled:!!q&&!!user,
    queryFn:async()=>{ if(!q||!user?.id) return[];
      const {data,error}=await supabase.from("posts").select(`
        *,profiles!user_id(name,avatar_text,role),
        original_author:profiles!original_author_id(name,avatar_text,role),
        user_like:post_likes!left(user_id)
      `).ilike("content",`%${q}%`).eq("post_likes.user_id",user.id).order("created_at",{ascending:false}).limit(100);
      if(error) throw error; return (data as Post[])||[];}
  });

  const {data:users=[],isLoading:isUsersLoading}=useQuery<SearchedProfile[]>({
    queryKey:["searchUsers",q], enabled:!!q,
    queryFn:async()=>{ if(!q) return[]; const {data,error}=await supabase.from("profiles").select("id,name,bio,avatar_text,role,username").ilike("name",`%${q}%`).limit(10); if(error) throw error; return data||[];}
  });

  const visiblePosts=useMemo(()=>posts.slice(0,pages*PAGE_SIZE),[posts,pages]);
  const canLoadMore=visiblePosts.length<posts.length;

  const startOrGoToChat=async(recipientId:string)=>{
    if(!me){ toast.error("Gagal memulai chat: Profil pengguna tidak ditemukan."); return; }
    if(me.id===recipientId){ toast.info("Anda tidak bisa chat dengan diri sendiri."); return; }
    setLoadingChat(true);
    try{ const {data:roomId,error}=await supabase.rpc("create_or_get_chat_room",{recipient_id:recipientId}); if(error) throw error; if(!roomId) throw new Error("Gagal mendapatkan ID room chat."); nav(`/chat/${roomId}`);}
    catch(e){ toast.error(`Gagal memulai chat: ${(e as Error).message}`);}
    finally{ setLoadingChat(false); }
  };

  if(authLoading||isProfileLoading||!me) return (
    <div className="min-h-screen bg-muted"><Navbar/>
      <main className="container mx-auto grid grid-cols-10 gap-6 py-6">
        <aside className="col-span-2 hidden md:block"><Skeleton className="h-40 w-full rounded-lg"/></aside>
        <section className="col-span-10 md:col-span-5 space-y-4"><Skeleton className="h-8 w-3/4"/><Skeleton className="h-40 w-full"/><Skeleton className="h-40 w-full"/></section>
        <aside className="col-span-10 md:col-span-3 hidden md:block"><Skeleton className="h-40 w-full rounded-lg"/><Skeleton className="h-64 w-full rounded-lg mt-6"/></aside>
      </main>
    </div>
  );

  return (
    <div className="min-h-screen bg-muted">
      <Navbar userName={me.name} userInitials={me.avatar_text}/>
      <main className="container mx-auto grid grid-cols-10 gap-6 py-6">
        <LeftSidebar/>
        <section className="col-span-10 md:col-span-5 space-y-4">
          <div>
            <h3 className="text-lg font-medium mb-3 border-b pb-2">Pengguna</h3>
            {isUsersLoading? <Skeleton className="h-20 w-full"/> : !users.length? <p className="text-center text-muted-foreground py-4">Tidak ada pengguna ditemukan.</p> : (
              <Card><CardContent className="p-4 space-y-4">
                {users.map(u=>(
                  <div key={u.id} className="flex items-center justify-between">
                    <Link to={`/profile/u/${u.username}`} className="flex items-start gap-3 group">
                      <UserAvatar name={u.name} initials={u.avatar_text}/>
                      <div className="min-h-[2.5rem]">
                        <div className="flex items-baseline gap-1"><h4 className="font-semibold">{u.name}</h4><Badge variant="secondary" className="px-1.5 py-0 text-xs">{u.role}</Badge></div>
                        <p className="text-xs text-muted-foreground mt-0.5">{u.bio||<i>Tidak ada bio</i>}</p>
                      </div>
                    </Link>
                    {u.id!==me.id&&(<Button size="sm" variant="outline" onClick={()=>startOrGoToChat(u.id)} disabled={loadingChat}>{loadingChat?"...":"Chat"}</Button>)}
                  </div>
                ))}
              </CardContent></Card>
            )}
          </div>

          <h2 className="text-lg font-medium mb-3 border-b pb-2">Hasil Pencarian untuk: "{q}"</h2>
          <div className="flex flex-col gap-4">
            {isPostsLoading? (<><Skeleton className="h-40 w-full"/><Skeleton className="h-40 w-full"/></>) :
            !posts.length? <p className="text-center text-muted-foreground">Tidak ada hasil postingan ditemukan.</p> :
            (<>
              {visiblePosts.map(p=>(
                <PostCard key={p.id} post={{...p,viewer_has_liked:(p.user_like?.length||0)>0}} currentUserId={me.id} currentUserName={me.name} currentUserInitials={me.avatar_text}/>
              ))}
              <AutoLoadMore enabled={canLoadMore} onLoad={()=>setPages(x=>x+1)}/>
              {canLoadMore&&(<Button className="w-full" variant="outline" onClick={()=>setPages(x=>x+1)}>Muat lebih banyak</Button>)}
            </>)}
          </div>
        </section>
        <RightSidebar/>
      </main>
      <footer className="border-t py-4 bg-muted/30"><div className="container mx-auto px-4 text-center"><p className="text-sm text-muted-foreground"><a href="https://flamyheart.site" target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline underline-offset-4">© {new Date().getFullYear()} Andre Saputra</a></p></div></footer>
    </div>
  );
}