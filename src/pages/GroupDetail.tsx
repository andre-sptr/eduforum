import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Users, Send, MessageCircle, Pencil, Trash, Crown, UserPlus } from "lucide-react";
import { toast } from "sonner";
import PostCard from "@/components/PostCard";
import MediaUploader from "@/components/MediaUploader";
import { MediaFile, compressImage } from "@/lib/mediaUtils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLeaderboardData } from "@/hooks/useLeaderboardData";
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
  const [userToConfirmAdd, setUserToConfirmAdd] = useState<any | null>(null);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const isOwner = group?.created_by === currentUser?.id;
  const { topFollowers, topLiked } = useLeaderboardData();
  
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

  const joinGroup = async () => {
    try {
        const { error } = await supabase.from("group_members").insert({ group_id: groupId, user_id: currentUser.id, role: "member" });
        if (error) throw error;
        toast.success("Berhasil bergabung ke grup!");
        await loadGroupData(currentUser.id);
    } catch (e: any) {
        toast.error(e.message);
    }
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
    <div className="space-y-6 pb-20">
      <Card className="border-white/10 bg-card/40 backdrop-blur-xl p-8 rounded-3xl overflow-hidden relative shadow-xl">
        {}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />
        
        <div className="flex flex-col md:flex-row gap-8 relative z-10">
          <div className="flex-1 space-y-4">
             <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate("/groups")} className="rounded-xl hover:bg-white/10"><ArrowLeft className="h-5 w-5" /></Button>
                <div>
                   <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">{group.name}</h1>
                   <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                       <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/40 border border-white/5">
                           <Users className="h-3.5 w-3.5" />{members.length} anggota
                       </span>
                       <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                       <span>{group.is_private ? "Privat" : "Publik"}</span>
                   </div>
                </div>
             </div>
             
             {group.description && (
                 <p className="text-muted-foreground leading-relaxed max-w-2xl bg-muted/20 p-4 rounded-2xl border border-white/5 backdrop-blur-sm">
                     {group.description}
                 </p>
             )}
             
             <div className="flex items-center gap-3 flex-wrap pt-2">
               {isMember ? (
                   <Button className="rounded-xl shadow-lg shadow-primary/20 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-6 font-medium transition-all hover:scale-105" onClick={openGroupChat} disabled={chatOpening}>
                       <MessageCircle className="mr-2 h-4 w-4" />{chatOpening ? "Membuka..." : "Chat Grup"}
                   </Button>
               ) : (
                   <Button className="rounded-xl shadow-lg shadow-primary/20 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-8 font-semibold transition-all hover:scale-105" onClick={joinGroup}>
                       <UserPlus className="mr-2 h-4 w-4" /> Gabung Grup
                   </Button>
               )}

               {isOwner && (
                 <>
                   <Dialog open={openEdit} onOpenChange={v => isOwner && setOpenEdit(v)}>
                    <DialogTrigger asChild>
                        <Button variant="outline" className="rounded-xl border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20">
                            <Pencil className="mr-2 h-4 w-4" />Edit Info
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-xl border-white/10">
                      <DialogHeader><DialogTitle>Edit Deskripsi Grup</DialogTitle></DialogHeader>
                      <Textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} className="min-h-[140px] bg-muted/50 border-white/10" placeholder="Tulis deskripsi grup..." />
                      <DialogFooter><Button variant="ghost" onClick={() => setOpenEdit(false)}>Batal</Button><Button onClick={saveDescription} disabled={!isOwner || editDesc === group.description}>Simpan</Button></DialogFooter>
                    </DialogContent>
                  </Dialog>
                   <Button variant="destructive" className="rounded-xl shadow-lg shadow-destructive/20 hover:scale-105 transition-all" onClick={() => setOpenDelete(true)}>
                       <Trash className="mr-2 h-4 w-4" />Hapus Grup
                   </Button>
                 </>
               )}
             </div>
          </div>
          
          {group.profiles?.avatar_url && (
              <div className="relative group">
                  <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                  <Avatar className="h-32 w-32 ring-4 ring-card shadow-2xl relative z-10">
                      <AvatarImage src={group.profiles.avatar_url} className="object-cover" />
                      <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground text-3xl font-bold">
                          {getInitials(group.profiles?.full_name || "G")}
                      </AvatarFallback>
                  </Avatar>
              </div>
          )}
        </div>
      </Card>

      <Tabs defaultValue="feed" className="w-full">
        <TabsList className="w-full justify-start rounded-2xl bg-card/40 backdrop-blur-md p-1.5 mb-8 border border-white/5">
          <TabsTrigger value="feed" className="rounded-xl px-8 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">Diskusi</TabsTrigger>
          <TabsTrigger value="members" className="rounded-xl px-8 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">Anggota ({members.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="feed" className="space-y-8 animate-in fade-in-50 slide-in-from-bottom-4 duration-700">
           {}
            {isMember && (
              <Card className="border-white/10 bg-card/40 backdrop-blur-md p-6 rounded-3xl shadow-lg">
                <div className="flex gap-4">
                    <Avatar className="h-10 w-10 ring-2 ring-white/10">
                        <AvatarImage src={currentUser?.user_metadata?.avatar_url} />
                        <AvatarFallback className="bg-primary/20 text-primary font-bold">{getInitials(currentUser?.user_metadata?.full_name || "Me")}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-4">
                        <MentionInput 
                          value={newPostContent} 
                          onChange={setNewPostContent} 
                          placeholder={`Apa yang ingin Anda diskusikan di ${group.name}?`}
                          className="min-h-[100px] resize-none rounded-2xl bg-muted/30 border-white/5 focus:bg-muted/50 transition-all p-4 text-base"
                          multiline
                          currentUserId={currentUser?.id}
                          allowedUserIds={memberIds}
                        />
                        <div className="flex justify-between items-end">
                            <MediaUploader onMediaChange={setMediaFiles} />
                            <Button onClick={handleCreatePost} disabled={posting || (!newPostContent.trim() && mediaFiles.length === 0)} className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 px-6 shadow-md hover:shadow-lg transition-all">
                                <Send className="mr-2 h-4 w-4" />{posting ? "Memposting..." : "Posting"}
                            </Button>
                        </div>
                    </div>
                </div>
              </Card>
            )}
            
            {posts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground bg-card/20 backdrop-blur-sm rounded-3xl border border-dashed border-white/10">
                <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mb-4">
                    <MessageCircle className="h-8 w-8 opacity-50" />
                </div>
                <p className="text-lg font-medium">{isMember ? "Belum ada diskusi. Mulai percakapan!" : "Bergabung untuk melihat diskusi"}</p>
                {!isMember && (
                    <Button variant="link" onClick={joinGroup} className="text-primary mt-2 font-medium">Gabung Grup Sekarang</Button>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {posts.map(p => (
                  <PostCard
                    key={p.id}
                    post={p}
                    currentUserId={currentUser?.id}
                    postType="group"
                    topFollowers={topFollowers}
                    topLiked={topLiked}
                    onPostDeleted={() => setPosts(currentPosts => currentPosts.filter(post => post.id !== p.id))}
                    allowedUserIds={memberIds}
                  />
                ))}
              </div>
            )}
        </TabsContent>

        <TabsContent value="members" className="animate-in fade-in-50 slide-in-from-bottom-4 duration-700">
          <Card className="border-white/10 bg-card/40 backdrop-blur-md rounded-3xl overflow-hidden shadow-lg">
             <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
                <div>
                    <h3 className="text-lg font-semibold flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> Daftar Anggota</h3>
                    <p className="text-sm text-muted-foreground">Orang-orang yang tergabung dalam grup ini</p>
                </div>
                {isOwner && (
                  <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
                    <DialogTrigger asChild>
                      <Button className="rounded-xl gap-2 shadow-md bg-primary text-primary-foreground hover:bg-primary/90">
                        <UserPlus className="h-4 w-4" /> Undang
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-xl border-white/10">
                      <DialogHeader>
                        <DialogTitle>Undang Anggota</DialogTitle>
                        <DialogDescription>
                          Cari nama pengguna untuk ditambahkan ke grup ini.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                          <Input
                            placeholder="Cari nama..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-muted/50 border-white/10 rounded-xl"
                          />
                          <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                            {isSearching && <p className="text-sm text-muted-foreground text-center py-4">Mencari...</p>}
                            {!isSearching && searchResults.length === 0 && searchQuery.length > 1 && (
                              <p className="text-sm text-muted-foreground text-center py-4">Tidak ada hasil ditemukan.</p>
                            )}
                            {searchResults.map(user => (
                              <div key={user.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 border border-transparent hover:border-white/5 transition-all">
                                <Avatar className="h-10 w-10 ring-2 ring-white/10">
                                  <AvatarImage src={user.avatar_url || ""} />
                                  <AvatarFallback className="bg-primary text-primary-foreground font-semibold">{getInitials(user.full_name)}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold truncate">{user.full_name}</p>
                                  <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
                                </div>
                                <Button
                                  size="sm"
                                  onClick={() => setUserToConfirmAdd(user)}
                                  className="rounded-lg bg-primary/10 text-primary hover:bg-primary/20 shadow-none border-none"
                                >
                                  <UserPlus className="h-4 w-4 mr-2" />
                                  Tambah
                                </Button>
                              </div>
                            ))}
                          </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
             </div>
             <div className="p-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {owner && (
                  <Link to={`/profile/${owner.user_id}`} className="flex items-center gap-4 rounded-2xl border border-yellow-500/30 bg-yellow-500/5 p-4 hover:bg-yellow-500/10 transition-all group relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/0 via-yellow-500/5 to-yellow-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                    <Avatar className="h-12 w-12 ring-2 ring-yellow-500/50 shadow-md"><AvatarImage src={owner.profiles?.avatar_url || ""} /><AvatarFallback className="bg-yellow-600 text-white font-bold">{getInitials(owner.profiles?.full_name || "O")}</AvatarFallback></Avatar>
                    <div className="min-w-0 z-10">
                       <p className="truncate text-base font-bold text-foreground group-hover:text-yellow-500 transition-colors">{owner.profiles?.full_name || "Owner"}</p>
                       <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-500/20 px-2.5 py-0.5 text-xs text-yellow-600 font-bold border border-yellow-500/20"><Crown className="h-3 w-3 fill-current" />Owner</span>
                    </div>
                  </Link>
                )}
                {otherMembers.map(m => (
                  <Link to={`/profile/${m.user_id}`} key={m.id} className="flex items-center gap-4 rounded-2xl border border-white/5 bg-white/5 p-4 hover:bg-white/10 hover:border-primary/20 hover:shadow-lg transition-all group">
                    <Avatar className="h-12 w-12 ring-2 ring-white/10 group-hover:ring-primary/40 transition-all"><AvatarImage src={m.profiles?.avatar_url || ""} /><AvatarFallback className="bg-primary/20 text-primary font-bold">{getInitials(m.profiles?.full_name || "U")}</AvatarFallback></Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-foreground group-hover:text-primary transition-colors">{m.profiles?.full_name || "Pengguna"}</p>
                      <p className="truncate text-xs text-muted-foreground capitalize flex items-center gap-1">
                          <span className={`w-1.5 h-1.5 rounded-full ${m.profiles?.role === 'guru' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                          {m.profiles?.role}
                      </p>
                    </div>
                  </Link>
                ))}
             </div>
          </Card>
        </TabsContent>
      </Tabs>
            
      <AlertDialog open={openDelete} onOpenChange={v => isOwner && setOpenDelete(v)}>
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
              Apakah Anda yakin ingin menambahkan <span className="font-bold">{userToConfirmAdd?.full_name}</span> sebagai anggota grup "{group.name}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setUserToConfirmAdd(null)}>Batal</AlertDialogCancel>
            <AlertDialogAction className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => { if (userToConfirmAdd) { handleAddMember(userToConfirmAdd); } setUserToConfirmAdd(null); setShowInviteDialog(false); }}>Ya, Tambahkan</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default GroupDetail;