// src/components/PostCard.tsx
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, MessageCircle, Repeat2, Share2, MoreVertical, Pencil, Trash2, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { id } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import MediaCarousel from "./MediaCarousel";
import CommentSection from "./CommentSection";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MentionInput } from "./MentionInput";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface PostCardProps {
  post:{ id:string; content:string; created_at:string; updated_at?:string; media_urls?:string[]; media_types?:string[]; profiles:{ id:string; full_name:string; avatar_url?:string; role:string }; likes:any[] };
  currentUserId?:string; onLike?:()=>void; onPostUpdated?:()=>void; onPostDeleted?:()=>void;
}

const PostCard = ({ post, currentUserId, onLike, onPostUpdated, onPostDeleted }: PostCardProps) => {
  const [isLiked,setIsLiked]=useState(false); const [likeCount,setLikeCount]=useState(0);
  const [isReposted,setIsReposted]=useState(false); const [isEditing,setIsEditing]=useState(false);
  const [editContent,setEditContent]=useState(post.content); const [showDeleteDialog,setShowDeleteDialog]=useState(false);
  const [isDeleting,setIsDeleting]=useState(false); const [lightbox,setLightbox]=useState(false); const [idx,setIdx]=useState(0);
  const isOwnPost=currentUserId===post.profiles.id; const urls=post.media_urls||[]; const types=post.media_types||[]; const total=urls.length;

  useEffect(()=>{ if(currentUserId){ const liked=post.likes.some(l=>l.user_id===currentUserId); setIsLiked(liked); checkRepost(); } setLikeCount(post.likes.length); },[post.likes,currentUserId]);
  const checkRepost=async()=>{ if(!currentUserId) return; const {data}=await supabase.from("reposts").select("id").eq("user_id",currentUserId).eq("post_id",post.id).maybeSingle(); setIsReposted(!!data); };

  const getInitials=(n:string)=>{ const a=n.trim().split(" "); return (a[0][0]+(a[1]?.[0]||a[0][1]||"")).toUpperCase(); };
  const getRoleBadgeColor=(r:string)=>r==="siswa"?"bg-blue-500/20 text-blue-400":r==="guru"?"bg-green-500/20 text-green-400":r==="alumni"?"bg-purple-500/20 text-purple-400":"bg-muted text-muted-foreground";

  const handleLike=async()=>{ if(!currentUserId) return toast.error("Silakan login terlebih dahulu"); try{ if(isLiked){ const {error}=await supabase.from("likes").delete().eq("user_id",currentUserId).eq("post_id",post.id); if(error) throw error; setIsLiked(false); setLikeCount(v=>v-1);} else { const {error}=await supabase.from("likes").insert({user_id:currentUserId,post_id:post.id}); if(error) throw error; setIsLiked(true); setLikeCount(v=>v+1);} onLike?.(); }catch(e:any){ toast.error(e.message); } };
  const handleRepost=async()=>{ if(!currentUserId) return toast.error("Silakan login terlebih dahulu"); try{ if(isReposted){ const {error}=await supabase.from("reposts").delete().eq("user_id",currentUserId).eq("post_id",post.id); if(error) throw error; setIsReposted(false); toast.success("Repost dibatalkan"); } else { const {error}=await supabase.from("reposts").insert({user_id:currentUserId,post_id:post.id}); if(error) throw error; setIsReposted(true); toast.success("Berhasil di-repost!"); } }catch(e:any){ toast.error(e.message); } };
  const handleShare=()=>{ navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`); toast.success("Link postingan disalin!"); };
  const handleEditPost=async()=>{ if(!editContent.trim()) return toast.error("Konten postingan tidak boleh kosong"); try{ const {error}=await supabase.from("posts").update({content:editContent.trim()}).eq("id",post.id); if(error) throw error; setIsEditing(false); toast.success("Postingan berhasil diubah"); onPostUpdated?.(); }catch(e:any){ toast.error("Gagal mengubah postingan: "+e.message); } };
  const handleDeletePost=async()=>{ setIsDeleting(true); try{ const {error}=await supabase.from("posts").delete().eq("id",post.id); if(error) throw error; toast.success("Postingan berhasil dihapus"); onPostDeleted?.(); }catch(e:any){ toast.error("Gagal menghapus postingan: "+e.message); } finally{ setIsDeleting(false); setShowDeleteDialog(false); } };
  const next=()=>setIdx(i=>(i+1)%total); const prev=()=>setIdx(i=>(i-1+total)%total);
  const downloadCurrent=()=>{ const a=document.createElement("a"); a.href=urls[idx]; a.download=urls[idx].split("/").pop()||`media-${idx+1}`; document.body.appendChild(a); a.click(); a.remove(); };

  return (
    <Card className="rounded-2xl border border-border bg-card/80 p-5 shadow hover:shadow-lg transition">
      <div className="flex gap-4">
        <Avatar className="h-12 w-12 border border-border/60">
          <AvatarImage src={post.profiles.avatar_url} />
          <AvatarFallback className="bg-primary text-primary-foreground font-semibold">{getInitials(post.profiles.full_name)}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-2">
            <h3 className="font-semibold">{post.profiles.full_name}</h3>
            <span className={`rounded-full px-2 py-0.5 text-xs ${getRoleBadgeColor(post.profiles.role)}`}>{post.profiles.role[0].toUpperCase()+post.profiles.role.slice(1)}</span>
            <span className="text-sm text-muted-foreground">· {formatDistanceToNow(new Date(post.created_at),{addSuffix:true,locale:id})}</span>
            {isOwnPost&&!isEditing&&(
              <div className="ml-auto">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={()=>{setIsEditing(true);setEditContent(post.content);}}><Pencil className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                    <DropdownMenuItem onClick={()=>setShowDeleteDialog(true)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Hapus</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>

          {isEditing?(
            <div className="mb-3 space-y-3">
              <MentionInput value={editContent} onChange={setEditContent} placeholder="Edit postingan..." className="min-h-[100px] resize-none" multiline currentUserId={currentUserId} />
              <div className="flex gap-2"><Button size="sm" onClick={handleEditPost}>Simpan</Button><Button size="sm" variant="ghost" onClick={()=>{setIsEditing(false);setEditContent(post.content);}}>Batal</Button></div>
            </div>
          ):(
            <p className="mb-3 whitespace-pre-wrap text-foreground" dangerouslySetInnerHTML={{__html:post.content.replace(/@\[([^\]]+)\]\([a-f0-9\-]+\)/g,'<span class="text-primary font-semibold">@$1</span>')}}/>
          )}

          {!isEditing&&total>0&&(
            <>
              <div
                role="button"
                tabIndex={0}
                onClick={() => { setLightbox(true); setIdx(0); }}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { setLightbox(true); setIdx(0); } }}
                className="group w-full mt-3 cursor-pointer"
              >
                <div className="relative max-h-[420px] overflow-hidden rounded-xl border border-border/60 bg-black/5">
                  <MediaCarousel mediaUrls={urls} mediaTypes={types} />
                  <div className="absolute left-2 top-2 rounded-full bg-black/50 px-2 py-1 text-xs text-white">{total} media</div>
                  <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
                  <span className="absolute bottom-2 right-2 rounded-full bg-black/50 px-2 py-1 text-[11px] text-white opacity-0 transition group-hover:opacity-100">Klik untuk perbesar</span>
                </div>
              </div>

              <Dialog open={lightbox} onOpenChange={setLightbox}>
                <DialogContent className="max-w-5xl bg-black/90 p-0">
                  <div className="relative flex items-center justify-center bg-black">
                    {types[idx]?.startsWith("video")?(<video src={urls[idx]} controls className="max-h-[80vh] max-w-[95vw] rounded-lg"/>):(<img src={urls[idx]} alt="" className="max-h-[80vh] max-w-[95vw] rounded-lg object-contain"/>)}
                    {total>1&&(<><Button variant="ghost" size="icon" onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 text-white hover:bg-white/20"><ChevronLeft className="h-5 w-5"/></Button><Button variant="ghost" size="icon" onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 text-white hover:bg-white/20"><ChevronRight className="h-5 w-5"/></Button></>)}
                    <div className="absolute left-3 bottom-3 rounded-full bg-white/10 px-2 py-1 text-xs text-white">{idx+1} / {total}</div>
                    <div className="absolute right-3 bottom-3 flex gap-2">
                      <Button size="sm" variant="secondary" onClick={downloadCurrent} className="gap-2"><Download className="h-4 w-4"/>Unduh</Button>
                      {total>1&&(<DropdownMenu><DropdownMenuTrigger asChild><Button size="sm" variant="secondary">Unduh Semua</Button></DropdownMenuTrigger><DropdownMenuContent align="end">{urls.map((u,i)=>(<DropdownMenuItem key={u} onClick={()=>{const a=document.createElement("a");a.href=u;a.download=u.split("/").pop()||`media-${i+1}`;document.body.appendChild(a);a.click();a.remove();}}>Media {i+1}</DropdownMenuItem>))}</DropdownMenuContent></DropdownMenu>)}
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}

          <div className="mt-4 flex items-center gap-4">
            <Button variant="ghost" size="sm" className={`gap-2 ${isLiked?"text-red-500":"text-muted-foreground"} hover:text-red-500`} onClick={handleLike}><Heart className={`h-5 w-5 ${isLiked?"fill-current":""}`}/><span>{likeCount}</span></Button>
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-accent"><MessageCircle className="h-5 w-5"/></Button>
            <Button variant="ghost" size="sm" className={`gap-2 ${isReposted?"text-green-500":"text-muted-foreground"} hover:text-green-500`} onClick={handleRepost}><Repeat2 className="h-5 w-5"/></Button>
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-accent" onClick={handleShare}><Share2 className="h-5 w-5"/></Button>
          </div>

          <CommentSection postId={post.id} currentUserId={currentUserId} />
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Hapus Postingan</AlertDialogTitle><AlertDialogDescription>Apakah Anda yakin ingin menghapus postingan ini? Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={handleDeletePost} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{isDeleting?"Menghapus...":"Hapus"}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default PostCard;