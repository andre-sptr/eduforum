
import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import CreatePost from "@/components/CreatePost";
import PostCard from "@/components/PostCard";
import PostSkeleton from "@/components/PostSkeleton";
import { toast } from "sonner";
import { StoryReel } from "@/components/StoryReel";
import { useLeaderboardData } from "@/hooks/useLeaderboardData";

const Feed = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const { topFollowers, topLiked } = useLeaderboardData();
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

  const loadUserData = useCallback(async (userId: string) => {
    try {
      const { data: profileData, error: profileError } = await supabase.from("profiles").select("*").eq("id", userId).single();
      if (profileError) throw profileError;
      setProfile(profileData);
      await loadPosts(true);
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  }, []);

  const loadPosts = useCallback(async (reset = false) => {
    const currentOffset = reset ? 0 : offset;
    const { data: postsData, error } = await supabase
      .from("posts")
      .select(`
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
      `)
      .order("created_at", { ascending: false })
      .range(currentOffset, currentOffset + 9);
    if (error) { toast.error(error.message); return; }
    if (!postsData || postsData.length === 0) { if (reset) setPosts([]); setHasMore(false); return; }
    setHasMore(postsData.length === 10);
    if (reset) { setPosts(postsData); setOffset(10); }
    else {
      setPosts(prev => { const map = new Map(prev.map(p => [p.id, p])); postsData.forEach(p => map.set(p.id, p)); return Array.from(map.values()); });
      setOffset(currentOffset + 10);
    }
  }, [offset]);

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

  if (loading) return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-b from-background to-muted/40">
      <div className="text-center rounded-2xl bg-card p-8 shadow-2xl">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto" />
        <p className="mt-4 text-muted-foreground">Memuat...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {profile && <StoryReel currentUser={profile} />}
      
      {profile && <div className="rounded-2xl bg-card shadow-xl border border-border p-2"><CreatePost currentUser={profile} onPostCreated={refreshPosts} /></div>}
      <div className="rounded-2xl bg-card shadow-xl border border-border">
        <div className="p-3 sm:p-4 space-y-4">
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
                  
                  onPostUpdated={refreshPosts}
                  onPostDeleted={refreshPosts}
                  topFollowers={topFollowers}
                  topLiked={topLiked}
                  postType="global"
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
    </div>
  );
};

export default Feed;