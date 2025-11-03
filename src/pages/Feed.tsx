import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PostCard from "@/components/PostCard";

type Profile={id:string;full_name:string;avatar_url?:string;role:string};
type PostRow={id:string;content:string;created_at:string;updated_at?:string;media_urls?:string[];media_types?:string[];profiles:Profile;likes:{user_id:string}[]};
type RepostRow={id:string;caption?:string|null;created_at:string;user_id:string;post:PostRow;user:Profile};

export default function Feed(){
  const [items,setItems]=useState<any[]>([]);
  const [currentUserId,setCurrentUserId]=useState<string|undefined>(undefined);

  const fetchUser=async()=>{const {data}=await supabase.auth.getUser();setCurrentUserId(data.user?.id)};

  const fetchPosts=async()=>{
    const {data:posts}=await supabase
      .from("posts")
      .select("id,content,created_at,updated_at,media_urls,media_types,profiles(id,full_name,avatar_url,role),likes(user_id)")
      .order("created_at",{ascending:false});

    const {data:reposts}=await supabase
      .from("reposts")
      .select(`
        id,caption,created_at,user_id,post_id,
        user:profiles!user_id(id,full_name,avatar_url,role),
        post:posts(
          id,content,created_at,updated_at,media_urls,media_types,
          profiles(id,full_name,avatar_url,role),
          likes(user_id)
        )
      `)
      .order("created_at",{ascending:false});

    const a=(posts||[]).map(p=>({kind:"post",sort_at:p.created_at,post:p}));
    const b=(reposts||[]).filter(r=>r.post).map((r:RepostRow)=>({kind:"repost",sort_at:r.created_at,post:r.post,repostBy:r.user,repostCaption:r.caption||"",repostCreatedAt:r.created_at}));
    const merged=[...a,...b].sort((x,y)=>new Date(y.sort_at).getTime()-new Date(x.sort_at).getTime());
    setItems(merged);
  };

  useEffect(()=>{fetchUser();fetchPosts()},[]);
  useEffect(()=>{
    const ch=supabase.channel("feed-realtime")
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"posts"},fetchPosts)
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"posts"},fetchPosts)
      .on("postgres_changes",{event:"DELETE",schema:"public",table:"posts"},fetchPosts)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"reposts"},fetchPosts)
      .on("postgres_changes",{event:"DELETE",schema:"public",table:"reposts"},fetchPosts)
      .subscribe();
    return()=>{supabase.removeChannel(ch)};
  },[]);

  const handleRepost=()=>fetchPosts();

  return(
    <div className="mx-auto max-w-2xl space-y-4">
      {items.map((it,idx)=>(
        <PostCard key={idx}
          post={it.post}
          currentUserId={currentUserId}
          onRepost={()=>handleRepost()}
          repostBy={it.kind==="repost"?it.repostBy:undefined}
          repostCaption={it.kind==="repost"?it.repostCaption:undefined}
          repostCreatedAt={it.kind==="repost"?it.repostCreatedAt:undefined}
          onPostUpdated={()=>{}}
          onPostDeleted={()=>fetchPosts()}
        />
      ))}
    </div>
  );
}