// src/components/CommentSection.tsx
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageCircle, Reply, Send, Pencil, Trash2, X, Check } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { id } from "date-fns/locale";
import { z } from "zod";
import { MentionInput } from "./MentionInput";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const commentSchema = z.object({ content: z.string().trim().min(1,"Comment cannot be empty").max(1000,"Comment is too long (max 1000 characters)") });

interface Comment { id:string; content:string; created_at:string; user_id:string; parent_id:string|null; profiles:{ id:string; full_name:string; avatar_url?:string; role:string }; replies?:Comment[] }
interface Props { postId:string; currentUserId?:string }

const CommentSection = ({ postId, currentUserId }: Props) => {
  const [comments,setComments]=useState<Comment[]>([]);
  const [newComment,setNewComment]=useState(""); const [replyTo,setReplyTo]=useState<string|null>(null);
  const [loading,setLoading]=useState(false); const [showComments,setShowComments]=useState(false);
  const [editingCommentId,setEditingCommentId]=useState<string|null>(null); const [editContent,setEditContent]=useState("");
  const [deleteCommentId,setDeleteCommentId]=useState<string|null>(null);
  const [totalCount,setTotalCount]=useState<number|null>(null);

  useEffect(()=>{ loadCount();
    const ch=supabase.channel(`comments-count-${postId}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"comments",filter:`post_id=eq.${postId}`},()=>loadCount())
      .subscribe();
    return()=>{ supabase.removeChannel(ch); };
  },[postId]);

  useEffect(()=>{ if(!showComments) return;
    loadComments();
    const ch=supabase.channel(`comments-${postId}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"comments",filter:`post_id=eq.${postId}`},()=>loadComments())
      .subscribe();
    return()=>{ supabase.removeChannel(ch); };
  },[postId,showComments]);

  const loadCount=async()=>{ const { count,error }=await supabase.from("comments").select("*",{ head:true, count:"exact" }).eq("post_id",postId);
    if(error){ setTotalCount(0); return; } setTotalCount(count??0);
  };

  const loadComments=async()=> {
    const { data,error } = await supabase.from("comments").select(`*,profiles(id,full_name,avatar_url,role)`).eq("post_id",postId).order("created_at",{ascending:true});
    if(error){ toast.error(error.message); return; }
    const map=new Map<string,Comment>(); const roots:Comment[]=[];
    data.forEach((c:any)=>map.set(c.id,{...c,replies:[]})); data.forEach((c:any)=>{ if(c.parent_id){ const p=map.get(c.parent_id); if(p) p.replies?.push(map.get(c.id)!); } else roots.push(map.get(c.id)!); });
    setComments(roots);
  };

  const handleSubmitComment=async()=> {
    if(!currentUserId) return;
    try{ commentSchema.parse({content:newComment}); }catch(e:any){ if(e instanceof z.ZodError) toast.error(e.errors[0].message); return; }
    setLoading(true);
    try{ const {error}=await supabase.from("comments").insert({post_id:postId,user_id:currentUserId,parent_id:replyTo,content:newComment.trim()}); if(error) throw error;
      setNewComment(""); setReplyTo(null); toast.success("Komentar berhasil ditambahkan");
    }catch(e:any){ toast.error(e.message); } finally{ setLoading(false); }
  };

  const handleEditComment=async(id:string)=> {
    if(!currentUserId) return;
    try{ commentSchema.parse({content:editContent}); }catch(e:any){ if(e instanceof z.ZodError) toast.error(e.errors[0].message); return; }
    setLoading(true);
    try{ const {error}=await supabase.from("comments").update({content:editContent.trim()}).eq("id",id).eq("user_id",currentUserId); if(error) throw error;
      setEditingCommentId(null); setEditContent(""); toast.success("Komentar berhasil diupdate");
    }catch(e:any){ toast.error(e.message); } finally{ setLoading(false); }
  };

  const handleDeleteComment=async()=> {
    if(!currentUserId||!deleteCommentId) return;
    setLoading(true);
    try{ const {error}=await supabase.from("comments").delete().eq("id",deleteCommentId).eq("user_id",currentUserId); if(error) throw error;
      setDeleteCommentId(null); toast.success("Komentar berhasil dihapus"); loadComments();
    }catch(e:any){ toast.error(e.message); } finally{ setLoading(false); }
  };

  const getInitials=(n:string)=>{ const a=n.split(" "); return a.length>=2?(a[0][0]+a[1][0]).toUpperCase():n.slice(0,2).toUpperCase(); };

  const renderComment=(c:Comment,depth=0)=> {
    const isOwner=currentUserId===c.user_id; const isEditing=editingCommentId===c.id;
    return (
      <div key={c.id} className={`${depth>0?"ml-12 mt-3":"mt-4"}`}>
        <div className="flex gap-3">
          <Avatar className="h-8 w-8 ring-1 ring-border">
            <AvatarImage src={c.profiles.avatar_url} />
            <AvatarFallback className="bg-primary/10 text-primary text-xs">{getInitials(c.profiles.full_name)}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="rounded-xl border border-border bg-card/60 p-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{c.profiles.full_name}</span>
                  <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(c.created_at),{addSuffix:true,locale:id})}</span>
                </div>
                {isOwner&&!isEditing&&(
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={()=>{setEditingCommentId(c.id);setEditContent(c.content);}}><Pencil className="h-3.5 w-3.5"/></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={()=>setDeleteCommentId(c.id)}><Trash2 className="h-3.5 w-3.5"/></Button>
                  </div>
                )}
              </div>
              {isEditing?(
                <div className="mt-2 space-y-2">
                  <MentionInput value={editContent} onChange={setEditContent} placeholder="Edit komentar..." className="min-h-[60px] resize-none text-sm" multiline currentUserId={currentUserId} />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={()=>handleEditComment(c.id)} disabled={loading||!editContent.trim()} className="h-8 px-3 text-xs"><Check className="mr-1 h-3.5 w-3.5"/>Simpan</Button>
                    <Button size="sm" variant="outline" onClick={()=>{setEditingCommentId(null);setEditContent("");}} disabled={loading} className="h-8 px-3 text-xs"><X className="mr-1 h-3.5 w-3.5"/>Batal</Button>
                  </div>
                </div>
              ):(
                <p className="text-sm" dangerouslySetInnerHTML={{__html:c.content.replace(/@\[([^\]]+)\]\([a-f0-9\-]+\)/g,'<span class="text-primary font-semibold">@$1</span>')}}/>
              )}
            </div>

            {!isEditing&&(
              <Button variant="ghost" size="sm" className="mt-1 h-7 w-fit gap-1 rounded-full px-2 text-xs text-muted-foreground hover:text-accent" onClick={()=>setReplyTo(c.id)}>
                <Reply className="h-3.5 w-3.5"/> Balas
              </Button>
            )}

            {c.replies&&c.replies.length>0&&(<div className="mt-2 border-l border-border/70 pl-4">{c.replies.map(r=>renderComment(r,depth+1))}</div>)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="mt-4 border-t border-border pt-4">
      <Button variant="outline" size="sm" className="mb-3 gap-2 rounded-full px-3 text-muted-foreground hover:text-foreground" onClick={()=>setShowComments(!showComments)}>
        <MessageCircle className="h-4 w-4"/>{showComments?"Sembunyikan":"Tampilkan"} Komentar <span className="rounded-full bg-muted px-1.5 text-[11px]">{totalCount ?? 0}</span>
      </Button>

      {showComments&&(
        <>
          <div className="space-y-2">{comments.map(c=>renderComment(c))}</div>
          <div className="mb-4">
            {replyTo&&(
              <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                Membalas komentar
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-accent" onClick={()=>setReplyTo(null)}>Batalkan</Button>
              </div>
            )}
            <div className="flex gap-2">
              <MentionInput value={newComment} onChange={setNewComment} placeholder="Tulis komentar..." className="min-h-[60px] flex-1 resize-none text-sm" multiline currentUserId={currentUserId} />
              <Button onClick={handleSubmitComment} disabled={loading||!newComment.trim()} size="icon" className="h-[60px] w-10 self-end rounded-xl bg-accent text-accent-foreground hover:bg-accent/90"><Send className="h-4 w-4"/></Button>
            </div>
          </div>
        </>
      )}

      <AlertDialog open={!!deleteCommentId} onOpenChange={()=>setDeleteCommentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Hapus Komentar?</AlertDialogTitle><AlertDialogDescription>Apakah Anda yakin ingin menghapus komentar ini? Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={loading}>Batal</AlertDialogCancel><AlertDialogAction onClick={handleDeleteComment} disabled={loading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Hapus</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CommentSection;