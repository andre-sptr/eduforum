// src/pages/SearchPage.tsx
import { useEffect,useState,useMemo } from "react";
import { useNavigate,useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card,CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar,AvatarFallback,AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft,Search,User,FileText } from "lucide-react";
import PostCard from "@/components/PostCard";
import PostSkeleton from "@/components/PostSkeleton";
import { toast } from "sonner";
import { RankBadge } from "@/components/RankBadge";

const SearchPage=()=> {
  const navigate=useNavigate(); const [sp]=useSearchParams();
  const [q,setQ]=useState(sp.get("q")||"");
  const [posts,setPosts]=useState<any[]>([]);
  const [users,setUsers]=useState<any[]>([]);
  const [loading,setLoading]=useState(false);
  const [currentUser,setCurrentUser]=useState<any>(null);
  const [topFollowers, setTopFollowers] = useState<any[]>([]);
  const [topLiked, setTopLiked] = useState<any[]>([]);

  const followerRankMap = useMemo(() =>
    new Map(topFollowers.slice(0, 3).map((u, i) => [u.id, i + 1]))
  , [topFollowers]);

  const likerRankMap = useMemo(() =>
    new Map(topLiked.slice(0, 3).map((u, i) => [u.id, i + 1]))
  , [topLiked]);

  const getInitials=(n:string)=>{ const a=n.trim().split(" "); return (a[0][0]+(a[1]?.[0]||a[0][1]||"")).toUpperCase(); };
  const refreshPosts=async()=>{ if(q.trim()) await handleSearch(q); };

  useEffect(()=>{ checkUser(); },[]);
  useEffect(()=>{ const v=sp.get("q"); if(v!==null){ setQ(v); handleSearch(v); } },[sp]);

  const checkUser=async()=> {
    const { data:{ user } }=await supabase.auth.getUser(); if(!user){ navigate("/auth"); return; }
    const [profileRes, tfRes, tlRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.rpc("get_top_5_followers"),
      supabase.rpc("get_top_5_liked_users")
    ]);
    
    setCurrentUser(profileRes.data);
    if (tfRes.data) setTopFollowers(tfRes.data);
    if (tlRes.data) setTopLiked(tlRes.data);
  };

  const handleSearch=async(query:string)=> {
    if(!query.trim()){ setPosts([]); setUsers([]); return; }
    setLoading(true);
    try{
      const { data: postsData, error: postsError } = await supabase
        .from("posts")
        .select(`
          id, content, created_at, media_urls, media_types, user_id,
          profiles:profiles!user_id ( id, full_name, avatar_url, role ),
          likes ( user_id, post_id ),
          reposts ( count ),
          quote_reposts:posts!repost_of_id ( count ),
          quoted_post:repost_of_id (
            id, content, created_at, user_id,
            spotify_track_id,
            profiles:profiles!user_id ( id, full_name, avatar_url, role )
          )
        `)
        .ilike("content", `%${query}%`)
        .order("created_at", { ascending: false })
        .limit(20);
      if(postsError) throw postsError;
      setPosts(postsData || []);
      const { data:usersData,error:usersError }=await supabase.from("profiles").select("*").ilike("full_name",`%${query}%`).limit(20);
      if(usersError) throw usersError; setUsers(usersData||[]);
    }catch(e:any){ toast.error(e.message); }finally{ setLoading(false); }
  };

  const submit=(e:React.FormEvent)=>{ e.preventDefault(); if(q.trim()) navigate(`/search?q=${encodeURIComponent(q)}`); };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-accent/10">
      <header className="sticky top-0 z-50 border-b bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={()=>navigate("/")} className="rounded-xl"><ArrowLeft className="h-5 w-5"/></Button>
          <form onSubmit={submit} className="flex-1 max-w-2xl">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
              <Input value={q} onChange={e=>setQ(e.target.value)} placeholder="Cari pengguna dan postingan…" className="pl-10 rounded-xl bg-input/60 border-border"/>
            </div>
          </form>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl space-y-8">
        <section>
          <div className="flex items-center gap-2 mb-3">
            <User className="h-4 w-4"/><h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">Pengguna</h2>
            <span className="text-xs px-2 py-0.5 rounded-full border bg-card">{users.length}</span>
          </div>
          {loading&&q ? (
            <div className="grid gap-3 md:grid-cols-2">
              {[...Array(4)].map((_,i)=>(<Card key={i}><CardContent className="p-4 flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-muted/50 animate-pulse"/><div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted/50 rounded w-3/5 animate-pulse"/><div className="h-3 bg-muted/40 rounded w-2/5 animate-pulse"/>
                </div></CardContent></Card>))}
            </div>
          ):users.length?(
            <div className="grid gap-3 md:grid-cols-2">
              {users.map(u=>(
                <Card key={u.id} onClick={()=>navigate(`/profile/${u.id}`)} className="cursor-pointer rounded-2xl border-border bg-card/60 hover:bg-accent/5 transition">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-12 w-12 ring-2 ring-accent/20">
                        <AvatarImage src={u.avatar_url||undefined}/><AvatarFallback className="bg-primary text-primary-foreground font-semibold">{getInitials(u.full_name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold truncate">{u.full_name}</p>
                          <RankBadge rank={followerRankMap.get(u.id)} type="follower" />
                          <RankBadge rank={likerRankMap.get(u.id)} type="like" />
                        </div>
                        {u.bio&&<p className="text-sm text-muted-foreground truncate">{u.bio}</p>}
                      </div>
                      <Button variant="ghost" size="sm" className="rounded-xl">Lihat</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ):(
            <div className="text-center py-10 text-muted-foreground">{q?"Tidak ada pengguna ditemukan":"Masukkan kata kunci untuk mulai mencari"}</div>
          )}
        </section>

        <section>
          <div className="flex items-center gap-2 mb-3">
            <FileText className="h-4 w-4"/><h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">Postingan</h2>
            <span className="text-xs px-2 py-0.5 rounded-full border bg-card">{posts.length}</span>
          </div>
          {loading&&q?(
            <div className="space-y-4"><PostSkeleton/><PostSkeleton/><PostSkeleton/></div>
          ):posts.length?(
            <div className="space-y-4">
              {posts.map(p=>(
                <PostCard key={p.id} post={p} currentUserId={currentUser?.id}
                // onLike={refreshPosts}
                onPostUpdated={refreshPosts} onPostDeleted={refreshPosts} postType="global" topFollowers={topFollowers} topLiked={topLiked}/>
              ))}
            </div>
          ):(
            <div className="text-center py-10 text-muted-foreground">{q?"Tidak ada postingan ditemukan":"Ketik kata kunci pada kotak pencarian di atas"}</div>
          )}
        </section>
      </main>
    </div>
  );
};

export default SearchPage;