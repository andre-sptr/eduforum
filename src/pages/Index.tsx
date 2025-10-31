// src/pages/Index.tsx
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navbar } from "@/components/Navbar";
import { LeftSidebar } from "@/components/LeftSidebar";
import { RightSidebar } from "@/components/RightSidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { PostCard } from "@/components/PostCard";
import { InfiniteScrollTrigger } from "@/components/InfiniteScrollTrigger";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useInfinitePosts } from "@/hooks/useInfinitePosts";

type Profile = {
  id: string;
  name: string;
  username: string;
  avatar_text: string;
  role?: string | null;
  bio?: string | null;
};

export default function Index(): JSX.Element {
  const { user } = useAuth();

  const { data: currentUserProfile } = useQuery<Profile | null>({
    queryKey: ["currentUserProfile", user?.id],
    enabled: !!user,
    staleTime: 60000,
    gcTime: 300000,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id,name,username,avatar_text,role,bio").eq("id", user!.id).single();
      if (error) throw error;
      return data;
    },
  });

  const {
    posts,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfinitePosts({});

  const orderedPosts = useMemo(() => posts, [posts]);

  return (
    <div className="min-h-screen bg-muted">
      <Navbar userName={currentUserProfile?.name} userInitials={currentUserProfile?.avatar_text} />
      <main className="container mx-auto grid grid-cols-10 gap-6 py-6">
        <LeftSidebar />
        <section className="col-span-10 md:col-span-5 space-y-4">
          {isLoading && (
            <>
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-64 w-full" />
            </>
          )}
          {!isLoading && orderedPosts.length === 0 && (
            <p className="text-sm text-muted-foreground text-center">Belum ada postingan.</p>
          )}
          {orderedPosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={currentUserProfile?.id || ""}
              currentUserName={currentUserProfile?.name || ""}
              currentUserInitials={currentUserProfile?.avatar_text || ""}
            />
          ))}
          <InfiniteScrollTrigger onLoadMore={() => fetchNextPage()} disabled={!hasNextPage || isFetchingNextPage} />
          {hasNextPage && (
            <div className="flex justify-center">
              <Button onClick={() => fetchNextPage()} disabled={isFetchingNextPage} variant="outline" size="sm">
                {isFetchingNextPage ? "Memuat..." : "Muat lagi"}
              </Button>
            </div>
          )}
          {!hasNextPage && !isLoading && orderedPosts.length > 0 && (
            <p className="text-center text-sm text-muted-foreground py-2">Tidak ada postingan lagi.</p>
          )}
        </section>
        <RightSidebar />
      </main>
    </div>
  );
}
