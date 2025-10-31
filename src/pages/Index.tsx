import { Navbar } from "@/components/Navbar";
import { CreatePost } from "@/components/CreatePost";
import { PostCard } from "@/components/PostCard";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { LeftSidebar } from "@/components/LeftSidebar";
import { RightSidebar } from "@/components/RightSidebar";
import { useInfinitePosts } from "@/hooks/useInfinitePosts";
import { Button } from "@/components/ui/button";

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  const { data: profile, isLoading: isProfileLoading } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, avatar_text, role")
        .eq("id", user.id)
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const {
    posts,
    isLoading: isLoadingPosts,
    isFetchingNextPage,
    hasNextPage,
    loadMore,
  } = useInfinitePosts({
    currentUserId: user?.id ?? null,
    enabled: !!user,
  });

  const isLoading = loading || isProfileLoading || !user || !profile || isLoadingPosts;

  if (isLoading) {
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

          {isLoadingPosts && posts.length === 0 ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentUserName={profile.name}
                currentUserInitials={profile.avatar_text}
                currentUserId={profile.id}
              />
            ))
          )}

          {hasNextPage && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                onClick={loadMore}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? "Memuat..." : "Muat lebih banyak"}
              </Button>
            </div>
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