// src/pages/Index.tsx
import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Home, User, Users, MessageCircle, Gamepad2 } from "lucide-react";
import CreatePost from "@/components/CreatePost";
import PostCard from "@/components/PostCard";
import PostSkeleton from "@/components/PostSkeleton";
import Leaderboard from "@/components/Leaderboard";
import { toast } from "sonner";

const postSelect =
  `
  id, content, created_at, updated_at, media_urls, media_types, user_id,
  profiles ( id, full_name, avatar_url, role ),
  likes ( user_id, post_id ),
  quoted_post:repost_of_id (
    id, content, created_at,
    profiles ( id, full_name, avatar_url, role )
  )
`.trim();

const Index = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [topFollowers, setTopFollowers] = useState<any[]>([]);
  const [topLiked, setTopLiked] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const observerTarget = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      setUser(user);
      await loadUserData(user.id);
    };
    checkUser();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") navigate("/auth");
      else if (event === "SIGNED_IN" && session) { setUser(session.user); loadUserData(session.user.id); }
    });
    return () => { subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("posts-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () => loadPosts(true))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const loadUserData = useCallback(async (userId: string) => {
    try {
      const { data: profileData, error: profileError } = await supabase.from("profiles").select("*").eq("id", userId).single();
      if (profileError) throw profileError;
      setProfile(profileData);
      await loadPosts(true);
      await loadTopFollowers();
      await loadTopLiked();
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  }, []);

  const loadPosts = useCallback(async (reset = false) => {
    const currentOffset = reset ? 0 : offset;
    const { data: postsData, error } = await supabase
      .from("posts")
      .select(`
        id, content, created_at, media_urls, media_types, user_id,
        profiles:profiles!user_id ( id, full_name, avatar_url, role ),
        likes ( user_id, post_id ),
        reposts ( count ),
        quote_reposts:posts!repost_of_id ( count ),
        quoted_post:repost_of_id (
          id, content, created_at, user_id,
          profiles:profiles!user_id ( id, full_name, avatar_url, role )
        )
      `)
      .order("created_at", { ascending: false })
      .range(currentOffset, currentOffset + 9);
    if (error) { toast.error(error.message); return; }
    if (!postsData || postsData.length === 0) { if (reset) setPosts([]); setHasMore(false); return; }
    setHasMore(postsData.length === 10);
    const postsWithData = postsData;
    if (reset) { setPosts(postsData); setOffset(10); }
    else {
      setPosts(prev => { const map = new Map(prev.map(p => [p.id, p])); postsData.forEach(p => map.set(p.id, p)); return Array.from(map.values()); });
      setOffset(currentOffset + 10);
    }
  }, [offset]);

  const refreshOnePost = useCallback(async (postId: string) => {
    try {
      const { data: p, error } = await supabase
        .from("posts")
        .select(`
          id, content, created_at, media_urls, media_types, user_id,
          profiles:profiles!user_id ( id, full_name, avatar_url, role ),
          likes ( user_id, post_id ),
          reposts ( count ),
          quote_reposts:posts!repost_of_id ( count ),
          quoted_post:repost_of_id (
            id, content, created_at, user_id,
            profiles:profiles!user_id ( id, full_name, avatar_url, role )
          )
        `)
        .eq("id", postId)
        .single();
      if (error) throw error;
      if (p) setPosts(prev => prev.map(x => x.id === postId ? p : x));
    } catch {}
  }, []);

  const loadMorePosts = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    if (observerRef.current && observerTarget.current) observerRef.current.unobserve(observerTarget.current);
    await loadPosts(false);
    setLoadingMore(false);
    if (observerRef.current && observerTarget.current) observerRef.current.observe(observerTarget.current);
  }, [loadingMore, hasMore, offset, loadPosts]);

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting && hasMore && !loadingMore) loadMorePosts(); },
      { root: null, rootMargin: "0px 0px 1000px 0px", threshold: 0 }
    );
    const el = observerTarget.current;
    if (el) observerRef.current.observe(el);
    return () => observerRef.current?.disconnect();
  }, [hasMore, loadMorePosts, loadingMore]);

  useEffect(() => {
    const ensureFill = () => {
      const docH = document.documentElement.scrollHeight;
      const winH = window.innerHeight;
      if (docH - winH < 200 && hasMore && !loadingMore) loadMorePosts();
    };
    ensureFill();
  }, [posts, hasMore, loadingMore, loadMorePosts]);

  const refreshPosts = useCallback(async () => { setOffset(0); setHasMore(true); await loadPosts(true); }, [loadPosts]);
  const loadTopFollowers = useCallback(async () => { const { data, error } = await supabase.rpc("get_top_5_followers"); if (error) { toast.error(error.message); return; } setTopFollowers(data || []); }, []);
  const loadTopLiked = async () => {
    const { data, error } = await supabase.rpc("get_top_5_liked_users");
    if (error) { 
      toast.error(error.message); 
      return; 
    }
    setTopLiked(data || []);
  };

  if (loading) return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-b from-background to-muted/40">
      <div className="text-center rounded-2xl bg-card p-8 shadow-2xl">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto" />
        <p className="mt-4 text-muted-foreground">Memuat...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/40">
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <aside className="lg:col-span-3">
            <nav className="sticky top-24 space-y-2">
              <Button variant="ghost" className="w-full justify-start gap-3 rounded-xl bg-card hover:bg-card shadow-sm text-accent"><Home className="h-5 w-5" />Beranda</Button>
              <Button variant="ghost" className="w-full justify-start gap-3 rounded-xl hover:bg-card text-muted-foreground hover:text-foreground" onClick={() => navigate("/profile")}><User className="h-5 w-5" />Profil</Button>
              <Button variant="ghost" className="w-full justify-start gap-3 rounded-xl hover:bg-card text-muted-foreground hover:text-foreground" onClick={() => navigate("/groups")}><Users className="h-5 w-5" />Grup</Button>
              <Button variant="ghost" className="w-full justify-start gap-3 rounded-xl hover:bg-card text-muted-foreground hover:text-foreground" onClick={() => navigate("/messages")}><MessageCircle className="h-5 w-5" />Pesan</Button>
              <Button variant="ghost" className="w-full justify-start gap-3 rounded-xl hover:bg-card text-muted-foreground hover:text-foreground" onClick={() => navigate("/games")}><Gamepad2 className="h-5 w-5" />Games</Button>
            </nav>
          </aside>

          <main className="lg:col-span-6 space-y-6">
            {profile && <div className="rounded-2xl bg-card shadow-xl border border-border p-2"><CreatePost currentUser={profile} onPostCreated={refreshPosts} /></div>}
            <div className="rounded-2xl bg-card shadow-xl border border-border">
              <div className="p-4 space-y-4">
                {loading ? (
                  <>
                    <PostSkeleton /><PostSkeleton /><PostSkeleton />
                  </>
                ) : posts.length === 0 ? (
                  <div className="text-center py-12"><p className="text-muted-foreground">Belum ada postingan</p></div>
                ) : (
                  <>
                    {posts.map(post => (
                      <PostCard
                        key={`${post.id}-${post.created_at}`}
                        post={post}
                        currentUserId={user?.id}
                        onLike={() => refreshOnePost(post.id)}
                        onPostUpdated={refreshPosts}
                        onPostDeleted={refreshPosts}
                        topFollowers={topFollowers}
                        topLiked={topLiked}
                      />
                    ))}
                    <div ref={observerTarget} className="h-8" />
                    {loadingMore && (<div className="py-4 text-center"><div className="mx-auto h-6 w-6 animate-spin rounded-full border-b-2 border-accent" /></div>)}
                    {hasMore && !loadingMore && (<div className="py-3 text-center"><Button onClick={loadMorePosts} className="rounded-xl px-6">Muat lagi</Button></div>)}
                    {!hasMore && posts.length > 0 && (<p className="text-center text-muted-foreground text-sm">Tidak ada postingan lagi</p>)}
                  </>
                )}
              </div>
            </div>
          </main>

          <aside className="lg:col-span-3">
            <div className="rounded-2xl bg-card shadow-xl border border-border p-2">
              <Leaderboard users={topFollowers} likedUsers={topLiked} />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default Index;