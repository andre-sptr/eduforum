import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { LeftSidebar } from "@/components/LeftSidebar";
import { RightSidebar } from "@/components/RightSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Send, Settings } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { PostCard, PostWithAuthor } from "@/components/PostCard";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const qk = { followStatus: (pid?: string, uid?: string) => ["followStatus", pid, uid] as const, followerCount: (pid?: string) => ["followerCount", pid] as const, followingCount: (pid?: string) => ["followingCount", pid] as const };
type UserProfile = { id: string; name: string; bio: string | null; avatar_text: string; role: string; username: string };
type CurrentProfile = { id: string | null; name: string | null; avatar_text: string | null };
type TabKey = "all" | "media" | "reposts" | "nomedia";
type PostRow = { id: string; content: string; image_url: string | null; created_at: string; user_id: string; likes_count: number; comments_count: number; original_post_id: string | null; original_author_id: string | null; profiles: { name: string; avatar_text: string; role: string } | null; original_author: { name: string; avatar_text: string; role: string } | null };
type MiniProfile = { id: string; name: string; username: string | null; avatar_text: string | null; role: string | null };
const PAGE_SIZE = 4;

async function fetchUserByUsername(username: string) { const decoded = decodeURIComponent(username); const { data, error } = await supabase.from("profiles").select("id,name,bio,avatar_text,role,username").ilike("username", decoded).limit(1); if (error) throw new Error(error.message); return (data?.[0] as UserProfile) ?? null; }
async function fetchUserByName(name: string) { const decoded = decodeURIComponent(name); const { data, error } = await supabase.from("profiles").select("id,name,bio,avatar_text,role,username").eq("name", decoded).limit(1).maybeSingle(); if (error) throw new Error(error.message); return (data as UserProfile) ?? null; }
async function fetchUserPosts(args: { profileId: string; currentUserId: string | null; tab: TabKey; cursor?: string | null }) {
  const { profileId, currentUserId, tab, cursor } = args;
  let q = supabase.from("posts").select(`id,content,image_url,created_at,user_id,likes_count,comments_count,original_post_id,original_author_id,profiles!user_id(name,avatar_text,role),original_author:profiles!original_author_id(name,avatar_text,role)`).eq("user_id", profileId).order("created_at", { ascending: false }).limit(PAGE_SIZE);
  if (cursor) q = q.lt("created_at", cursor); if (tab === "media") q = q.not("image_url", "is", null); if (tab === "nomedia") q = q.is("image_url", null); if (tab === "reposts") q = q.not("original_post_id", "is", null);
  const { data, error } = await q; if (error) throw new Error(error.message);
  const items = (data ?? []) as PostRow[]; let likedSet = new Set<string>();
  if (currentUserId && items.length) { const ids = items.map(p => p.id); const { data: likesData, error: likesErr } = await supabase.from("post_likes").select("post_id").in("post_id", ids).eq("user_id", currentUserId); if (likesErr) throw new Error(likesErr.message); likedSet = new Set((likesData ?? []).map((r: { post_id: string }) => r.post_id)); }
  const withFlag = items.map(p => ({ ...p, viewer_has_liked: likedSet.has(p.id) })); const nextCursor = items.length === PAGE_SIZE ? items[items.length - 1].created_at : null;
  return { items: withFlag as (PostRow & { viewer_has_liked: boolean })[], nextCursor };
}
async function fetchCount(profileId: string, tab: TabKey) { let q = supabase.from("posts").select("id", { head: true, count: "exact" }).eq("user_id", profileId); if (tab === "media") q = q.not("image_url", "is", null); if (tab === "nomedia") q = q.is("image_url", null); if (tab === "reposts") q = q.not("original_post_id", "is", null); const { count, error } = await q; if (error) throw new Error(error.message); return count ?? 0; }
async function fetchFollowersCursor({ profileId, cursor }: { profileId: string; cursor: string | null }) { let q = supabase.from("user_followers").select("follower_id,created_at").eq("following_id", profileId).order("created_at", { ascending: false }).order("follower_id", { ascending: false }).limit(PAGE_SIZE); if (cursor) q = q.lt("created_at", cursor); const { data: rows, error } = await q; if (error) throw new Error(error.message); const ids = (rows ?? []).map(r => r.follower_id); if (!ids.length) return { items: [], nextCursor: null }; const { data: profilesData, error: pErr } = await supabase.from("profiles").select("id,name,username,avatar_text,role").in("id", ids); if (pErr) throw new Error(pErr.message); const byId = new Map((profilesData ?? []).map(p => [p.id, p])); const items = (rows ?? []).map(r => byId.get(r.follower_id)).filter(Boolean) as MiniProfile[]; const nextCursor = rows && rows.length === PAGE_SIZE ? (rows[rows.length - 1].created_at as string) : null; return { items, nextCursor }; }
async function fetchFollowingCursor({ profileId, cursor }: { profileId: string; cursor: string | null }) { let q = supabase.from("user_followers").select("following_id,created_at").eq("follower_id", profileId).order("created_at", { ascending: false }).order("following_id", { ascending: false }).limit(PAGE_SIZE); if (cursor) q = q.lt("created_at", cursor); const { data: rows, error } = await q; if (error) throw new Error(error.message); const ids = (rows ?? []).map(r => r.following_id); if (!ids.length) return { items: [], nextCursor: null }; const { data: profilesData, error: pErr } = await supabase.from("profiles").select("id,name,username,avatar_text,role").in("id", ids); if (pErr) throw new Error(pErr.message); const byId = new Map((profilesData ?? []).map(p => [p.id, p])); const items = (rows ?? []).map(r => byId.get(r.following_id)).filter(Boolean) as MiniProfile[]; const nextCursor = rows && rows.length === PAGE_SIZE ? (rows[rows.length - 1].created_at as string) : null; return { items, nextCursor }; }
function AutoLoadMore({ enabled, onLoad, rootMargin = "600px" }: { enabled: boolean; onLoad: () => void; rootMargin?: string }) { const ref = useRef<HTMLDivElement | null>(null); useEffect(() => { if (!enabled || !ref.current) return; let called = false; const io = new IntersectionObserver(e => { if (!called && e[0]?.isIntersecting) { called = true; onLoad(); } }, { rootMargin, threshold: 0.01 }); io.observe(ref.current); return () => io.disconnect(); }, [enabled, onLoad, rootMargin]); return <div ref={ref} aria-hidden className="h-6" />; }
function LazyPostCard({ children, minHeight = 160, rootMargin = "400px" }: { children: React.ReactNode; minHeight?: number; rootMargin?: string }) { const ref = React.useRef<HTMLDivElement | null>(null); const [visible, setVisible] = React.useState(false); useEffect(() => { if (!ref.current || visible) return; const io = new IntersectionObserver(e => { if (e[0]?.isIntersecting) { setVisible(true); io.disconnect(); } }, { rootMargin, threshold: 0.01 }); io.observe(ref.current); return () => io.disconnect(); }, [visible, rootMargin]); return <div ref={ref} style={{ minHeight }}>{visible ? children : <Skeleton className="w-full h-[160px] rounded-md" />}</div>; }

