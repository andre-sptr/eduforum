import React, { useMemo, useState, useRef, useEffect } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Navbar } from "@/components/Navbar";
import { LeftSidebar } from "@/components/LeftSidebar";
import { RightSidebar } from "@/components/RightSidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/UserAvatar";
import { PostCard, PostWithAuthor } from "@/components/PostCard";
import { useAuth } from "@/hooks/useAuth";

type SearchedProfile = {
  id: string;
  name: string;
  bio: string | null;
  avatar_text: string;
  role: string;
};

const PAGE_SIZE = 10;

const InfiniteScrollTrigger: React.FC<{
  onLoadMore: () => void;
  disabled?: boolean;
  rootMargin?: string;
}> = ({ onLoadMore, disabled, rootMargin = "600px 0px" }) => {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (disabled) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMore();
      },
      { rootMargin }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [onLoadMore, disabled, rootMargin]);

  return <div ref={ref} className="h-8" />;
};

export default function SearchPage(): JSX.Element {
  const [searchParams] = useSearchParams();
  const query = (searchParams.get("q") || "").trim();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);

  const { data: currentUserProfile, isLoading: isLoadingMe } = useQuery({
    queryKey: ["me", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, name, avatar_text")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const enabledSearch = !!query && !!user;

  const {
    data: postPages,
    isLoading: isLoadingPosts,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["searchPosts", query],
    enabled: enabledSearch,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const from = pageParam;
      const to = pageParam + PAGE_SIZE - 1;
      const { data, error, count } = await supabase
        .from("posts")
        .select(
          `
          *,
          profiles!user_id(name, avatar_text, role),
          original_author:profiles!original_author_id(name, avatar_text, role)
        `,
          { count: "exact" }
        )
        .ilike("content", `%${query}%`)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;
      const items = (data as PostWithAuthor[]) || [];
      return {
        items,
        nextOffset: from + items.length,
        total: count ?? undefined,
      };
    },
    getNextPageParam: (last, _pages, lastPageParam) => {
      if (!last || last.items.length < PAGE_SIZE) return undefined;
      return lastPageParam + PAGE_SIZE;
    },
    refetchOnWindowFocus: false,
    staleTime: 30_000,
    gcTime: 300_000,
  });

  const posts = useMemo(
    () => (postPages?.pages || []).flatMap((p) => p.items),
    [postPages]
  );

  const { data: users = [], isLoading: isLoadingUsers } = useQuery<SearchedProfile[]>({
    queryKey: ["searchUsers", query],
    enabled: enabledSearch,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, bio, avatar_text, role")
        .ilike("name", `%${query}%`)
        .limit(10);
      if (error) throw error;
      return data || [];
    },
  });

  const startOrGoToChat = async (recipientId: string) => {
    if (!currentUserProfile) return toast.error("Profil tidak ditemukan.");
    if (currentUserProfile.id === recipientId) return toast.info("Anda tidak bisa chat dengan diri sendiri.");
    setLoadingUserId(recipientId);
    try {
      const { data: roomId, error } = await supabase.rpc("create_or_get_chat_room", { recipient_id: recipientId });
      if (error) throw error;
      if (!roomId) throw new Error("Gagal mendapatkan ID room chat.");
      navigate(`/chat/${roomId}`);
    } catch (e: any) {
      toast.error(`Gagal memulai chat: ${e.message}`);
    } finally {
      setLoadingUserId(null);
    }
  };

  if (authLoading || isLoadingMe || !currentUserProfile) {
    return (
      <div className="min-h-screen bg-muted">
        <Navbar />
        <main className="container mx-auto grid grid-cols-10 gap-6 py-6">
          <aside className="col-span-2 hidden md:block">
            <Skeleton className="h-40 w-full rounded-lg" />
          </aside>
          <section className="col-span-10 md:col-span-5 space-y-4">
            <Skeleton className="h-8 w-3/4 mb-4" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </section>
          <aside className="col-span-10 md:col-span-3 hidden md:block">
            <Skeleton className="h-40 w-full rounded-lg" />
            <Skeleton className="h-64 w-full rounded-lg mt-6" />
          </aside>
        </main>
      </div>
    );
  }

  const emptyQuery = query.length === 0;

  return (
    <div className="min-h-screen bg-muted">
      <Navbar userName={currentUserProfile.name} userInitials={currentUserProfile.avatar_text} />
      <main className="container mx-auto grid grid-cols-10 gap-6 py-6">
        <LeftSidebar />

        <section className="col-span-10 md:col-span-5 space-y-4">
          <div>
            <h3 className="text-lg font-medium mb-3 border-b pb-2">Pengguna</h3>
            {emptyQuery ? (
              <p className="text-sm text-muted-foreground">Ketik kata kunci untuk mencari pengguna.</p>
            ) : isLoadingUsers ? (
              <Skeleton className="h-20 w-full" />
            ) : users.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">Tidak ada pengguna ditemukan.</p>
            ) : (
              <Card>
                <CardContent className="p-4 space-y-4">
                  {users.map((profile) => (
                    <div key={profile.id} className="flex items-center justify-between">
                      <Link to={`/profile/name/${encodeURIComponent(profile.name)}`} className="flex items-start gap-3 group">
                        <UserAvatar name={profile.name} initials={profile.avatar_text} />
                        <div className="min-h-[2.5rem]">
                          <div className="flex items-baseline gap-1">
                            <h4 className="font-semibold">{profile.name}</h4>
                            <Badge variant="secondary" className="px-1.5 py-0 text-xs font-medium h-fit">{profile.role}</Badge>
                          </div>
                          {profile.bio ? (
                            <p className="text-xs text-muted-foreground mt-0.5">{profile.bio}</p>
                          ) : (
                            <p className="text-xs text-muted-foreground mt-0.5 italic">Tidak ada bio</p>
                          )}
                        </div>
                      </Link>
                      {profile.id !== currentUserProfile.id && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startOrGoToChat(profile.id)}
                          disabled={loadingUserId === profile.id}
                        >
                          {loadingUserId === profile.id ? "..." : "Chat"}
                        </Button>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          <h2 className="text-lg font-medium mb-3 border-b pb-2">Hasil Pencarian untuk: "{query}"</h2>

          <div className="flex flex-col gap-4">
            {emptyQuery ? (
              <p className="text-sm text-muted-foreground">Masukkan kata kunci untuk mencari postingan.</p>
            ) : isLoadingPosts && !postPages ? (
              <>
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-40 w-full" />
              </>
            ) : posts.length === 0 ? (
              <p className="text-center text-muted-foreground">Tidak ada hasil postingan ditemukan.</p>
            ) : (
              <>
                {posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    currentUserId={currentUserProfile.id}
                    currentUserName={currentUserProfile.name}
                    currentUserInitials={currentUserProfile.avatar_text}
                  />
                ))}

                {isFetchingNextPage && (
                  <>
                    <Skeleton className="h-40 w-full" />
                    <Skeleton className="h-40 w-full" />
                  </>
                )}

                <InfiniteScrollTrigger
                  onLoadMore={() => fetchNextPage()}
                  disabled={!hasNextPage || isFetchingNextPage}
                />

                {hasNextPage && (
                  <div className="flex justify-center">
                    <button
                      className="px-4 py-2 text-sm border rounded-md"
                      onClick={() => fetchNextPage()}
                      disabled={isFetchingNextPage}
                    >
                      {isFetchingNextPage ? "Memuat..." : "Muat lagi"}
                    </button>
                  </div>
                )}
                {!hasNextPage && posts.length > 0 && (
                  <p className="text-center text-sm text-muted-foreground py-2">Sudah semua hasil.</p>
                )}
              </>
            )}
          </div>
        </section>

        <RightSidebar />
      </main>

      <footer className="border-t py-4 bg-muted/30">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground">
            <a href="https://flamyheart.site" target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline underline-offset-4">
              © {new Date().getFullYear()} Andre Saputra
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
