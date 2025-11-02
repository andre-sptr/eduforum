import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Home, User, Users, MessageCircle, Gamepad2, LogOut, Search } from "lucide-react";
import CreatePost from "@/components/CreatePost";
import PostCard from "@/components/PostCard";
import PostSkeleton from "@/components/PostSkeleton";
import Leaderboard from "@/components/Leaderboard";
import { Notifications } from "@/components/Notifications";
import { ChatNotifications } from "@/components/ChatNotifications";
import { ThemeToggle } from "@/components/ThemeToggle";
import { toast } from "sonner";

const Index = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [topFollowers, setTopFollowers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isScrolled, setIsScrolled] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const observerTarget = useRef(null);

  useEffect(() => {
    checkUser();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        navigate('/auth');
      } else if (event === 'SIGNED_IN' && session) {
        setUser(session.user);
        loadUserData(session.user.id);
      }
    });

    // Scroll event for navbar transparency
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Setup realtime subscription for posts
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('posts-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'posts'
        },
        () => {
          // Refresh posts when any change happens
          loadPosts(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      navigate('/auth');
      return;
    }

    setUser(user);
    await loadUserData(user.id);
  };

  const loadUserData = async (userId: string) => {
    try {
      // Load profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      // Load posts
      await loadPosts();

      // Load top followers
      await loadTopFollowers();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadPosts = async (reset = false) => {
    const currentOffset = reset ? 0 : offset;
    
    // Load posts with pagination
    const { data: postsData, error } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })
      .range(currentOffset, currentOffset + 9);

    if (error) {
      toast.error(error.message);
      return;
    }

    if (!postsData || postsData.length === 0) {
      if (reset) {
        setPosts([]);
      }
      setHasMore(false);
      return;
    }

    setHasMore(postsData.length === 10);

    // Get unique user IDs
    const userIds = [...new Set(postsData.map(p => p.user_id))];

    // Fetch profiles
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, role')
      .in('id', userIds);

    // Fetch likes
    const postIds = postsData.map(p => p.id);
    const { data: likesData } = await supabase
      .from('likes')
      .select('post_id, user_id')
      .in('post_id', postIds);

    // Map data
    const profilesMap = new Map(
      (profilesData || []).map(p => [p.id, p])
    );

    const likesMap = new Map<string, any[]>();
    (likesData || []).forEach(like => {
      if (!likesMap.has(like.post_id)) {
        likesMap.set(like.post_id, []);
      }
      likesMap.get(like.post_id)!.push(like);
    });

    const postsWithData = postsData.map(post => ({
      ...post,
      profiles: profilesMap.get(post.user_id),
      likes: likesMap.get(post.id) || []
    }));

    if (reset) {
      setPosts(postsWithData);
      setOffset(10);
    } else {
      setPosts(prev => [...prev, ...postsWithData]);
      setOffset(currentOffset + 10);
    }
  };

  const loadMorePosts = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    
    setLoadingMore(true);
    await loadPosts(false);
    setLoadingMore(false);
  }, [loadingMore, hasMore, offset]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          loadMorePosts();
        }
      },
      { threshold: 1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loadingMore, loadMorePosts]);

  const refreshPosts = async () => {
    setOffset(0);
    setHasMore(true);
    await loadPosts(true);
  };

  const loadTopFollowers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        avatar_url,
        follows:follows!follows_following_id_fkey(count)
      `)
      .limit(5);

    if (error) {
      toast.error(error.message);
      return;
    }

    const sortedUsers = (data || [])
      .map(user => ({
        ...user,
        follower_count: user.follows[0]?.count || 0
      }))
      .sort((a, b) => b.follower_count - a.follower_count)
      .slice(0, 5);

    setTopFollowers(sortedUsers);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Memuat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className={`sticky top-0 z-50 border-b border-border shadow-lg transition-all duration-300 ${
        isScrolled 
          ? 'bg-card/80 backdrop-blur-md' 
          : 'bg-card'
      }`}>
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent whitespace-nowrap">
              EduForum MAN IC Siak
            </h1>
            
            <form onSubmit={handleSearch} className="flex-1 max-w-md mx-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Cari postingan atau user..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </form>

            <div className="flex items-center gap-2">
              {user && (
                <>
                  <ChatNotifications userId={user.id} />
                  <Notifications userId={user.id} />
                </>
              )}
              <ThemeToggle />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-muted-foreground hover:text-accent"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Keluar
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Sidebar - Navigation */}
          <aside className="lg:col-span-3">
            <nav className="sticky top-24 space-y-2">
              <Button variant="ghost" className="w-full justify-start gap-3 text-accent">
                <Home className="h-5 w-5" />
                Beranda
              </Button>
              <Button 
                variant="ghost" 
                className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
                onClick={() => navigate('/profile')}
              >
                <User className="h-5 w-5" />
                Profil
              </Button>
              <Button 
                variant="ghost" 
                className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
                onClick={() => navigate('/groups')}
              >
                <Users className="h-5 w-5" />
                Grup
              </Button>
              <Button 
                variant="ghost" 
                className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
                onClick={() => navigate('/messages')}
              >
                <MessageCircle className="h-5 w-5" />
                Pesan
              </Button>
              <Button 
                variant="ghost" 
                className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
                onClick={() => navigate('/games')}
              >
                <Gamepad2 className="h-5 w-5" />
                Games
              </Button>
            </nav>
          </aside>

          {/* Center - Feed */}
          <main className="lg:col-span-6 space-y-6">
            {profile && (
              <CreatePost
                currentUser={profile}
                onPostCreated={refreshPosts}
              />
            )}

            <div className="space-y-4">
              {loading ? (
                // Show skeleton loaders while loading
                <>
                  <PostSkeleton />
                  <PostSkeleton />
                  <PostSkeleton />
                </>
              ) : posts.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">Belum ada postingan</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Buat postingan pertama Anda!
                  </p>
                </div>
              ) : (
                <>
                  {posts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      currentUserId={user?.id}
                      onLike={refreshPosts}
                      onPostUpdated={refreshPosts}
                      onPostDeleted={refreshPosts}
                    />
                  ))}
                  
                  {/* Infinite scroll trigger */}
                  <div ref={observerTarget} className="py-4 text-center">
                    {loadingMore && (
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent"></div>
                        <p className="text-muted-foreground text-sm">Memuat lebih banyak...</p>
                      </div>
                    )}
                    {!hasMore && posts.length > 0 && (
                      <p className="text-muted-foreground text-sm">Tidak ada postingan lagi</p>
                    )}
                  </div>
                </>
              )}
            </div>
          </main>

          {/* Right Sidebar - Leaderboard */}
          <aside className="lg:col-span-3">
            <div className="sticky top-24">
              <Leaderboard users={topFollowers} />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default Index;
