import { Navbar } from "@/components/Navbar";
import { CreatePost } from "@/components/CreatePost";
import { PostCard, PostWithAuthor } from "@/components/PostCard";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { LeftSidebar } from "@/components/LeftSidebar";
import { RightSidebar } from "@/components/RightSidebar";
import { useInfinitePosts } from "@/hooks/useInfinitePosts";
import { InfiniteScrollTrigger } from "@/components/InfiniteScrollTrigger";
import { Button } from "@/components/ui/button";
import { ArrowUp } from "lucide-react";

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [hasNewPosts, setHasNewPosts] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      return data;
    },
    enabled: !!user,
  });

  const { 
    posts, 
    isLoading, 
    hasNextPage, 
    isFetchingNextPage, 
    loadMore,
    refetch,
    isRefetching
  } = useInfinitePosts({
    currentUserId: user?.id,
    enabled: !!user,
    pageSize: 10
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('public:posts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' },
        (payload) => {
          if (payload.new.user_id !== user.id) {
            setHasNewPosts(true);
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // --- PERBAIKAN: Pindahkan useMemo ke atas, sebelum 'if' ---
  const uniquePostArray = useMemo(() => {
    const uniquePosts = new Map(posts.map(post => [post.id, post]));
    return Array.from(uniquePosts.values());
  }, [posts]);

  const handleRefetch = () => {
    setHasNewPosts(false);
    refetch();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading || !user || !profile) {
    return (
      <div className="min-h-screen bg-muted">
        <Navbar />
        <main className="container mx-auto grid grid-cols-10 gap-6 py-6">
          <aside className="col-span-2 hidden md:block">
            <Skeleton className="h-40 w-full rounded-lg" />
          </aside>
          <section className="col-span-10 md:col-span-5 space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </section>
          <aside className="col-span-10 md:col-span-3 hidden md:block">
            <Skeleton className="h-40 w-full rounded-lg" />
          </aside>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted">
      <Navbar userName={profile.name} userInitials={profile.avatar_text} />
      <main className="container mx-auto grid grid-cols-10 gap-6 py-6">
        <LeftSidebar />
        <section className="col-span-10 md:col-span-5 space-y-4">
          <CreatePost userName={profile.name} userInitials={profile.avatar_text} />
          {hasNewPosts && (
            <div className="flex justify-center sticky top-20 z-10">
              <Button
                variant="default"
                size="sm"
                onClick={handleRefetch}
                disabled={isRefetching || isLoading}
                className="shadow-lg rounded-full"
              >
                <ArrowUp className="h-4 w-4 mr-2" />
                Lihat Postingan Baru
              </Button>
            </div>
          )}
          {isLoading && (
            <Skeleton className="h-64 w-full" />
          )}
          {uniquePostArray.map((post) => (
            <PostCard 
              key={post.id} 
              post={post as PostWithAuthor} 
              currentUserName={profile.name} 
              currentUserInitials={profile.avatar_text} 
              currentUserId={profile.id}
            />
          ))}
          <InfiniteScrollTrigger
            onLoadMore={loadMore}
            disabled={!hasNextPage || isFetchingNextPage}
          />
          {isFetchingNextPage && (
            <Skeleton className="h-64 w-full" />
          )}
          {!hasNextPage && !isLoading && (
            <p className="text-center text-muted-foreground py-4">
              Anda telah mencapai akhir.
            </p>
          )}
        </section>
        <RightSidebar />
      </main>
      <footer className="border-t py-4 bg-muted/30">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground">
            <a
              href="https://flamyheart.site"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary hover:underline underline-offset-4"
            >
              © {new Date().getFullYear()} Andre Saputra
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;