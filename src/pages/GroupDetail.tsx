import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Users, Send, MessageCircle, Pencil, Trash, Crown, UserPlus } from "lucide-react";
import { toast } from "sonner";
import PostCard from "@/components/PostCard";
import MediaUploader from "@/components/MediaUploader";
import { MediaFile, compressImage } from "@/lib/mediaUtils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { RankBadge } from "@/components/RankBadge";
import { Input } from "@/components/ui/input";
// Impor MentionInput
import { MentionInput } from "@/components/MentionInput";

const getInitials = (n: string) => {
  const a = n.split(" ");
  return a.length >= 2 ? (a[0][0] + a[1][0]).toUpperCase() : n.slice(0, 2).toUpperCase();
};

const GroupDetail = () => {
  const navigate = useNavigate();
  const { groupId } = useParams();
  const [group, setGroup] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newPostContent, setNewPostContent] = useState("");
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [posting, setPosting] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [editDesc, setEditDesc] = useState("");
  const [openDelete, setOpenDelete] = useState(false);
  const [chatOpening, setChatOpening] = useState(false);
  const [spotifyTrack, setSpotifyTrack] = useState<any>(null);
  const [showSpotifySearch, setShowSpotifySearch] = useState(false);
  const [topFollowers, setTopFollowers] = useState<any[]>([]);
  const [topLiked, setTopLiked] = useState<any[]>([]);
  const [userToConfirmAdd, setUserToConfirmAdd] = useState<any | null>(null);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const isOwner = group?.created_by === currentUser?.id;

  const followerRankMap = useMemo(() => new Map(topFollowers.slice(0, 3).map((u, i) => [u.id, i + 1])), [topFollowers]);
  const likerRankMap = useMemo(() => new Map(topLiked.slice(0, 3).map((u, i) => [u.id, i + 1])), [topLiked]);
  
  const memberIds = useMemo(() => members.map(m => m.user_id), [members]);

  const loadGroupData = async (userId: string) => {
    try {
      const { data: groupData, error: groupError } = await supabase.from("groups").select(`*,profiles!groups_created_by_fkey(id, full_name,avatar_url)`).eq("id", groupId).single();
      if (groupError) throw groupError;
      setGroup(groupData);
      setEditDesc(groupData?.description || "");
      const { data: memberData } = await supabase.from("group_members").select("*").eq("group_id", groupId).eq("user_id", userId).single();
      setIsMember(!!memberData);
      if (!memberData && groupData.is_private) {
        toast.error("Anda bukan anggota grup ini");
        navigate("/groups");
        return;
      }
      const { data: membersData } = await supabase.from("group_members").select(`*,profiles(id, full_name,avatar_url,role)`).eq("group_id", groupId);
      setMembers(membersData || []);
      await loadPosts();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadPosts = async (reset = false) => {
    try {
      const { data, error } = await supabase
        .from("group_posts")
        .select(`*, profiles:profiles!user_id(id, full_name, avatar_url, role), likes:group_post_likes(user_id, post_id), spotify_track_id`)
        .eq("group_id", groupId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const postsWithData = (data || []).map(p => ({ ...p, likes: p.likes || [], reposts: [], quote_reposts: [] }));
      
      if (reset) {
        setPosts(postsWithData);
      } else {
        setPosts(postsWithData);
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      setCurrentUser(user);
      const [tfRes, tlRes] = await Promise.all([
        supabase.rpc("get_top_5_followers"),
        supabase.rpc("get_top_5_liked_users")
      ]);
      if (tfRes.data) setTopFollowers(tfRes.data);
      if (tlRes.data) setTopLiked(tlRes.data);
      await loadGroupData(user.id);
    })()
  }, [groupId]);

  useEffect(() => {
    if (!showInviteDialog) {
      setSearchResults([]);
      setSearchQuery("");
      return;
    }
    const handler = setTimeout(() => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([]);
        return;
      }
      searchUsers(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery, showInviteDialog]);

  useEffect(() => {
    if (!groupId) return;
    const handleRefresh = () => loadPosts(true);
    
    const postsChannel = supabase
      .channel(`group-posts-${groupId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_posts", filter: `group_id=eq.${groupId}` }, handleRefresh)
      .subscribe();
      
    const likesChannel = supabase
      .channel(`group-likes-${groupId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_post_likes" }, (payload: any) => {
        handleRefresh();
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(postsChannel);
      supabase.removeChannel(likesChannel);
    };
  }, [groupId, supabase]);

  const searchUsers = async (query: string) => {
    if (!query.trim()) return;
    setIsSearching(true);
    try {
      const memberIds = members.map(m => m.user_id);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, role")
        .ilike("full_name", `%${query}%`)
        .neq("id", currentUser.id)
        .not("id", "in", `(${memberIds.join(',')})`)
        .limit(10);
      if (error) throw error;
      setSearchResults(data || []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddMember = async (profileToAdd: any) => {
    if (!isOwner || !groupId) return;
    const adminProfile = members.find(m => m.user_id === currentUser.id)?.profiles;
    const adminName = adminProfile?.full_name || "Pemilik grup";
    
    try {
      const { error } = await supabase.from("group_members").insert({ group_id: groupId, user_id: profileToAdd.id, role: "member" });
      if (error) throw error;
      const { error: notifError } = await supabase
        .from("notifications")
        .insert({
          user_id: profileToAdd.id,
          type: 'group_invite',
          title: 'Anda diundang ke Grup',
          message: `${adminName} menambahkan Anda ke grup "${group.name}".`,
          link: `/groups/${groupId}`,
          reference_id: groupId,
          reference_type: 'group'
        });
      if (notifError) console.error("Gagal mengirim notifikasi:", notifError.message);

      toast.success(`${profileToAdd.full_name} telah ditambahkan ke grup!`);
      setMembers(prev => [...prev, { user_id: profileToAdd.id, profiles: profileToAdd, role: 'member', group_id: groupId, id: Math.random().toString() }]);
      setSearchResults(prev => prev.filter(u => u.id !== profileToAdd.id)); 
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const uploadMedia = async (file: File, userId: string, type: string) => {
    let f = file; if (type === "image") f = await compressImage(file);
    const ext = f.name.split(".").pop(); const name = `${userId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("media").upload(name, f); if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from("media").getPublicUrl(name);
    return publicUrl;
  };

  const handleCreatePost = async () => {
    if (!newPostContent.trim() && mediaFiles.length === 0) { toast.error("Postingan tidak boleh kosong"); return; }
    setPosting(true);
    try {
      const urls: string[] = []; const types: string[] = [];
      for (const m of mediaFiles) { const u = await uploadMedia(m.file, currentUser.id, m.type); urls.push(u); types.push(m.type); }
      const { error } = await supabase.from("group_posts").insert({ group_id: groupId, user_id: currentUser.id, content: newPostContent.trim(), media_urls: urls.length ? urls : null, media_types: types.length ? types : null, spotify_track_id: spotifyTrack?.trackId || null });
      if (error) throw error;
      toast.success("Postingan berhasil dibuat!"); setNewPostContent(""); setMediaFiles([]); setSpotifyTrack(null);
      await loadPosts(true);
    } catch (e: any) { toast.error(e.message); } finally { setPosting(false); }
  };

  const saveDescription = async () => {
    if (!isOwner) return;
    try { const { data, error } = await supabase.from("groups").update({ description: editDesc }).eq("id", groupId).select("id,description").single(); if (error) throw error; setGroup((g: any) => ({ ...g, description: data?.description || "" })); setOpenEdit(false); toast.success("Deskripsi diperbarui"); } catch (e: any) { toast.error(e.message); }
  };

  const deleteGroup = async () => {
    if (!isOwner) return;
    try { const { error } = await supabase.rpc("delete_group_cascade", { p_group_id: groupId }); if (error) throw error; toast.success("Grup berhasil dihapus"); navigate("/groups"); } catch (e: any) { toast.error(e.message); }
  };

  const openGroupChat = async () => {
    if (!isMember) { toast.error("Bergabung ke grup untuk mengakses chat"); return; }
    setChatOpening(true);
    try {
      const { data: conversationId, error } = await supabase.rpc("create_group_conversation", { p_group_id: groupId as string });
      if (error) throw error;
      if (conversationId) { navigate(`/chat/${conversationId}`); } else { toast.error("Gagal membuka chat grup"); }
    } catch (e: any) { toast.error(e.message); } finally { setChatOpening(false); }
  };

  if (loading) return (<div className="grid min-h-screen place-items-center bg-background"><div className="text-center"><div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-accent" /><p className="mt-4 text-muted-foreground">Memuat...</p></div></div>);
  if (!group) return (<div className="grid min-h-screen place-items-center bg-background"><p className="text-muted-foreground">Grup tidak ditemukan</p></div>);

  const ownerId = group?.created_by; const owner = members.find(m => m.user_id === ownerId); const otherMembers = members.filter(m => m.user_id !== ownerId);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur">
        <div className="container mx-auto flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/groups")} className="rounded-xl"><ArrowLeft className="h-5 w-5" /></Button>
          <div className="flex-1 min-w-0"><h1 className="truncate text-lg font-semibold">{group.name}</h1><p className="flex items-center gap-1 text-xs text-muted-foreground"><Users className="h-4 w-4" />{members.length} anggota</p></div>
          <div className="flex items-center gap-2">
            {isMember && <Button variant="outline" className="rounded-xl" onClick={openGroupChat} disabled={chatOpening}><MessageCircle className="mr-2 h-4 w-4" />{chatOpening ? "Membuka..." : "Chat Grup"}</Button>}
            <Dialog open={openEdit} onOpenChange={v => isOwner && setOpenEdit(v)}>
              <DialogTrigger asChild><Button variant="outline" className="rounded-xl" disabled={!isOwner}><Pencil className="mr-2 h-4 w-4" />Edit Deskripsi</Button></DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Edit Deskripsi Grup</DialogTitle></DialogHeader>
                <Textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} className="min-h-[140px]" placeholder="Tulis deskripsi grup..." />
                <DialogFooter><Button variant="ghost" onClick={() => setOpenEdit(false)}>Batal</Button><Button onClick={saveDescription} disabled={!isOwner || editDesc === group.description}>Simpan</Button></DialogFooter>
              </DialogContent>
            </Dialog>
            <AlertDialog open={openDelete} onOpenChange={v => isOwner && setOpenDelete(v)}>
              <Button variant="destructive" className="rounded-xl disabled:opacity-60" disabled={!isOwner} onClick={() => isOwner && setOpenDelete(true)}><Trash className="mr-2 h-4 w-4" />Hapus Grup</Button>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Hapus Grup?</AlertDialogTitle><AlertDialogDescription>Tindakan ini menghapus semua data grup dan tidak dapat dibatalkan.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={deleteGroup}>Hapus</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <AlertDialog open={!!userToConfirmAdd} onOpenChange={() => setUserToConfirmAdd(null)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Konfirmasi Tambah Anggota</AlertDialogTitle>
                  <AlertDialogDescription>
                    Apakah Anda yakin ingin menambahkan{" "}
                    <span className="font-bold">{userToConfirmAdd?.full_name}</span>{" "}
                    sebagai anggota grup "{group.name}"?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setUserToConfirmAdd(null)}>Batal</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-accent text-accent-foreground hover:bg-accent/90"
                    onClick={() => {
                      if (userToConfirmAdd) {
                        handleAddMember(userToConfirmAdd);
                      }
                      setUserToConfirmAdd(null);
                      setShowInviteDialog(false);
                    }}
                  >
                    Ya, Tambahkan
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          {group.profiles?.avatar_url && (<Avatar className="ml-2 h-8 w-8 ring-1 ring-border"><AvatarImage src={group.profiles.avatar_url} /><AvatarFallback className="bg-primary text-primary-foreground font-semibold">{getInitials(group.profiles?.full_name || "G")}</AvatarFallback></Avatar>)}
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[280px_1fr]">
          <aside className="space-y-4">
            <Card className="border-border bg-card/60">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <p className="text-sm font-medium">Anggota ({members.length})</p>
                {isOwner && (
                  <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" title="Undang Anggota">
                        <UserPlus className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Undang Anggota</DialogTitle>
                        <DialogDescription>
                          Cari nama pengguna untuk ditambahkan ke grup ini.
                        </DialogDescription>
                      </DialogHeader>
                      <Input
                        placeholder="Cari nama..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-input/60 border-border"
                      />
                      <div className="max-h-60 overflow-y-auto space-y-2 mt-2">
                        {isSearching && <p className="text-sm text-muted-foreground text-center">Mencari...</p>}
                        {!isSearching && searchResults.length === 0 && searchQuery.length > 1 && (
                          <p className="text-sm text-muted-foreground text-center">Tidak ada hasil.</p>
                        )}
                        {searchResults.map(user => (
                          <div key={user.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={user.avatar_url || ""} />
                              <AvatarFallback className="bg-primary text-primary-foreground font-semibold">{getInitials(user.full_name)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{user.full_name}</p>
                              <p className="text-xs text-muted-foreground">{user.role}</p>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => setUserToConfirmAdd(user)}
                              className="bg-accent text-accent-foreground hover:bg-accent/90"
                            >
                              <UserPlus className="h-4 w-4 mr-2" />
                              Tambah
                            </Button>
                          </div>
                        ))}
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
              <div className="max-h-[70vh] overflow-y-auto p-2">
                {owner && (
                  <Link to={`/profile/${owner.user_id}`} className="mb-2 block rounded-lg border border-border bg-muted/40 p-2 hover:bg-muted/60 transition">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 ring-1 ring-border"><AvatarImage src={owner.profiles?.avatar_url || ""} /><AvatarFallback className="bg-primary text-primary-foreground font-semibold">{getInitials(owner.profiles?.full_name || "O")}</AvatarFallback></Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold">{owner.profiles?.full_name || "Owner"}</p>
                          <RankBadge rank={followerRankMap.get(owner.user_id)} type="follower" />
                          <RankBadge rank={likerRankMap.get(owner.user_id)} type="like" />
                        </div>
                      </div>
                      <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-foreground/80"><Crown className="h-3 w-3" />Owner</span>
                    </div>
                  </Link>
                )}
                {otherMembers.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground">{owner ? "Belum ada anggota lain" : "Belum ada anggota"}</div>
                ) : otherMembers.map(m => (
                  <Link to={`/profile/${m.user_id}`} key={m.id} className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/50 transition">
                    <Avatar className="h-8 w-8 ring-1 ring-border"><AvatarImage src={m.profiles?.avatar_url || ""} /><AvatarFallback className="bg-primary text-primary-foreground font-semibold">{getInitials(m.profiles?.full_name || "U")}</AvatarFallback></Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">{m.profiles?.full_name || "Pengguna"}</p>
                        <RankBadge rank={followerRankMap.get(m.user_id)} type="follower" />
                        <RankBadge rank={likerRankMap.get(m.user_id)} type="like" />
                      </div>
                      {m.profiles?.role && <p className="truncate text-xs text-muted-foreground">{m.profiles.role}</p>}
                    </div>
                  </Link>
                ))}
              </div>
            </Card>
          </aside>

          <main className="space-y-6">
            {group.description && (<Card className="border-border bg-card/60 p-5"><p className="text-sm leading-relaxed text-foreground/90">{group.description}</p></Card>)}
            
            {/* GANTI DARI TEXTAREA KE MENTIONINPUT */}
            {isMember && (
              <Card className="border-border bg-card/60 p-5">
                <MentionInput 
                  value={newPostContent} 
                  onChange={setNewPostContent} 
                  placeholder="Bagikan sesuatu dengan grup..." 
                  className="mb-3 min-h-[110px] resize-none rounded-xl bg-input/60"
                  multiline
                  currentUserId={currentUser?.id}
                  allowedUserIds={memberIds}
                />
                <MediaUploader onMediaChange={setMediaFiles} />
                <div className="mt-4 flex justify-end">
                  <Button onClick={handleCreatePost} disabled={posting || (!newPostContent.trim() && mediaFiles.length === 0)} className="rounded-xl bg-accent text-accent-foreground hover:bg-accent/90">
                    <Send className="mr-2 h-4 w-4" />{posting ? "Memposting..." : "Posting"}
                  </Button>
                </div>
              </Card>
            )}
            
            {posts.length === 0 ? (
              <Card className="grid place-items-center border-border bg-card/60 p-10 text-sm text-muted-foreground">
                {isMember ? "Belum ada postingan. Jadilah yang pertama!" : "Bergabung untuk melihat postingan"}
              </Card>
            ) : (
              <div className="space-y-4">
                {posts.map(p => (
                  <PostCard
                    key={p.id}
                    post={p}
                    currentUserId={currentUser?.id}
                    postType="group"
                    topFollowers={topFollowers}
                    topLiked={topLiked}
                    // onLike={() => loadPosts(true)}
                    onPostDeleted={() => setPosts(currentPosts => currentPosts.filter(post => post.id !== p.id))}
                    allowedUserIds={memberIds}
                  />
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default GroupDetail;