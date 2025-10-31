// src/pages/UserProfilePage.tsx
import { Link, useParams, useNavigate } from "react-router-dom";
import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { LeftSidebar } from "@/components/LeftSidebar";
import { RightSidebar } from "@/components/RightSidebar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PostCard } from "@/components/PostCard";
import { useAuth } from "@/hooks/useAuth";
import { useInfinitePosts } from "@/hooks/useInfinitePosts";
import { InfiniteScrollTrigger } from "@/components/InfiniteScrollTrigger";
import { ArrowLeft, MessageSquare, UserPlus, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { profilePath } from "@/utils/profilePath";

type Profile = {
  id: string;
  name: string;
  username: string;
  avatar_text: string;
  role?: string | null;
  bio?: string | null;
};

type FollowRow = {
  follower: Profile | null;
  following: Profile | null;
  created_at: string;
};

const PAGE_SIZE = 20;

function useDebounce<T>(value: T, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

function FollowButton({
  currentUserId,
  targetUserId,
  viewedProfileId,
  size = "sm",
}: {
  currentUserId: string | undefined;
  targetUserId: string;
  viewedProfileId: string;
  size?: "sm" | "default";
}) {
  const queryClient = useQueryClient();
  const { data: rel, isLoading } = useQuery({
    queryKey: ["isFollowing", currentUserId, targetUserId],
    enabled: !!currentUserId && !!targetUserId && currentUserId !== targetUserId,
    staleTime: 30000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_followers")
        .select("follower_id,following_id")
        .eq("follower_id", currentUserId!)
        .eq("following_id", targetUserId)
        .maybeSingle();
      if (error) throw error;
      return data || null;
    },
  });

  const follow = useMutation({
    mutationFn: async () => {
      if (!currentUserId) throw new Error("Tidak dapat memproses");
      const { error } = await supabase.from("user_followers").insert({ follower_id: currentUserId, following_id: targetUserId });
      if (error) throw error;
      toast.success("Berhasil mengikuti");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["isFollowing", currentUserId, targetUserId] });
      queryClient.invalidateQueries({ queryKey: ["profileCounts", viewedProfileId] });
      queryClient.invalidateQueries({ queryKey: ["followersList", viewedProfileId] });
      queryClient.invalidateQueries({ queryKey: ["followingList", viewedProfileId] });
    },
  });

  const unfollow = useMutation({
    mutationFn: async () => {
      if (!currentUserId) throw new Error("Tidak dapat memproses");
      const { error } = await supabase
        .from("user_followers")
        .delete()
        .eq("follower_id", currentUserId)
        .eq("following_id", targetUserId);
      if (error) throw error;
      toast.success("Berhasil berhenti mengikuti");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["isFollowing", currentUserId, targetUserId] });
      queryClient.invalidateQueries({ queryKey: ["profileCounts", viewedProfileId] });
      queryClient.invalidateQueries({ queryKey: ["followersList", viewedProfileId] });
      queryClient.invalidateQueries({ queryKey: ["followingList", viewedProfileId] });
    },
  });

  if (!currentUserId || currentUserId === targetUserId) return null;

  if (!rel) {
    return (
      <Button size={size} onClick={() => follow.mutate()} disabled={isLoading || follow.isPending} aria-busy={isLoading || follow.isPending}>
        <UserPlus className="h-4 w-4 mr-1" />
        {follow.isPending ? "Memproses..." : "Ikuti"}
      </Button>
    );
  }

  return (
    <Button
      size={size}
      variant="secondary"
      onClick={() => unfollow.mutate()}
      disabled={isLoading || unfollow.isPending}
      aria-busy={isLoading || unfollow.isPending}
    >
      <UserMinus className="h-4 w-4 mr-1" />
      {unfollow.isPending ? "Memproses..." : "Mengikuti"}
    </Button>
  );
}

