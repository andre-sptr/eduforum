// src/pages/GroupDetail.tsx
import { useEffect, useState, useMemo } from "react"; 
import { Link, useNavigate,useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Avatar,AvatarFallback,AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft,Users,Send,MessageCircle,Pencil,Trash,Crown } from "lucide-react";
import { toast } from "sonner";
import PostCard from "@/components/PostCard";
import MediaUploader from "@/components/MediaUploader";
import { MediaFile,compressImage } from "@/lib/mediaUtils";
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogFooter,DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog,AlertDialogAction,AlertDialogCancel,AlertDialogContent,AlertDialogDescription,AlertDialogFooter,AlertDialogHeader,AlertDialogTitle } from "@/components/ui/alert-dialog";
import { RankBadge } from "@/components/RankBadge";

const GroupDetail=()=> {
  const navigate=useNavigate();
  const { groupId }=useParams();
  const [group,setGroup]=useState<any>(null);
  const [posts,setPosts]=useState<any[]>([]);
  const [members,setMembers]=useState<any[]>([]);
  const [currentUser,setCurrentUser]=useState<any>(null);
  const [isMember,setIsMember]=useState(false);
  const [loading,setLoading]=useState(true);
  const [newPostContent,setNewPostContent]=useState("");
  const [mediaFiles,setMediaFiles]=useState<MediaFile[]>([]);
  const [posting,setPosting]=useState(false);
  const [openEdit,setOpenEdit]=useState(false);
  const [editDesc,setEditDesc]=useState("");
  const [openDelete,setOpenDelete]=useState(false);
  const [chatOpening,setChatOpening]=useState(false);
  const [topFollowers, setTopFollowers] = useState<any[]>([]);
  const [topLiked, setTopLiked] = useState<any[]>([]);
  const isOwner=group?.created_by===currentUser?.id;

  const followerRankMap = useMemo(() =>
    new Map(topFollowers.slice(0, 3).map((u, i) => [u.id, i + 1]))
  , [topFollowers]);

  const likerRankMap = useMemo(() =>
    new Map(topLiked.slice(0, 3).map((u, i) => [u.id, i + 1]))
  , [topLiked]);

  useEffect(()=>{(async()=>{const{data:{user}}=await supabase.auth.getUser();if(!user){navigate("/auth");return;}setCurrentUser(user);
  const [tfRes, tlRes] = await Promise.all([
      supabase.rpc("get_top_5_followers"),
      supabase.rpc("get_top_5_liked_users")
    ]);
    if (tfRes.data) setTopFollowers(tfRes.data);
    if (tlRes.data) setTopLiked(tlRes.data);
    await loadGroupData(user.id);})()
  },[groupId]);

  const loadGroupData=async(userId:string)=> {
    try{
      const { data:groupData,error:groupError }=await supabase.from("groups").select(`*,profiles!groups_created_by_fkey(id, full_name,avatar_url)`).eq("id",groupId).single();
      if(groupError) throw groupError;
      setGroup(groupData); setEditDesc(groupData?.description||"");
      const { data:memberData }=await supabase.from("group_members").select("*").eq("group_id",groupId).eq("user_id",userId).single();
      setIsMember(!!memberData);
      if(!memberData&&groupData.is_private){ toast.error("Anda bukan anggota grup ini"); navigate("/groups"); return; }
      const { data:membersData }=await supabase.from("group_members").select(`*,profiles(id, full_name,avatar_url,role)`).eq("group_id",groupId);
      setMembers(membersData||[]);
      await loadPosts();
    }catch(e:any){ toast.error(e.message);}finally{ setLoading(false); }
  };

  const loadPosts = async () => {
    try {
      const { data, error } = await supabase
        .from("group_posts")
        .select(`
          *,
          profiles:profiles!user_id(id, full_name, avatar_url, role),
          likes:group_post_likes(user_id, post_id)
        `)
        .eq("group_id", groupId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const postsWithData = (data || []).map(p => ({
        ...p,
        likes: p.likes || [],
        reposts: [], 
        quote_reposts: [], 
      }));
      setPosts(postsWithData);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const uploadMedia=async(file:File,userId:string,type:string)=> {
    let f=file; if(type==="image") f=await compressImage(file);
    const ext=f.name.split(".").pop(); const name=`${userId}/${Date.now()}.${ext}`;
    const { error }=await supabase.storage.from("media").upload(name,f); if(error) throw error;
    const { data:{ publicUrl } }=supabase.storage.from("media").getPublicUrl(name);
    return publicUrl;
  };

  const handleCreatePost=async()=> {
    if(!newPostContent.trim()&&mediaFiles.length===0){ toast.error("Postingan tidak boleh kosong"); return; }
    setPosting(true);
    try{
      const urls:string[]=[]; const types:string[]=[];
      for(const m of mediaFiles){ const u=await uploadMedia(m.file,currentUser.id,m.type); urls.push(u); types.push(m.type); }
      const { error }=await supabase.from("group_posts").insert({ group_id:groupId, user_id:currentUser.id, content:newPostContent.trim(), media_urls:urls.length?urls:null, media_types:types.length?types:null });
      if(error) throw error;
      toast.success("Postingan berhasil dibuat!"); setNewPostContent(""); setMediaFiles([]); await loadPosts();
    }catch(e:any){ toast.error(e.message);}finally{ setPosting(false); }
  };

  const saveDescription=async()=> {
    if(!isOwner) return;
    try{ const { data,error }=await supabase.from("groups").update({ description:editDesc }).eq("id",groupId).select("id,description").single(); if(error) throw error; setGroup((g:any)=>({...g,description:data?.description||""})); setOpenEdit(false); toast.success("Deskripsi diperbarui"); }catch(e:any){ toast.error(e.message); }
  };

  const deleteGroup=async()=> {
    if(!isOwner) return;
    try{ const { error }=await supabase.rpc("delete_group_cascade",{ p_group_id:groupId }); if(error) throw error; toast.success("Grup berhasil dihapus"); navigate("/groups"); }catch(e:any){ toast.error(e.message); }
  };

  const openGroupChat=async()=> {
    if(!isMember){ toast.error("Bergabung ke grup untuk mengakses chat"); return; }
    setChatOpening(true);
    try{
      const { data:conversationId,error }=await supabase.rpc("create_group_conversation",{ p_group_id:groupId as string });
      if(error) throw error;
      if(conversationId){ navigate(`/chat/${conversationId}`); } else { toast.error("Gagal membuka chat grup"); }
    }catch(e:any){ toast.error(e.message);}finally{ setChatOpening(false); }
  };

  const getInitials=(n:string)=>{ const a=n.split(" "); return a.length>=2?(a[0][0]+a[1][0]).toUpperCase():n.slice(0,2).toUpperCase(); };

  if(loading) return (<div className="grid min-h-screen place-items-center bg-background"><div className="text-center"><div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-accent"/><p className="mt-4 text-muted-foreground">Memuat...</p></div></div>);
  if(!group) return (<div className="grid min-h-screen place-items-center bg-background"><p className="text-muted-foreground">Grup tidak ditemukan</p></div>);

  const ownerId=group?.created_by; const owner=members.find(m=>m.user_id===ownerId); const otherMembers=members.filter(m=>m.user_id!==ownerId);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur">
        <div className="container mx-auto flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={()=>navigate("/groups")} className="rounded-xl"><ArrowLeft className="h-5 w-5"/></Button>
          <div className="flex-1 min-w-0"><h1 className="truncate text-lg font-semibold">{group.name}</h1><p className="flex items-center gap-1 text-xs text-muted-foreground"><Users className="h-4 w-4"/>{members.length} anggota</p></div>
          <div className="flex items-center gap-2">
            {isMember&&<Button variant="outline" className="rounded-xl" onClick={openGroupChat} disabled={chatOpening}><MessageCircle className="mr-2 h-4 w-4"/>{chatOpening?"Membuka...":"Chat Grup"}</Button>}
            <Dialog open={openEdit} onOpenChange={v=>isOwner&&setOpenEdit(v)}>
              <DialogTrigger asChild><Button variant="outline" className="rounded-xl" disabled={!isOwner}><Pencil className="mr-2 h-4 w-4"/>Edit Deskripsi</Button></DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Edit Deskripsi Grup</DialogTitle></DialogHeader>
                <Textarea value={editDesc} onChange={e=>setEditDesc(e.target.value)} className="min-h-[140px]" placeholder="Tulis deskripsi grup..."/>
                <DialogFooter><Button variant="ghost" onClick={()=>setOpenEdit(false)}>Batal</Button><Button onClick={saveDescription} disabled={!isOwner||editDesc===group.description}>Simpan</Button></DialogFooter>
              </DialogContent>
            </Dialog>
            <AlertDialog open={openDelete} onOpenChange={v=>isOwner&&setOpenDelete(v)}>
              <Button variant="destructive" className="rounded-xl disabled:opacity-60" disabled={!isOwner} onClick={()=>isOwner&&setOpenDelete(true)}><Trash className="mr-2 h-4 w-4"/>Hapus Grup</Button>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Hapus Grup?</AlertDialogTitle><AlertDialogDescription>Tindakan ini menghapus semua data grup dan tidak dapat dibatalkan.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={deleteGroup}>Hapus</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          {group.profiles?.avatar_url&&(<Avatar className="ml-2 h-8 w-8 ring-1 ring-border"><AvatarImage src={group.profiles.avatar_url}/><AvatarFallback className="bg-primary text-primary-foreground font-semibold">{getInitials(group.profiles?.full_name||"G")}</AvatarFallback></Avatar>)}
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[280px_1fr]">
          <aside className="space-y-4">
            <Card className="border-border bg-card/60">
              <div className="p-4 border-b border-border"><p className="text-sm font-medium">Anggota</p></div>
              <div className="max-h-[70vh] overflow-y-auto p-2">
                {owner&&(
                  <Link to={`/profile/${owner.user_id}`} className="mb-2 block rounded-lg border border-border bg-muted/40 p-2 hover:bg-muted/60 transition">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 ring-1 ring-border"><AvatarImage src={owner.profiles?.avatar_url||""}/><AvatarFallback className="bg-primary text-primary-foreground font-semibold">{getInitials(owner.profiles?.full_name||"O")}</AvatarFallback></Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold">{owner.profiles?.full_name || "Owner"}</p>
                          <RankBadge rank={followerRankMap.get(owner.user_id)} type="follower" />
                          <RankBadge rank={likerRankMap.get(owner.user_id)} type="like" />
                        </div>
                      </div>
                      <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-foreground/80"><Crown className="h-3 w-3"/>Owner</span>
                    </div>
                  </Link>
                )}
                {otherMembers.length===0?(
                  <div className="p-4 text-sm text-muted-foreground">{owner?"Belum ada anggota lain":"Belum ada anggota"}</div>
                ):otherMembers.map(m=>(
                  <Link to={`/profile/${m.user_id}`} key={m.id} className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/50 transition">
                    <Avatar className="h-8 w-8 ring-1 ring-border"><AvatarImage src={m.profiles?.avatar_url||""}/><AvatarFallback className="bg-primary text-primary-foreground font-semibold">{getInitials(m.profiles?.full_name||"U")}</AvatarFallback></Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">{m.profiles?.full_name || "Pengguna"}</p>
                        <RankBadge rank={followerRankMap.get(m.user_id)} type="follower" />
                        <RankBadge rank={likerRankMap.get(m.user_id)} type="like" />
                      </div>
                    {m.profiles?.role&&<p className="truncate text-xs text-muted-foreground">{m.profiles.role}</p>}
                    </div>
                  </Link>
                ))}
              </div>
            </Card>
          </aside>

          <main className="space-y-6">
            {group.description&&(<Card className="border-border bg-card/60 p-5"><p className="text-sm leading-relaxed text-foreground/90">{group.description}</p></Card>)}
            {isMember&&(<Card className="border-border bg-card/60 p-5"><Textarea value={newPostContent} onChange={e=>setNewPostContent(e.target.value)} placeholder="Bagikan sesuatu dengan grup..." className="mb-3 min-h-[110px] resize-none rounded-xl bg-input/60"/><MediaUploader onMediaChange={setMediaFiles}/><div className="mt-4 flex justify-end"><Button onClick={handleCreatePost} disabled={posting||(!newPostContent.trim()&&mediaFiles.length===0)} className="rounded-xl bg-accent text-accent-foreground hover:bg-accent/90"><Send className="mr-2 h-4 w-4"/>{posting?"Memposting...":"Posting"}</Button></div></Card>)}
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