
import { useEffect,useMemo,useRef,useState } from "react";
import { useNavigate,useParams,Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar,AvatarFallback,AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Settings, UserPlus, UserMinus, MessageCircle, Maximize2, Heart, Trophy, LogOut } from "lucide-react";
import { toast } from "sonner";
import PostCard from "@/components/PostCard";
import PostSkeleton from "@/components/PostSkeleton";
import { Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle } from "@/components/ui/dialog";
import { useLeaderboardData } from "@/hooks/useLeaderboardData";

type PostFilter = "all" | "reposts" | "media" | "text";
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
  const { topFollowers, topLiked } = useLeaderboardData();

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
      const [{ data:profileData,error:pe },{ data:followData },followersRes,followingRes,myFollowingList]=await Promise.all([
        supabase.from("profiles").select("*").eq("id",pid).single(),
        pid!==user.id?supabase.from("follows").select("*").eq("follower_id",user.id).eq("following_id",pid).maybeSingle():Promise.resolve({ data:null }),
        supabase.from("follows").select("*",{ count:"exact",head:true }).eq("following_id",pid),
        supabase.from("follows").select("*",{ count:"exact",head:true }).eq("follower_id",pid),
        supabase.from("follows").select("following_id").eq("follower_id",user.id),
      ]);
      if(pe) throw pe;
      
      setProfile(profileData); setIsFollowing(!!followData);
      setFollowerCount(followersRes.count||0); setFollowingCount(followingRes.count||0);
      setFollowingIds(new Set((myFollowingList.data||[]).map((r:any)=>r.following_id)));
      if (topFollowers.length > 0) {
        const rankIndex = topFollowers.slice(0, 3).findIndex((u: any) => u.id === pid);
        setFollowerRank(rankIndex !== -1 ? rankIndex + 1 : null);
      }
      if (topLiked.length > 0) {
        const rankIndex = topLiked.slice(0, 3).findIndex((u: any) => u.id === pid);
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <div className="space-y-8 pb-20">
      <Card className="border-white/10 bg-card/40 backdrop-blur-xl p-8 rounded-3xl overflow-hidden relative shadow-xl">
          {}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />
          
          {isOwnProfile && (
            <div className="absolute top-4 right-4 flex gap-2 z-20">
              <Button variant="ghost" size="icon" onClick={() => navigate("/settings")} className="rounded-xl hover:bg-white/10 text-muted-foreground hover:text-foreground"><Settings className="h-5 w-5" /></Button>
              <Button variant="ghost" size="icon" onClick={handleLogout} className="rounded-xl text-destructive hover:bg-destructive/10"><LogOut className="h-5 w-5" /></Button>
            </div>
          )}
          
          <div className="flex flex-col md:flex-row items-center md:items-start gap-8 relative z-10">
            <button
              type="button"
              onClick={() => { if (canMaximize) setViewerOpen(true); }}
              title={canMaximize ? "Lihat foto ukuran penuh" : "Belum ada foto profil"}
              className={`relative group rounded-full focus:outline-none ${canMaximize ? "cursor-zoom-in" : "cursor-default"}`}
            >
              <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <Avatar className="h-32 w-32 border-4 border-card/50 shadow-2xl relative z-10 ring-4 ring-white/5">
                <AvatarImage src={profile.avatar_url || undefined} className="object-cover" />
                <AvatarFallback className="text-4xl bg-gradient-to-br from-primary to-accent text-primary-foreground font-bold">
                  {getInitials(profile.full_name)}
                </AvatarFallback>
              </Avatar>
              {canMaximize && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                  <Maximize2 className="h-8 w-8 text-white drop-shadow-md" />
                </div>
              )}
            </button>

            <div className="flex-1 text-center md:text-left space-y-5">
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">{profile.full_name}</h1>
                <div className="flex items-center justify-center md:justify-start gap-2 mt-2">
                  <span className={`capitalize px-2.5 py-0.5 rounded-full text-xs font-medium border border-white/5 shadow-sm ${getRoleBadgeColor(profile.role)}`}>{profile.role?.[0]?.toUpperCase()+profile.role?.slice(1)}</span>
                </div>
              </div>

              {profile.bio && (
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-lg mx-auto md:mx-0 bg-muted/20 p-3 rounded-xl border border-white/5 backdrop-blur-sm">
                      {profile.bio}
                  </p>
              )}

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                 <div className="flex items-center gap-2 bg-muted/30 px-3 py-1.5 rounded-xl border border-white/10 backdrop-blur-sm">
                    <Trophy className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm font-medium">{followerRank ? `#${followerRank} Follower` : "-"}</span>
                 </div>
                 <div className="flex items-center gap-2 bg-muted/30 px-3 py-1.5 rounded-xl border border-white/10 backdrop-blur-sm">
                    <Heart className="h-4 w-4 text-red-500" />
                    <span className="text-sm font-medium">{likerRank ? `#${likerRank} Liked` : "-"}</span>
                 </div>
              </div>

              <div className="flex items-center justify-center md:justify-start gap-8 py-2">
                <button onClick={openFollowers} className="group text-center md:text-left transition-all hover:scale-105">
                  <p className="font-bold text-xl group-hover:text-primary transition-colors">{followerCount}</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Pengikut</p>
                </button>
                <button onClick={openFollowing} className="group text-center md:text-left transition-all hover:scale-105">
                  <p className="font-bold text-xl group-hover:text-primary transition-colors">{followingCount}</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Mengikuti</p>
                </button>
                <div className="text-center md:text-left">
                  <p className="font-bold text-xl">{postCount.all}</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Postingan</p>
                </div>
              </div>

              <div className="flex items-center justify-center md:justify-start gap-3 pt-2">
                {isOwnProfile ? (
                   <Button onClick={()=>navigate("/settings")} className="rounded-xl shadow-lg shadow-primary/20 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-6 font-medium transition-all hover:scale-105">
                       <Settings className="h-4 w-4 mr-2"/>Edit Profil
                   </Button>
                ) : (
                  <>
                    <Button 
                      onClick={handleFollow} 
                      className={isFollowing 
                        ? "rounded-xl bg-muted/50 text-foreground hover:bg-destructive hover:text-destructive-foreground border border-white/10 h-10 px-6 font-medium transition-all" 
                        : "rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 h-10 px-6 font-medium transition-all hover:scale-105"
                      }
                    >
                      {isFollowing ? <UserMinus className="mr-2 h-4 w-4" /> : <UserPlus className="mr-2 h-4 w-4" />}
                      {isFollowing ? "Berhenti Mengikuti" : "Ikuti"}
                    </Button>
                    <Button variant="outline" className="rounded-xl border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 h-10 px-6 font-medium transition-all" onClick={handleStartChat}>
                      <MessageCircle className="mr-2 h-4 w-4" /> Pesan
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
      </Card>

        <div className="space-y-6">
          <div className="flex items-center gap-2 p-1 bg-muted/30 backdrop-blur-sm rounded-2xl w-fit border border-white/5 overflow-x-auto max-w-full no-scrollbar">
            <Button variant={postFilter === "all" ? "default" : "ghost"} onClick={() => setPostFilter("all")} className={`rounded-xl h-9 px-4 text-sm ${postFilter === "all" ? "shadow-md" : "hover:bg-white/5"}`}>Postingan ({postCount.all})</Button>
            <Button variant={postFilter==="text"?"default":"ghost"} onClick={()=>setPostFilter("text")} className={`rounded-xl h-9 px-4 text-sm ${postFilter === "text" ? "shadow-md" : "hover:bg-white/5"}`}>Tanpa Media ({postCount.text})</Button>
            <Button variant={postFilter==="media"?"default":"ghost"} onClick={()=>setPostFilter("media")} className={`rounded-xl h-9 px-4 text-sm ${postFilter === "media" ? "shadow-md" : "hover:bg-white/5"}`}>Media ({postCount.media})</Button>
            <Button variant={postFilter === "reposts" ? "default" : "ghost"} onClick={() => setPostFilter("reposts")} className={`rounded-xl h-9 px-4 text-sm ${postFilter === "reposts" ? "shadow-md" : "hover:bg-white/5"}`}>Reposts ({postCount.reposts})</Button>
          </div>
          
          {posts.length===0&&postsLoading?(
            <div className="space-y-4"><PostSkeleton/><PostSkeleton/><PostSkeleton/></div>
          ):posts.length===0?(
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground bg-card/20 backdrop-blur-sm rounded-3xl border border-dashed border-white/10">
                <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mb-4">
                    <MessageCircle className="h-8 w-8 opacity-50" />
                </div>
                <p className="text-lg font-medium">Belum ada postingan</p>
            </div>
          ):(
            <div className="space-y-4">
              {posts.map(p=>(<PostCard key={p.id} post={p} currentUserId={currentUser?.id} 
              
              onPostUpdated={refreshPosts} onPostDeleted={refreshPosts} postType="global" topFollowers={topFollowers} topLiked={topLiked} />))}
              {postsLoading&&(<div className="space-y-4"><PostSkeleton/></div>)}
              <div ref={loadMoreRef} className="h-6"/>
            </div>
          )}
        </div>

      <Dialog open={!!openList} onOpenChange={v=>!v&&setOpenList(null)}>
        <DialogContent className="sm:max-w-[500px] max-h-[85vh] bg-card/95 backdrop-blur-xl border-white/10">
          <DialogHeader>
            <DialogTitle>{openList==="followers"?"Pengikut":"Mengikuti"}</DialogTitle>
            <DialogDescription className="sr-only">Daftar {openList==="followers"?"pengikut":"akun yang diikuti"}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Input value={dialogSearch} onChange={e=>setDialogSearch(e.target.value)} placeholder={`Cari ${openList==="followers"?"pengikut":"mengikuti"}...`} className="bg-muted/50 border-white/10 rounded-xl"/>
            <div className="h-[60vh] overflow-y-auto pr-2 custom-scrollbar" onScroll={onDialogScroll}>
              <div className="space-y-2">
                {listLoading && (openList==="followers"?followers.length===0:following.length===0) ? (
                  <div className="py-10 text-center text-muted-foreground">Memuat...</div>
                ) : list.length===0 ? (
                  <div className="py-8 text-center text-muted-foreground">Tidak ada data</div>
                ) : (
                  list.map(u=>(
                    <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 border border-transparent hover:border-white/5 transition-all">
                      <Link to={`/profile/${u.id}`} onClick={()=>setOpenList(null)} className="flex items-center gap-3 min-w-0">
                        <Avatar className="h-10 w-10 ring-2 ring-white/10">
                          <AvatarImage src={u.avatar_url||undefined}/>
                          <AvatarFallback className="bg-primary text-primary-foreground font-semibold">{getInitials(u.full_name||"U")}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{u.full_name}</p>
                          <p className="truncate text-xs text-muted-foreground capitalize">{u.role}</p>
                        </div>
                      </Link>
                      <div className="ml-auto flex items-center gap-2">
                        {u.id!==currentUser?.id && (followingIds.has(u.id)
                          ? <Button size="sm" onClick={()=>toggleFollowUser(u.id)} className="rounded-lg bg-muted text-foreground hover:bg-destructive hover:text-destructive-foreground border border-white/10"><UserMinus className="h-4 w-4 mr-1"/>Unfollow</Button>
                          : <Button size="sm" onClick={()=>toggleFollowUser(u.id)} className="rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"><UserPlus className="h-4 w-4 mr-1"/>Follow</Button>
                        )}
                        <Button size="sm" variant="outline" onClick={()=>startChatWith(u.id)} className="rounded-lg border-white/10 bg-white/5 hover:bg-white/10"><MessageCircle className="h-4 w-4 mr-1"/>Chat</Button>
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
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-transparent border-none shadow-none">
          <DialogHeader className="sr-only">
            <DialogTitle>Foto Profil</DialogTitle>
            <DialogDescription>Foto profil ukuran penuh</DialogDescription>
          </DialogHeader>
          <div className="relative flex items-center justify-center" onClick={() => setViewerOpen(false)}>
            <div className="relative rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/20 bg-black/50 backdrop-blur-sm p-1" onClick={e => e.stopPropagation()}>
              <img src={profile.avatar_url||""} alt="Avatar" className="max-w-[90vw] max-h-[80vh] object-contain rounded-xl" />
              <Button size="icon" variant="ghost" className="absolute top-2 right-2 text-white hover:bg-black/40 rounded-full" onClick={() => setViewerOpen(false)}>
                  <div className="sr-only">Close</div>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Profile;