export default function UserProfilePage(): JSX.Element {
  const { username } = useParams<{ username: string }>();
  const decodedUsername = decodeURIComponent(username || "");
  const navigate = useNavigate();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<"all" | "media" | "repost">("all");
  const [openFollowDialog, setOpenFollowDialog] = useState<"followers" | "following" | null>(null);
  const [followTab, setFollowTab] = useState<"followers" | "following">("followers");
  const [searchFollow, setSearchFollow] = useState("");
  const debouncedSearch = useDebounce(searchFollow, 300);

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
    data: viewedProfile,
    isLoading: isLoadingViewed,
    isError: profileError,
  } = useQuery<Profile | null>({
    queryKey: ["viewedProfileByUsername", decodedUsername],
    enabled: !!decodedUsername,
    staleTime: 60000,
    gcTime: 300000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,name,username,avatar_text,role,bio")
        .eq("username", decodedUsername)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (viewedProfile && decodedUsername && viewedProfile.username && viewedProfile.username !== decodedUsername) {
      navigate(`/profile/u/${encodeURIComponent(viewedProfile.username)}`, { replace: true });
    }
  }, [decodedUsername, viewedProfile, navigate]);

  const {
    data: postsData,
    isLoading: listLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    posts,
  } = useInfinitePosts({
    userFilterId: viewedProfile?.id ?? null,
    currentUserId: currentUserProfile?.id ?? null,
  });

  const allPosts = useMemo(
    () => (posts ?? []).filter((it) => !it.original_post_id),
    [posts]
  );
  const mediaPosts = useMemo(
    () => (posts ?? []).filter((it) => !it.original_post_id && !!it.image_url),
    [posts]
  );
  const repostPosts = useMemo(
    () => (posts ?? []).filter((it) => !!it.original_post_id),
    [posts]
  );

  const { data: counts } = useQuery({
    queryKey: ["profileCounts", viewedProfile?.id],
    enabled: !!viewedProfile?.id,
    staleTime: 60000,
    gcTime: 300000,
    queryFn: async () => {
      const authorId = viewedProfile!.id;
      const allQ = supabase.from("posts").select("*", { count: "exact", head: true }).eq("user_id", authorId).is("original_post_id", null);
      const mediaQ = supabase.from("posts").select("*", { count: "exact", head: true }).eq("user_id", authorId).is("original_post_id", null).not("image_url", "is", null);
      const repostQ = supabase.from("posts").select("*", { count: "exact", head: true }).eq("user_id", authorId).not("original_post_id", "is", null);
      const followersQ = supabase.from("user_followers").select("*", { count: "exact", head: true }).eq("following_id", authorId);
      const followingQ = supabase.from("user_followers").select("*", { count: "exact", head: true }).eq("follower_id", authorId);
      const [allR, mediaR, repostR, folR, ingR] = await Promise.all([allQ, mediaQ, repostQ, followersQ, followingQ]);
      if (allR.error) throw allR.error;
      if (mediaR.error) throw mediaR.error;
      if (repostR.error) throw repostR.error;
      if (folR.error) throw folR.error;
      if (ingR.error) throw ingR.error;
      return { all: allR.count || 0, media: mediaR.count || 0, repost: repostR.count || 0, followers: folR.count || 0, following: ingR.count || 0 };
    },
  });

  const chatMutation = useMutation({
    mutationFn: async () => {
      if (!currentUserProfile?.id || !viewedProfile?.id) throw new Error("Tidak dapat memulai chat");
      const { data, error } = await supabase.rpc("create_or_get_chat_room", { recipient_id: viewedProfile.id });
      if (error) throw error;
      return data as string | null;
    },
    onSuccess: (roomId) => {
      if (roomId) navigate(`/chat/${roomId}`);
    },
  });

  const [openFollowers, setOpenFollowers] = useState(false);
  const [openFollowing, setOpenFollowing] = useState(false);

  const followersQuery = useInfiniteQuery({
    queryKey: ["followersList", viewedProfile?.id, debouncedSearch, followTab],
    enabled: !!viewedProfile?.id && (openFollowers || openFollowing) && followTab === "followers",
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const offset = Number(pageParam) || 0;
      const { data, error } = await supabase.rpc("get_followers_profiles", {
        p_user_id: viewedProfile!.id,
        p_limit: PAGE_SIZE,
        p_offset: offset,
        p_search: debouncedSearch?.trim() || null,
      });
      if (error) throw error;
      const items = (data as any[]) || [];
      return { items, nextOffset: offset + items.length };
    },
    getNextPageParam: (last, _pages, lastParam) => {
      if (!last || last.items.length < PAGE_SIZE) return undefined;
      return (Number(lastParam) || 0) + PAGE_SIZE;
    },
    staleTime: 30000,
    gcTime: 300000,
  });

  const followingQuery = useInfiniteQuery({
    queryKey: ["followingList", viewedProfile?.id, debouncedSearch, followTab],
    enabled: !!viewedProfile?.id && (openFollowers || openFollowing) && followTab === "following",
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const offset = Number(pageParam) || 0;
      const { data, error } = await supabase.rpc("get_following_profiles", {
        p_user_id: viewedProfile!.id,
        p_limit: PAGE_SIZE,
        p_offset: offset,
        p_search: debouncedSearch?.trim() || null,
      });
      if (error) throw error;
      const items = (data as any[]) || [];
      return { items, nextOffset: offset + items.length };
    },
    getNextPageParam: (last, _pages, lastParam) => {
      if (!last || last.items.length < PAGE_SIZE) return undefined;
      return (Number(lastParam) || 0) + PAGE_SIZE;
    },
    staleTime: 30000,
    gcTime: 300000,
  });

  useEffect(() => {
    setActiveTab("all");
  }, [decodedUsername]);

  if (isLoadingViewed) {
    return (
      <div className="min-h-screen bg-muted">
        <Navbar userName={currentUserProfile?.name} userInitials={currentUserProfile?.avatar_text} />
        <main className="container mx-auto grid grid-cols-10 gap-6 py-6">
          <aside className="col-span-2 hidden md:block">
            <Skeleton className="h-40 w-full rounded-lg" />
          </aside>
          <section className="col-span-10 md:col-span-5 space-y-4">
            <Skeleton className="h-20 w-1/2" />
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

  if (profileError || !viewedProfile) {
    return (
      <div className="min-h-screen bg-muted">
        <Navbar userName={currentUserProfile?.name} userInitials={currentUserProfile?.avatar_text} />
        <main className="container mx-auto py-10">
          <div className="max-w-2xl mx-auto text-center text-muted-foreground">Profil tidak ditemukan.</div>
        </main>
      </div>
    );
  }

  const renderFollowItem = (p: Profile) => (
    <div key={p.id} className="flex items-center justify-between p-2 border rounded-lg">
      <div className="flex items-center gap-3">
        <Link
          to={profilePath(p.username, p.name)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold"
        >
          {p.avatar_text || "?"}
        </Link>
        <div>
          <Link to={profilePath(p.username, p.name)} className="font-medium hover:underline">
            {p.name}
          </Link>
          <div className="text-xs text-muted-foreground">@{p.username}</div>
        </div>
      </div>
      <FollowButton currentUserId={currentUserProfile?.id} targetUserId={p.id} viewedProfileId={viewedProfile.id} />
    </div>
  );

  const loadingFollowers = followersQuery.isLoading || (followersQuery.isFetching && !followersQuery.isFetchingNextPage);
  const loadingFollowing = followingQuery.isLoading || (followingQuery.isFetching && !followingQuery.isFetchingNextPage);

  return (
    <div className="min-h-screen bg-muted">
      <Navbar userName={currentUserProfile?.name} userInitials={currentUserProfile?.avatar_text} />
      <main className="container mx-auto grid grid-cols-10 gap-6 py-6">
        <LeftSidebar />
        <section className="col-span-10 md:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Kembali
            </Button>
          </div>

          <Card className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                  {viewedProfile.avatar_text || "?"}
                </div>
                <div>
                  <h2 className="text-xl font-semibold">{viewedProfile.name}</h2>
                  <p className="text-xs text-muted-foreground">@{viewedProfile.username}</p>
                </div>
              </div>
              {currentUserProfile?.id !== viewedProfile.id && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => chatMutation.mutate()}
                    disabled={chatMutation.isPending}
                    aria-busy={chatMutation.isPending}
                  >
                    <MessageSquare className="h-4 w-4 mr-1" />
                    {chatMutation.isPending ? "Membuka..." : "Chat"}
                  </Button>
                  <FollowButton currentUserId={currentUserProfile?.id} targetUserId={viewedProfile.id} viewedProfileId={viewedProfile.id} size="sm" />
                </div>
              )}
            </div>
            {viewedProfile.bio && <p className="mt-3 text-sm text-muted-foreground whitespace-pre-wrap">{viewedProfile.bio}</p>}
            <div className="mt-4 flex items-center gap-3 text-xs">
              <Dialog open={openFollowers} onOpenChange={setOpenFollowers}>
                <DialogTrigger asChild>
                  <button className="px-2 py-1 rounded-full bg-secondary">Followers</button>
                </DialogTrigger>
                <DialogContent className="max-w-xl">
                  <DialogDescription className="sr-only">Daftar followers</DialogDescription>
                  <DialogHeader>
                    <DialogTitle>Followers</DialogTitle>
                  </DialogHeader>
                  <div className="mb-2">
                    <Input placeholder="Cari followers..." value={searchFollow} onChange={(e) => setSearchFollow(e.target.value)} />
                  </div>
                  <Tabs value={followTab} onValueChange={(v) => setFollowTab(v as "followers" | "following")}>
                    <TabsList className="grid grid-cols-2 w-full">
                      <TabsTrigger value="followers">Followers</TabsTrigger>
                      <TabsTrigger value="following">Following</TabsTrigger>
                    </TabsList>
                    <TabsContent value="followers">
                      <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                        {loadingFollowers ? (
                          <div className="space-y-2">
                            {Array.from({ length: 6 }).map((_, i) => (
                              <div key={i} className="flex items-center justify-between p-2 border rounded-lg">
                                <div className="flex items-center gap-3 w-full">
                                  <Skeleton className="h-10 w-10 rounded-full" />
                                  <div className="flex-1">
                                    <Skeleton className="h-4 w-40 mb-2" />
                                    <Skeleton className="h-3 w-24" />
                                  </div>
                                  <Skeleton className="h-8 w-24" />
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <>
                            {(followersQuery.data?.pages ?? []).flatMap((p) => p.items).map((u: any) => renderFollowItem(u))}
                            <InfiniteScrollTrigger onLoadMore={() => followersQuery.fetchNextPage()} disabled={!followersQuery.hasNextPage || followersQuery.isFetchingNextPage} />
                            {followersQuery.hasNextPage && (
                              <div className="flex justify-center pt-2">
                                <Button onClick={() => followersQuery.fetchNextPage()} disabled={followersQuery.isFetchingNextPage} variant="outline" size="sm">
                                  {followersQuery.isFetchingNextPage ? "Memuat..." : "Muat lagi"}
                                </Button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </TabsContent>
                    <TabsContent value="following">
                      <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                        {loadingFollowing ? (
                          <div className="space-y-2">
                            {Array.from({ length: 6 }).map((_, i) => (
                              <div key={i} className="flex items-center justify-between p-2 border rounded-lg">
                                <div className="flex items-center gap-3 w-full">
                                  <Skeleton className="h-10 w-10 rounded-full" />
                                  <div className="flex-1">
                                    <Skeleton className="h-4 w-40 mb-2" />
                                    <Skeleton className="h-3 w-24" />
                                  </div>
                                  <Skeleton className="h-8 w-24" />
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <>
                            {(followingQuery.data?.pages ?? []).flatMap((p) => p.items).map((u: any) => renderFollowItem(u))}
                            <InfiniteScrollTrigger onLoadMore={() => followingQuery.fetchNextPage()} disabled={!followingQuery.hasNextPage || followingQuery.isFetchingNextPage} />
                            {followingQuery.hasNextPage && (
                              <div className="flex justify-center pt-2">
                                <Button onClick={() => followingQuery.fetchNextPage()} disabled={followingQuery.isFetchingNextPage} variant="outline" size="sm">
                                  {followingQuery.isFetchingNextPage ? "Memuat..." : "Muat lagi"}
                                </Button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                </DialogContent>
              </Dialog>
              <Dialog open={openFollowing} onOpenChange={setOpenFollowing}>
                <DialogTrigger asChild>
                  <button className="px-2 py-1 rounded-full bg-secondary">Following</button>
                </DialogTrigger>
                <DialogContent className="max-w-xl">
                  <DialogDescription className="sr-only">Daftar following</DialogDescription>
                  <DialogHeader>
                    <DialogTitle>Following</DialogTitle>
                  </DialogHeader>
                  <div className="mb-2">
                    <Input placeholder="Cari following..." value={searchFollow} onChange={(e) => setSearchFollow(e.target.value)} />
                  </div>
                  <Tabs value={followTab} onValueChange={(v) => setFollowTab(v as "followers" | "following")}>
                    <TabsList className="grid grid-cols-2 w-full">
                      <TabsTrigger value="followers">Followers</TabsTrigger>
                      <TabsTrigger value="following">Following</TabsTrigger>
                    </TabsList>
                    <TabsContent value="followers">
                      <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                        {loadingFollowers ? (
                          <div className="space-y-2">
                            {Array.from({ length: 6 }).map((_, i) => (
                              <div key={i} className="flex items-center justify-between p-2 border rounded-lg">
                                <div className="flex items-center gap-3 w-full">
                                  <Skeleton className="h-10 w-10 rounded-full" />
                                  <div className="flex-1">
                                    <Skeleton className="h-4 w-40 mb-2" />
                                    <Skeleton className="h-3 w-24" />
                                  </div>
                                  <Skeleton className="h-8 w-24" />
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <>
                            {(followersQuery.data?.pages ?? []).flatMap((p) => p.items).map((u: any) => renderFollowItem(u))}
                            <InfiniteScrollTrigger onLoadMore={() => followersQuery.fetchNextPage()} disabled={!followersQuery.hasNextPage || followersQuery.isFetchingNextPage} />
                            {followersQuery.hasNextPage && (
                              <div className="flex justify-center pt-2">
                                <Button onClick={() => followersQuery.fetchNextPage()} disabled={followersQuery.isFetchingNextPage} variant="outline" size="sm">
                                  {followersQuery.isFetchingNextPage ? "Memuat..." : "Muat lagi"}
                                </Button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </TabsContent>
                    <TabsContent value="following">
                      <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                        {loadingFollowing ? (
                          <div className="space-y-2">
                            {Array.from({ length: 6 }).map((_, i) => (
                              <div key={i} className="flex items-center justify-between p-2 border rounded-lg">
                                <div className="flex items-center gap-3 w-full">
                                  <Skeleton className="h-10 w-10 rounded-full" />
                                  <div className="flex-1">
                                    <Skeleton className="h-4 w-40 mb-2" />
                                    <Skeleton className="h-3 w-24" />
                                  </div>
                                  <Skeleton className="h-8 w-24" />
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <>
                            {(followingQuery.data?.pages ?? []).flatMap((p) => p.items).map((u: any) => renderFollowItem(u))}
                            <InfiniteScrollTrigger onLoadMore={() => followingQuery.fetchNextPage()} disabled={!followingQuery.hasNextPage || followingQuery.isFetchingNextPage} />
                            {followingQuery.hasNextPage && (
                              <div className="flex justify-center pt-2">
                                <Button onClick={() => followingQuery.fetchNextPage()} disabled={followingQuery.isFetchingNextPage} variant="outline" size="sm">
                                  {followingQuery.isFetchingNextPage ? "Memuat..." : "Muat lagi"}
                                </Button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                </DialogContent>
              </Dialog>
            </div>
          </Card>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="w-full">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="all">Semua</TabsTrigger>
              <TabsTrigger value="media">Media</TabsTrigger>
              <TabsTrigger value="repost">Repost</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4">
              {listLoading && (
                <>
                  <Skeleton className="h-64 w-full" />
                  <Skeleton className="h-64 w-full" />
                </>
              )}
              {!listLoading && allPosts.length === 0 && <p className="text-sm text-muted-foreground text-center">Belum ada postingan.</p>}
              {allPosts.map((post) => (
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
              {!hasNextPage && !listLoading && allPosts.length > 0 && (
                <p className="text-center text-sm text-muted-foreground py-2">Tidak ada postingan lagi.</p>
              )}
            </TabsContent>

            <TabsContent value="media" className="space-y-4">
              {listLoading && (
                <>
                  <Skeleton className="h-64 w-full" />
                  <Skeleton className="h-64 w-full" />
                </>
              )}
              {!listLoading && mediaPosts.length === 0 && <p className="text-sm text-muted-foreground text-center">Belum ada media.</p>}
              {mediaPosts.map((post) => (
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
              {!hasNextPage && !listLoading && mediaPosts.length > 0 && (
                <p className="text-center text-sm text-muted-foreground py-2">Semua media sudah ditampilkan.</p>
              )}
            </TabsContent>

            <TabsContent value="repost" className="space-y-4">
              {listLoading && (
                <>
                  <Skeleton className="h-64 w-full" />
                  <Skeleton className="h-64 w-full" />
                </>
              )}
              {!listLoading && repostPosts.length === 0 && <p className="text-sm text-muted-foreground text-center">Belum ada repost.</p>}
              {repostPosts.map((post) => (
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
              {!hasNextPage && !listLoading && repostPosts.length > 0 && (
                <p className="text-center text-sm text-muted-foreground py-2">Tidak ada repost lagi.</p>
              )}
            </TabsContent>
          </Tabs>
        </section>
        <RightSidebar />
      </main>
    </div>
  );
}