export default function UserProfilePage() {
  const { user, loading: authLoading } = useAuth(); const { username = "" } = useParams<{ username: string }>(); const navigate = useNavigate(); const qc = useQueryClient(); const currentUserId = user?.id ?? null;
  const [loadingChat, setLoadingChat] = useState(false); const [activeTab, setActiveTab] = useState<TabKey>("all"); const [openList, setOpenList] = useState<"followers" | "following" | null>(null); const topRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => { if (!authLoading && !user) navigate("/auth"); }, [authLoading, user, navigate]);

  const { data: currentProfile } = useQuery<CurrentProfile | null>({ queryKey: ["userProfile", user?.id], queryFn: async () => { if (!user) return null; const { data } = await supabase.from("profiles").select("id,name,avatar_text").eq("id", user.id).maybeSingle(); return data; }, enabled: !!user });
  const { data: profile, isLoading } = useQuery<UserProfile | null>({ queryKey: ["publicProfileByUsername", username], queryFn: () => fetchUserByUsername(username), enabled: !!username, staleTime: 15_000 });
  const { data: legacyByName } = useQuery<UserProfile | null>({ queryKey: ["legacyProfileByName", username], queryFn: () => fetchUserByName(username), enabled: !!username && !profile && !isLoading, staleTime: 60_000 });
  useEffect(() => { if (legacyByName?.username) navigate(`/profile/u/${encodeURIComponent(legacyByName.username)}`, { replace: true }); }, [legacyByName, navigate]);

  const isCurrentUser = !!user && !!profile && user.id === profile.id;
  const { data: isFollowing, isLoading: isFollowingLoading } = useQuery<boolean>({ queryKey: qk.followStatus(profile?.id, user?.id), queryFn: async () => { if (!user || !profile?.id || isCurrentUser) return false; const { data } = await supabase.from("user_followers").select("follower_id").eq("follower_id", user.id).eq("following_id", profile.id).maybeSingle(); return !!data; }, enabled: !!user && !!profile?.id && !isCurrentUser });
  const followForUI = (qc.getQueryData<boolean>(qk.followStatus(profile?.id, user?.id)) ?? isFollowing) ?? false;

  const { data: followerCount = 0 } = useQuery<number>({ queryKey: qk.followerCount(profile?.id), queryFn: async () => { if (!profile?.id) return 0; const { count } = await supabase.from("user_followers").select("following_id", { count: "exact", head: true }).eq("following_id", profile.id); return count ?? 0; }, enabled: !!profile?.id });
  const { data: followingCount = 0 } = useQuery<number>({ queryKey: qk.followingCount(profile?.id), queryFn: async () => { if (!profile?.id) return 0; const { count } = await supabase.from("user_followers").select("follower_id", { count: "exact", head: true }).eq("follower_id", profile.id); return count ?? 0; }, enabled: !!profile?.id });

  const toggleFollowMutation = useMutation({
    mutationFn: async (vars: { nextFollow: boolean }) => {
      if (!user || !profile?.id) throw new Error("ID pengguna tidak valid.");
      if (vars.nextFollow) { const { error } = await supabase.from("user_followers").insert({ follower_id: user.id, following_id: profile.id }); if (error && error.code !== "23505") throw error; }
      else { const { error } = await supabase.from("user_followers").delete().eq("follower_id", user.id).eq("following_id", profile.id); if (error) throw error; }
    },
    retry: 0,
    onMutate: async vars => {
      if (!profile?.id || !user?.id) return;
      await Promise.all([qc.cancelQueries({ queryKey: qk.followStatus(profile.id, user.id) }), qc.cancelQueries({ queryKey: qk.followerCount(profile.id) })]);
      const prevStatus = qc.getQueryData<boolean>(qk.followStatus(profile.id, user.id)) ?? false;
      const prevFollower = qc.getQueryData<number>(qk.followerCount(profile.id)) ?? 0;
      qc.setQueryData<boolean>(qk.followStatus(profile.id, user.id), vars.nextFollow);
      qc.setQueryData<number>(qk.followerCount(profile.id), Math.max(0, prevFollower + (vars.nextFollow ? 1 : -1)));
      return { prevStatus, prevFollower, nextFollow: vars.nextFollow };
    },
    onError: (_e, _v, ctx) => { if (!ctx || !profile?.id || !user?.id) return; qc.setQueryData<boolean>(qk.followStatus(profile.id, user.id), ctx.prevStatus); qc.setQueryData<number>(qk.followerCount(profile.id), ctx.prevFollower); toast.error("Gagal memperbarui status mengikuti."); },
    onSuccess: (_r, _v, ctx) => toast.success(ctx?.nextFollow ? "Berhasil Follow!" : "Berhasil Unfollow."),
    onSettled: () => { if (!profile?.id || !user?.id) return; qc.invalidateQueries({ queryKey: qk.followStatus(profile.id, user.id) }); qc.invalidateQueries({ queryKey: qk.followerCount(profile.id) }); qc.invalidateQueries({ queryKey: qk.followingCount(user.id) }); },
  });

  const counts = useQuery({ queryKey: ["profileTabCounts", profile?.id], queryFn: async () => { if (!profile?.id) return { all: 0, media: 0, reposts: 0, nomedia: 0 }; const [all, media, reposts, nomedia] = await Promise.all([fetchCount(profile.id, "all"), fetchCount(profile.id, "media"), fetchCount(profile.id, "reposts"), fetchCount(profile.id, "nomedia")]); return { all, media, reposts, nomedia }; }, enabled: !!profile?.id, staleTime: 30_000 });

  const postsQuery = useInfiniteQuery({ queryKey: ["profilePosts", profile?.id, activeTab, currentUserId], queryFn: ({ pageParam }) => fetchUserPosts({ profileId: profile!.id, currentUserId, tab: activeTab, cursor: pageParam ?? null }), initialPageParam: null, getNextPageParam: last => last.nextCursor, enabled: !!profile?.id, staleTime: 15_000 });
  useEffect(() => { topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [activeTab, profile?.id]);
  const items = useMemo(() => postsQuery.data?.pages.flatMap(p => p.items) ?? [], [postsQuery.data]);

  if (authLoading || isLoading) return (
    <div className="min-h-screen bg-muted">
      <Navbar />
      <main className="container mx-auto grid grid-cols-10 gap-6 py-6">
        <aside className="col-span-2 hidden md:block"><Skeleton className="h-40 w-full rounded-lg" /></aside>
        <section className="col-span-10 md:col-span-5 space-y-4"><Skeleton className="h-10 w-1/3" /><Skeleton className="h-64 w-full" /></section>
        <aside className="col-span-10 md:col-span-3 hidden md:block"><Skeleton className="h-64 w-full rounded-lg" /></aside>
      </main>
    </div>
  );

  if (!profile) return (
    <div className="min-h-screen bg-muted">
      <Navbar userName={currentProfile?.name || ""} userInitials={currentProfile?.avatar_text || ""} />
      <main className="container mx-auto grid grid-cols-10 gap-6 py-6">
        <LeftSidebar />
        <section className="col-span-10 md:col-span-5"><Card className="p-6 text-center text-muted-foreground">Profil tidak ditemukan.</Card></section>
        <RightSidebar />
      </main>
    </div>
  );

  return (
    <div className="min-h-screen bg-muted">
      <Navbar userName={currentProfile?.name || ""} userInitials={currentProfile?.avatar_text || ""} />
      <main className="container mx-auto grid grid-cols-10 gap-6 py-6">
        <LeftSidebar />
        <section className="col-span-10 md:col-span-5 space-y-6">
          <div ref={topRef} />
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-2"><ArrowLeft className="h-5 w-5 mr-2" />Kembali</Button>
          <Card className="shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center space-x-4">
                <UserAvatar name={profile.name} initials={profile.avatar_text} size="lg" />
                <div><CardTitle className="text-2xl">{profile.name}</CardTitle><p className="text-sm text-muted-foreground">{profile.role}</p></div>
              </div>
              <div className="flex items-center space-x-2">
                {currentUserId === profile.id ? (
                  <Button variant="secondary" size="sm" onClick={() => navigate("/settings/profile")}><Settings className="h-4 w-4 mr-2" />Atur Profil</Button>
                ) : (
                  <>
                    <Button variant="outline" size="sm" onClick={async () => {
                      if (!currentUserId) return toast.error("Gagal memulai chat: ID pengguna saat ini tidak ditemukan.");
                      if (currentUserId === profile.id) return toast.info("Anda tidak bisa chat dengan diri sendiri.");
                      setLoadingChat(true);
                      try { const { data: roomId, error } = await supabase.rpc("create_or_get_chat_room", { recipient_id: profile.id }); if (error) throw error; if (!roomId) throw new Error("Gagal mendapatkan ID room chat."); navigate(`/chat/${roomId}`); }
                      catch (e) { toast.error((e as Error).message); }
                      finally { setLoadingChat(false); }
                    }} disabled={loadingChat}><Send className="h-4 w-4 mr-2" />{loadingChat ? "..." : "Chat"}</Button>
                    <FollowButton isFollowing={!!followForUI} isLoading={toggleFollowMutation.isPending} onClick={() => { if (toggleFollowMutation.isPending) return; const current = qc.getQueryData<boolean>(qk.followStatus(profile.id, user?.id)) ?? !!isFollowing; toggleFollowMutation.mutate({ nextFollow: !current }); }} />
                  </>
                )}
              </div>
            </CardHeader>
            <CardContent className="border-t pt-4">
              <div className="flex items-center gap-6 mb-4">
                <button className="text-sm font-medium" onClick={() => setOpenList("followers")}><strong>{isFollowingLoading ? "..." : followerCount}</strong> <span className="text-muted-foreground">Pengikut</span></button>
                <button className="text-sm font-medium" onClick={() => setOpenList("following")}><strong>{followingCount}</strong> <span className="text-muted-foreground">Mengikuti</span></button>
              </div>
              <p className="text-muted-foreground mb-6">{profile.bio || "Tidak ada bio yang tersedia."}</p>
              <div className="mb-3 flex gap-2">
                <Button variant={activeTab === "all" ? "default" : "outline"} size="sm" onClick={() => { setActiveTab("all"); qc.removeQueries({ queryKey: ["profilePosts", profile.id], exact: false }); }}>Semua{counts.data ? ` (${counts.data.all})` : ""}</Button>
                <Button variant={activeTab === "media" ? "default" : "outline"} size="sm" onClick={() => { setActiveTab("media"); qc.removeQueries({ queryKey: ["profilePosts", profile.id], exact: false }); }}>Media{counts.data ? ` (${counts.data.media})` : ""}</Button>
                <Button variant={activeTab === "nomedia" ? "default" : "outline"} size="sm" onClick={() => { setActiveTab("nomedia"); qc.removeQueries({ queryKey: ["profilePosts", profile.id], exact: false }); }}>Tanpa Media{counts.data ? ` (${counts.data.nomedia})` : ""}</Button>
                <Button variant={activeTab === "reposts" ? "default" : "outline"} size="sm" onClick={() => { setActiveTab("reposts"); qc.removeQueries({ queryKey: ["profilePosts", profile.id], exact: false }); }}>Repost{counts.data ? ` (${counts.data.reposts})` : ""}</Button>
              </div>
              <div>
                {postsQuery.status === "pending" ? <div className="p-4"><Skeleton className="h-64 w-full" /></div> : items.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-6 text-center">Tidak ada postingan pada tab ini.</div>
                ) : (
                  <div className="space-y-3">
                    {items.map(p => (
                      <div key={p.id} className="px-3">
                        <LazyPostCard minHeight={180}><PostCard post={{ ...p } as unknown as PostWithAuthor} currentUserId={currentUserId ?? ""} currentUserName={currentProfile?.name ?? ""} currentUserInitials={currentProfile?.avatar_text ?? ""} /></LazyPostCard>
                      </div>
                    ))}
                    {postsQuery.isFetchingNextPage && <div className="p-4"><Skeleton className="h-24 w-full" /></div>}
                    <AutoLoadMore enabled={!!postsQuery.hasNextPage && !postsQuery.isFetchingNextPage} onLoad={() => postsQuery.fetchNextPage()} />
                    {postsQuery.hasNextPage ? <div className="p-3"><Button className="w-full" variant="outline" onClick={() => postsQuery.fetchNextPage()} disabled={postsQuery.isFetchingNextPage}>{postsQuery.isFetchingNextPage ? "Memuat..." : "Muat lebih banyak"}</Button></div> : items.length > 0 ? <div className="text-center text-sm text-muted-foreground py-4">Sudah di akhir.</div> : null}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </section>
        <RightSidebar />
      </main>
      <FollowsModal open={openList !== null} mode={openList ?? "followers"} userId={profile.id} onClose={() => setOpenList(null)} currentUserId={currentUserId} />
      <footer className="border-t py-4 bg-muted/30"><div className="container mx-auto px-4 text-center"><p className="text-sm text-muted-foreground"><a href="https://flamyheart.site" target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline underline-offset-4">© {new Date().getFullYear()} Andre Saputra</a></p></div></footer>
    </div>
  );
}

function FollowsModal({ open, mode, userId, onClose, currentUserId }: { open: boolean; mode: "followers" | "following"; userId: string; onClose: () => void; currentUserId: string | null }) {
  const navigate = useNavigate(); const qc = useQueryClient();
  const listQuery = useInfiniteQuery({ queryKey: ["followsListCursor", mode, userId], queryFn: ({ pageParam = null }) => (mode === "followers" ? fetchFollowersCursor({ profileId: userId, cursor: pageParam as string | null }) : fetchFollowingCursor({ profileId: userId, cursor: pageParam as string | null })), initialPageParam: null, getNextPageParam: last => last.nextCursor, enabled: open, staleTime: 15_000 });
  const itemsAll = (listQuery.data?.pages ?? []).flatMap(p => p.items);
  const [search, setSearch] = useState(""); const items = useMemo(() => { const q = search.trim().toLowerCase(); return q ? itemsAll.filter(u => u.name.toLowerCase().includes(q) || (u.username ?? "").toLowerCase().includes(q)) : itemsAll; }, [itemsAll, search]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const virt = useVirtualizer({ count: items.length, getScrollElement: () => containerRef.current, estimateSize: () => 72, overscan: 8, measureElement: el => el?.getBoundingClientRect().height ?? 72 });
  useEffect(() => { const v = virt.getVirtualItems(); if (!v.length) return; const last = v[v.length - 1]; const ratio = (last.end / virt.getTotalSize()) || 0; if (ratio > 0.7 && listQuery.hasNextPage && !listQuery.isFetchingNextPage) listQuery.fetchNextPage(); }, [virt.getVirtualItems(), virt.getTotalSize(), listQuery.hasNextPage, listQuery.isFetchingNextPage]);

  // --- Anti-glitch state ---
  const [serverFollow, setServerFollow] = useState<Set<string>>(new Set());
  const [optimistic, setOptimistic] = useState<Map<string, boolean>>(new Map());
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!currentUserId || !itemsAll.length) return;
    const ids = itemsAll.map(u => u.id);
    supabase.from("user_followers").select("following_id").eq("follower_id", currentUserId).in("following_id", ids)
      .then(({ data }) => setServerFollow(new Set<string>((data ?? []).map((r: any) => r.following_id))));
    // penting: jangan reset optimistic saat urutan berubah; trigger hanya saat jumlah item berubah
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, itemsAll.length]);

  const isRowFollow = (id: string) => (optimistic.has(id) ? !!optimistic.get(id) : serverFollow.has(id));

  const followMut = useMutation({
    mutationFn: async ({ targetId, follow }: { targetId: string; follow: boolean }) => {
      if (!currentUserId) throw new Error("Butuh login");
      if (follow) { const { error } = await supabase.from("user_followers").insert({ follower_id: currentUserId, following_id: targetId }); if (error && error.code !== "23505") throw error; }
      else { const { error } = await supabase.from("user_followers").delete().eq("follower_id", currentUserId).eq("following_id", targetId); if (error) throw error; }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["followingCount", currentUserId ?? ""] }); qc.invalidateQueries({ queryKey: ["followerCount", userId] }); },
    onError: e => toast.error((e as Error).message),
  });

  const toggleFollow = async (id: string) => {
    if (!currentUserId || currentUserId === id) return;
    if (pendingIds.has(id)) return; // cegah double click
    const next = !isRowFollow(id);

    setPendingIds(s => new Set(s).add(id));
    setOptimistic(m => { const copy = new Map(m); copy.set(id, next); return copy; });

    try { await followMut.mutateAsync({ targetId: id, follow: next }); }
    catch { setOptimistic(m => { const copy = new Map(m); copy.set(id, !next); return copy; }); }
    finally { setPendingIds(s => { const copy = new Set(s); copy.delete(id); return copy; }); }
  };

  const goProfile = (u: MiniProfile) => { onClose(); navigate(`/profile/u/${encodeURIComponent(u.username ?? u.name)}`); };

  return (
    <Dialog open={open} onOpenChange={o => (!o ? onClose() : null)}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{mode === "followers" ? "Pengikut" : "Mengikuti"}</DialogTitle></DialogHeader>
        <div className="p-2"><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama atau username..." /></div>
        <div ref={containerRef} className="max-h-[70vh] overflow-auto rounded-md border">
          <div style={{ height: virt.getTotalSize(), position: "relative" }}>
            {listQuery.status === "pending" ? (
              <div className="space-y-2 p-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
            ) : items.length === 0 ? (
              <div className="text-sm text-muted-foreground p-4 text-center">Tidak ada data.</div>
            ) : (
              virt.getVirtualItems().map(vi => {
                const u = items[vi.index]; const isMe = currentUserId === u.id; const isFollow = isRowFollow(u.id); const isPending = pendingIds.has(u.id);
                return (
                  <div key={u.id} ref={virt.measureElement} data-index={vi.index} style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${vi.start}px)` }} className="p-2">
                    <div className="flex items-center justify-between rounded-lg border p-2">
                      <div className="flex items-center gap-3">
                        <div className="cursor-pointer" onClick={() => goProfile(u)} aria-label={`Buka profil ${u.username ?? u.name}`}><UserAvatar name={u.name} initials={u.avatar_text ?? ""} /></div>
                        <div className="leading-tight"><div className="text-sm font-medium cursor-pointer" onClick={() => goProfile(u)}>{u.name}</div><div className="text-xs text-muted-foreground">{u.role ?? ""}</div></div>
                      </div>
                      {!isMe && (
                        <Button size="sm" variant={isFollow ? "secondary" : "default"} onClick={() => toggleFollow(u.id)} disabled={isPending} aria-pressed={isFollow}>
                          {isPending ? "Memproses..." : isFollow ? "Mengikuti" : "Ikuti"}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            {listQuery.isFetchingNextPage && <div className="p-2"><Skeleton className="h-8 w-full" /></div>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FollowButton({ isFollowing, isLoading, onClick }: { isFollowing: boolean; isLoading: boolean; onClick: () => void }) {
  return <Button variant={isFollowing ? "secondary" : "default"} size="sm" onClick={onClick} disabled={isLoading} aria-pressed={isFollowing}>{isLoading ? "Memproses..." : isFollowing ? "Mengikuti" : "Ikuti"}</Button>;
}