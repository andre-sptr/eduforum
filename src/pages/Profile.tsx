// src/pages/Profile.tsx
import { useEffect,useMemo,useRef,useState } from "react";
import { useNavigate,useParams,Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar,AvatarFallback,AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Settings, UserPlus, UserMinus, MessageCircle, Maximize2, Heart, Trophy } from "lucide-react";
import { toast } from "sonner";
import PostCard from "@/components/PostCard";
import PostSkeleton from "@/components/PostSkeleton";
import { Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { RankBadge } from "@/components/RankBadge";

type PostFilter = "all" | "reposts" | "media" | "text";
const POSTS_PROFILES_FK="posts_user_id_fkey";
const POST_SELECT = `
  id, content, created_at, media_urls, media_types, user_id,
  spotify_track_id,
  profiles:profiles!user_id ( id, full_name, avatar_url, role ),
  likes ( user_id, post_id ),
  reposts ( count ),
  quote_reposts:posts!repost_of_id ( count ),
  quoted_post:repost_of_id (
    id, content, created_at, user_id,
    profiles:profiles!user_id ( id, full_name, avatar_url, role )
  )
`;
const POSTS_PAGE_SIZE=10, LIST_PAGE_SIZE=20;

const Profile=()=> {
  const navigate=useNavigate(); const { userId }=useParams();
  const [currentUser,setCurrentUser]=useState<any>(null);
  const [profile,setProfile]=useState<any>(null);
  const [isFollowing,setIsFollowing]=useState(false);
  const [followerCount,setFollowerCount]=useState(0);
  const [followingCount,setFollowingCount]=useState(0);
  const [loading,setLoading]=useState(true);
  const [postFilter,setPostFilter]=useState<PostFilter>("all");
  const [posts,setPosts]=useState<any[]>([]);
  const [postsLoading,setPostsLoading]=useState(false);
  const [postsPage,setPostsPage]=useState(0);
  const [postsHasMore,setPostsHasMore]=useState(true);
  const [postCount, setPostCount] = useState({ all: 0, media: 0, text: 0, reposts: 0 });
  const loadMoreRef=useRef<HTMLDivElement|null>(null);
  const [openList,setOpenList]=useState<null|"followers"|"following">(null);
  const [listLoading,setListLoading]=useState(false);
  const [dialogSearch,setDialogSearch]=useState("");
  const [followers,setFollowers]=useState<any[]>([]);
  const [following,setFollowing]=useState<any[]>([]);
  const [followersPage,setFollowersPage]=useState(0);
  const [followingPage,setFollowingPage]=useState(0);
  const [followersHasMore,setFollowersHasMore]=useState(true);
  const [followingHasMore,setFollowingHasMore]=useState(true);
  const [followingIds,setFollowingIds]=useState<Set<string>>(new Set());
  const [viewerOpen,setViewerOpen]=useState(false);
  const [followerRank, setFollowerRank] = useState<number | null>(null);
  const [likerRank, setLikerRank] = useState<number | null>(null);
  const [topFollowers, setTopFollowers] = useState<any[]>([]);
  const [topLiked, setTopLiked] = useState<any[]>([]);

  const getInitials=(n:string)=>{ const a=n.split(" "); return a.length>=2?(a[0][0]+a[1][0]).toUpperCase():n.slice(0,2).toUpperCase(); };
  const getRoleBadgeColor=(r:string)=> r==="siswa"?"bg-blue-500/20 text-blue-400":r==="guru"?"bg-green-500/20 text-green-400":r==="alumni"?"bg-purple-500/20 text-purple-400":"bg-muted text-muted-foreground";

  useEffect(()=>{ loadProfile(); },[userId]);
  useEffect(()=>{ if(!profile) return; setPosts([]); setPostsPage(0); setPostsHasMore(true); loadPosts(0,true); },[profile?.id,postFilter]);
  useEffect(()=>{ if(!loadMoreRef.current) return; const io=new IntersectionObserver(e=>{ const f=e[0]; if(f.isIntersecting&&postsHasMore&&!postsLoading) loadPosts(postsPage+1); }); io.observe(loadMoreRef.current); return()=>io.disconnect(); },[loadMoreRef.current,postsHasMore,postsLoading,postsPage]);

  const loadPostCounts = async (pid: string) => {
    try {
      const [allRes, mediaRes, textRes, quoteRepostsRes, simpleRepostsRes] = await Promise.all([
        supabase.from("posts").select("id", { count: "exact", head: true }).eq("user_id", pid).is("repost_of_id", null),
        supabase.from("posts").select("id", { count: "exact", head: true }).eq("user_id", pid).not("media_urls", "is", null).is("repost_of_id", null),
        supabase.from("posts").select("id", { count: "exact", head: true }).eq("user_id", pid).is("media_urls", null).is("repost_of_id", null),
        supabase.from("posts").select("id", { count: "exact", head: true }).eq("user_id", pid).not("repost_of_id", "is", null),
        supabase.from("reposts").select("id", { count: "exact", head: true }).eq("user_id", pid) 
      ]);
      setPostCount({
        all: allRes.count || 0,
        media: mediaRes.count || 0,
        text: textRes.count || 0,
        reposts: (quoteRepostsRes.count || 0) + (simpleRepostsRes.count || 0)
      });
    } catch (e: any) { toast.error(e.message); }
  };

  const loadProfile=async()=> {
    try{
      const { data:{ user } }=await supabase.auth.getUser(); if(!user){ navigate("/auth"); return; }
      setCurrentUser(user); const pid=userId||user.id;
      const [{ data:profileData,error:pe },{ data:followData },followersRes,followingRes,myFollowingList,{ data: topFollowersData, error: tfError },{ data: topLikedData, error: tlError }]=await Promise.all([
        supabase.from("profiles").select("*").eq("id",pid).single(),
        pid!==user.id?supabase.from("follows").select("*").eq("follower_id",user.id).eq("following_id",pid).maybeSingle():Promise.resolve({ data:null }),
        supabase.from("follows").select("*",{ count:"exact",head:true }).eq("following_id",pid),
        supabase.from("follows").select("*",{ count:"exact",head:true }).eq("follower_id",pid),
        supabase.from("follows").select("following_id").eq("follower_id",user.id),
        supabase.rpc("get_top_5_followers"),supabase.rpc("get_top_5_liked_users")
      ]);
      if(pe) throw pe;
      setTopFollowers(topFollowersData || []); setTopLiked(topLikedData || []);
      setProfile(profileData); setIsFollowing(!!followData);
      setFollowerCount(followersRes.count||0); setFollowingCount(followingRes.count||0);
      setFollowingIds(new Set((myFollowingList.data||[]).map((r:any)=>r.following_id)));
      if (!tfError && topFollowersData) {
        const rankIndex = topFollowersData.slice(0, 3).findIndex((u: any) => u.id === pid);
        setFollowerRank(rankIndex !== -1 ? rankIndex + 1 : null);
      }
      if (!tlError && topLikedData) {
        const rankIndex = topLikedData.slice(0, 3).findIndex((u: any) => u.id === pid);
        setLikerRank(rankIndex !== -1 ? rankIndex + 1 : null);
      }
      await loadPostCounts(pid);
    }catch(e:any){ toast.error(e.message); }finally{ setLoading(false); }
  };

  const basePostQuery = (pid: string) => {
    let q = supabase.from("posts").select(POST_SELECT).eq("user_id", pid).order("created_at", { ascending: false });
    if (postFilter === "all") {
      q = q.is("repost_of_id", null); 
    } else if (postFilter === "media") {
      q = q.not("media_urls", "is", null).is("repost_of_id", null);
    } else if (postFilter === "text") {
      q = q.is("media_urls", null).is("repost_of_id", null);
    }
    return q;
  };

  const loadPosts = async (page = 0, reset = false) => {
    if (!profile?.id) return;
    setPostsLoading(true);
    try {
      const from = page * POSTS_PAGE_SIZE, to = from + POSTS_PAGE_SIZE - 1;
      let finalData: any[] = [];
      let finalHasMore = true;

      if (postFilter === "reposts") {

        const { data: quotePosts } = await supabase
          .from("posts")
          .select(POST_SELECT) 
          .eq("user_id", profile.id)
          .not("repost_of_id", "is", null)
          .order("created_at", { ascending: false })
          .range(from, to);

        const { data: simpleReposts } = await supabase
          .from("reposts")
          .select(`
            created_at,
            post:posts!post_id (
              ${POST_SELECT} 
            )
          `)
          .eq("user_id", profile.id)
          .order("created_at", { ascending: false })
          .range(from, to);

        const quotes = quotePosts || [];
        const simples = (simpleReposts || []).map((r: any) => ({
          ...r.post,
          reposted_by_user: profile,
          created_at: r.created_at, 
        }));

        finalData = [...quotes, ...simples]
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, POSTS_PAGE_SIZE); 

        finalHasMore = (quotes.length + simples.length) > 0; 
        
      } else {
        const { data, error } = await basePostQuery(profile.id).range(from, to);
        if (error) throw error;
        finalData = data || [];
        finalHasMore = finalData.length === POSTS_PAGE_SIZE;
      }
      
      setPosts(p => reset ? finalData : [...p, ...finalData]);
      setPostsPage(page);
      setPostsHasMore(finalHasMore);

    } catch (e: any) { toast.error(e.message); } finally { setPostsLoading(false); }
  };

  const refreshPosts=async()=>{ if(!profile?.id) return; await loadPosts(0,true); };

  const handleFollow=async()=> {
    if(!currentUser||!profile) return;
    try{
      if(isFollowing){
        const { error }=await supabase.from("follows").delete().eq("follower_id",currentUser.id).eq("following_id",profile.id);
        if(error) throw error; setIsFollowing(false); setFollowerCount(p=>p-1); setFollowingIds(s=>{ const n=new Set(s); n.delete(profile.id); return n; }); toast.success("Berhenti mengikuti");
      }else{
        const { error }=await supabase.from("follows").insert({ follower_id:currentUser.id,following_id:profile.id });
        if(error) throw error; setIsFollowing(true); setFollowerCount(p=>p+1); setFollowingIds(s=>new Set(s).add(profile.id)); toast.success("Berhasil mengikuti");
      }
    }catch(e:any){ toast.error(e.message); }
  };

  const toggleFollowUser=async(targetId:string)=> {
    if(!currentUser||targetId===currentUser.id) return;
    try{
      if(followingIds.has(targetId)){
        const { error }=await supabase.from("follows").delete().eq("follower_id",currentUser.id).eq("following_id",targetId);
        if(error) throw error; setFollowingIds(s=>{ const n=new Set(s); n.delete(targetId); return n; }); toast.success("Berhenti mengikuti");
      }else{
        const { error }=await supabase.from("follows").insert({ follower_id:currentUser.id,following_id:targetId });
        if(error) throw error; setFollowingIds(s=>new Set(s).add(targetId)); toast.success("Mengikuti");
      }
    }catch(e:any){ toast.error(e.message); }
  };

  const handleStartChat=async()=>{ if(!currentUser||!profile) return; try{ const { data:id,error }=await supabase.rpc("create_direct_conversation",{ target_user_id:profile.id }); if(error) throw error; if(id) navigate(`/chat/${id}`); }catch(e:any){ toast.error("Gagal membuat chat: "+e.message); } };
  const startChatWith=async(targetId:string)=>{ try{ const { data:id,error }=await supabase.rpc("create_direct_conversation",{ target_user_id:targetId }); if(error) throw error; if(id) navigate(`/chat/${id}`); }catch(e:any){ toast.error("Gagal membuat chat: "+e.message); } };

  const openFollowers=async()=>{ if(!profile) return; setDialogSearch(""); setFollowers([]); setFollowersPage(0); setFollowersHasMore(true); setOpenList("followers"); await loadFollowersPage(profile.id,0,true); };
  const openFollowing=async()=>{ if(!profile) return; setDialogSearch(""); setFollowing([]); setFollowingPage(0); setFollowingHasMore(true); setOpenList("following"); await loadFollowingPage(profile.id,0,true); };

  const loadFollowersPage=async(pid:string,page=0,reset=false)=> {
    setListLoading(true);
    try{
      const { data,error }=await supabase.from("follows").select(`follower_id, profiles:follower_id(id,full_name,avatar_url,role)`).eq("following_id",pid).order("created_at",{ascending:false}).range(page*LIST_PAGE_SIZE,page*LIST_PAGE_SIZE+LIST_PAGE_SIZE-1);
      if(error) throw error;
      const rows=(data||[]).map((r:any)=>r.profiles).filter(Boolean);
      setFollowers(prev=>reset?rows:[...prev,...rows]); setFollowersPage(page); setFollowersHasMore(rows.length===LIST_PAGE_SIZE);
    }catch(e:any){ toast.error(e.message); }finally{ setListLoading(false); }
  };

  const loadFollowingPage=async(pid:string,page=0,reset=false)=> {
    setListLoading(true);
    try{
      const { data,error }=await supabase.from("follows").select(`following_id, profiles:following_id(id,full_name,avatar_url,role)`).eq("follower_id",pid).order("created_at",{ascending:false}).range(page*LIST_PAGE_SIZE,page*LIST_PAGE_SIZE+LIST_PAGE_SIZE-1);
      if(error) throw error;
      const rows=(data||[]).map((r:any)=>r.profiles).filter(Boolean);
      setFollowing(prev=>reset?rows:[...prev,...rows]); setFollowingPage(page); setFollowingHasMore(rows.length===LIST_PAGE_SIZE);
    }catch(e:any){ toast.error(e.message); }finally{ setListLoading(false); }
  };

  const listRaw=openList==="followers"?followers:following;
  const list=useMemo(()=>listRaw.filter(u=>u.full_name.toLowerCase().includes(dialogSearch.toLowerCase())),[listRaw,dialogSearch]);

  const onDialogScroll=async(e:React.UIEvent<HTMLDivElement>)=>{ const el=e.currentTarget; const nearBottom=el.scrollTop+el.clientHeight>=el.scrollHeight-48; if(!nearBottom||listLoading||!profile) return; if(openList==="followers"&&followersHasMore) await loadFollowersPage(profile.id,followersPage+1); if(openList==="following"&&followingHasMore) await loadFollowingPage(profile.id,followingPage+1); };

  if(loading) return (<div className="min-h-screen grid place-items-center bg-background"><div className="text-center"><div className="animate-spin h-12 w-12 rounded-full border-b-2 border-accent mx-auto"/><p className="mt-4 text-muted-foreground">Memuat...</p></div></div>);
  if(!profile) return (<div className="min-h-screen grid place-items-center bg-background"><p className="text-muted-foreground">Profil tidak ditemukan</p></div>);

  const isOwnProfile=currentUser?.id===profile.id;
  const canMaximize = !!profile?.avatar_url;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={()=>navigate("/")}><ArrowLeft className="h-5 w-5"/></Button>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Profil</h1>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <Card className="bg-card border-border p-8 mb-6">
          <div className="flex items-start gap-6">
            <button
              type="button"
              onClick={() => { if (canMaximize) setViewerOpen(true); }}
              title={canMaximize ? "Lihat foto ukuran penuh" : "Belum ada foto profil"}
              className={`relative rounded-full focus:outline-none ${canMaximize ? "focus:ring-2 focus:ring-accent/40 cursor-pointer" : "cursor-default"}`}
            >
              <Avatar className="h-24 w-24 border-4 border-accent/20">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                  {getInitials(profile.full_name)}
                </AvatarFallback>
              </Avatar>

              {canMaximize && (
                <span className="absolute -bottom-1.5 -right-1.5 grid place-items-center h-7 w-7 rounded-full bg-card/90 border shadow">
                  <Maximize2 className="h-3.5 w-3.5" />
                </span>
              )}
            </button>

            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl font-bold">{profile.full_name}</h2>
                <RankBadge rank={followerRank} type="follower" />
                <RankBadge rank={likerRank} type="like" />
                <span className={`text-sm px-3 py-1 rounded-full ${getRoleBadgeColor(profile.role)}`}>{profile.role?.[0]?.toUpperCase()+profile.role?.slice(1)}</span>
              </div>
              {profile.bio&&<p className="text-muted-foreground mb-4">{profile.bio}</p>}
              <div className="flex gap-6 mb-4">
                <button onClick={openFollowers} className="text-left"><span className="font-bold">{followerCount}</span><span className="text-muted-foreground ml-1">Pengikut</span></button>
                <button onClick={openFollowing} className="text-left"><span className="font-bold">{followingCount}</span><span className="text-muted-foreground ml-1">Mengikuti</span></button>
              </div>
              <div className="flex gap-2">
                {isOwnProfile?(
                  <Button onClick={()=>navigate("/settings")} className="bg-accent text-accent-foreground hover:bg-accent/90"><Settings className="h-4 w-4 mr-2"/>Edit Profil</Button>
                ):(
                  <>
                    <Button onClick={handleFollow} className={isFollowing?"bg-muted text-foreground hover:bg-muted/80":"bg-accent text-accent-foreground hover:bg-accent/90"}>
                      {isFollowing?(<><UserMinus className="h-4 w-4 mr-2"/>Berhenti Mengikuti</>):(<><UserPlus className="h-4 w-4 mr-2"/>Ikuti</>)}
                    </Button>
                    <Button onClick={handleStartChat} variant="outline" className="border-accent text-accent hover:bg-accent hover:text-accent-foreground"><MessageCircle className="h-4 w-4 mr-2"/>Chat</Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Button variant={postFilter === "all" ? "default" : "outline"} onClick={() => setPostFilter("all")} className="rounded-xl">Postingan ({postCount.all})</Button>
            <Button variant={postFilter==="text"?"default":"outline"} onClick={()=>setPostFilter("text")} className="rounded-xl">Tanpa Media ({postCount.text})</Button>
            <Button variant={postFilter==="media"?"default":"outline"} onClick={()=>setPostFilter("media")} className="rounded-xl">Media ({postCount.media})</Button>
            <Button variant={postFilter === "reposts" ? "default" : "outline"} onClick={() => setPostFilter("reposts")} className="rounded-xl">Reposts ({postCount.reposts})</Button>
          </div>
          {posts.length===0&&postsLoading?(
            <div className="space-y-4"><PostSkeleton/><PostSkeleton/><PostSkeleton/></div>
          ):posts.length===0?(
            <Card className="p-8 text-center"><p className="text-muted-foreground">Belum ada postingan</p></Card>
          ):(
            <>
              {posts.map(p=>(<PostCard key={p.id} post={p} currentUserId={currentUser?.id} 
              //onLike={refreshPosts} 
              onPostUpdated={refreshPosts} onPostDeleted={refreshPosts} postType="global" topFollowers={topFollowers} topLiked={topLiked} />))}
              {postsLoading&&(<div className="space-y-4"><PostSkeleton/></div>)}
              <div ref={loadMoreRef} className="h-6"/>
            </>
          )}
        </div>
      </div>

      <Dialog open={!!openList} onOpenChange={v=>!v&&setOpenList(null)}>
        <DialogContent className="sm:max-w-[500px] max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>{openList==="followers"?"Pengikut":"Mengikuti"}</DialogTitle>
            <DialogDescription className="sr-only">Daftar {openList==="followers"?"pengikut":"akun yang diikuti"}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={dialogSearch} onChange={e=>setDialogSearch(e.target.value)} placeholder={`Cari ${openList==="followers"?"pengikut":"mengikuti"}...`} className="bg-input border-border"/>
            <div className="h-[65vh] overflow-y-auto pr-2" onScroll={onDialogScroll}>
              <div className="space-y-2">
                {listLoading && (openList==="followers"?followers.length===0:following.length===0) ? (
                  <div className="py-10 text-center text-muted-foreground">Memuat...</div>
                ) : list.length===0 ? (
                  <div className="py-8 text-center text-muted-foreground">Tidak ada data</div>
                ) : (
                  list.map(u=>(
                    <div key={u.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/10">
                      <Link to={`/profile/${u.id}`} onClick={()=>setOpenList(null)} className="flex items-center gap-3 min-w-0">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={u.avatar_url||undefined}/>
                          <AvatarFallback className="bg-primary text-primary-foreground font-semibold">{getInitials(u.full_name||"U")}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{u.full_name}</p>
                          <p className="truncate text-xs text-muted-foreground">{u.role}</p>
                        </div>
                      </Link>
                      <div className="ml-auto flex items-center gap-2">
                        {u.id!==currentUser?.id && (followingIds.has(u.id)
                          ? <Button size="sm" onClick={()=>toggleFollowUser(u.id)} className="bg-muted text-foreground hover:bg-muted/80"><UserMinus className="h-4 w-4 mr-1"/>Unfollow</Button>
                          : <Button size="sm" onClick={()=>toggleFollowUser(u.id)} className="bg-accent text-accent-foreground hover:bg-accent/90"><UserPlus className="h-4 w-4 mr-1"/>Follow</Button>
                        )}
                        <Button size="sm" variant="outline" onClick={()=>startChatWith(u.id)} className="border-accent text-accent hover:bg-accent hover:text-accent-foreground"><MessageCircle className="h-4 w-4 mr-1"/>Chat</Button>
                      </div>
                    </div>
                  ))
                )}
                {openList==="followers"&&followersHasMore&&<div className="py-3 text-center text-xs text-muted-foreground">Gulir untuk muat lagi…</div>}
                {openList==="following"&&followingHasMore&&<div className="py-3 text-center text-xs text-muted-foreground">Gulir untuk muat lagi…</div>}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6"><DialogTitle>Foto Profil</DialogTitle></DialogHeader>
          <div className="p-6 pt-0">
            <div className="rounded-xl overflow-hidden border bg-black/5">
              <img src={profile.avatar_url||""} alt="Avatar" className="w-full h-full object-contain max-h-[70vh]" />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Profile;