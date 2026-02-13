import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
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
import { RankBadge } from "@/components/RankBadge";
import { ContentRenderer } from "@/components/ContentRenderer";

const commentSchema = z.object({ content: z.string().trim().min(1, "Comment cannot be empty").max(1000, "Comment is too long (max 1000 characters)") });

interface Comment { id: string; content: string; created_at: string; user_id: string; parent_id: string | null; profiles: { id: string; full_name: string; avatar_url?: string; role: string }; replies?: Comment[] }
interface Props { postId: string; currentUserId?: string; postType: "global" | "group"; allowedUserIds?: string[] }

const CommentSection = ({ postId, currentUserId, postType = "global", allowedUserIds }: Props) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState(""); const [replyTo, setReplyTo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false); const [showComments, setShowComments] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null); const [editContent, setEditContent] = useState("");
  const [deleteCommentId, setDeleteCommentId] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [topFollowers, setTopFollowers] = useState<any[]>([]);
  const [topLiked, setTopLiked] = useState<any[]>([]);
  const commentTable = postType === "group" ? "group_post_comments" : "comments";

  const followerRankMap = useMemo(() =>
    new Map(topFollowers.slice(0, 3).map((u, i) => [u.id, i + 1]))
  , [topFollowers]);

  const likerRankMap = useMemo(() =>
    new Map(topLiked.slice(0, 3).map((u, i) => [u.id, i + 1]))
  , [topLiked]);

  useEffect(() => {
    const loadLeaderboards = async () => {
      if (topFollowers.length === 0 && topLiked.length === 0) {
        const [tfRes, tlRes] = await Promise.all([
          supabase.rpc("get_top_5_followers"),
          supabase.rpc("get_top_5_liked_users")
        ]);
        if (tfRes.data) setTopFollowers(tfRes.data);
        if (tlRes.data) setTopLiked(tlRes.data);
      }
    };
    
    loadLeaderboards();
    loadCount();
    const ch = supabase.channel(`comments-count-${postType}-${postId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: commentTable, filter: `post_id=eq.${postId}` }, () => loadCount())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [postId, postType]);

  useEffect(() => {
    if (!showComments) return;
    loadComments();
    const ch = supabase.channel(`comments-${postType}-${postId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: commentTable, filter: `post_id=eq.${postId}` }, () => loadComments())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [postId, showComments, postType]);

  const loadCount = async () => {
    const { count, error } = await supabase.from(commentTable).select("*", { head: true, count: "exact" }).eq("post_id", postId);
    if (error) { setTotalCount(0); return; } setTotalCount(count ?? 0);
  };

  const loadComments = async () => {
    const { data, error } = await supabase.from(commentTable).select(`*,profiles(id,full_name,avatar_url,role)`).eq("post_id", postId).order("created_at", { ascending: true });
    if (error) { toast.error(error.message); return; }
    const map = new Map<string, Comment>(); const roots: Comment[] = [];
    data.forEach((c: any) => map.set(c.id, { ...c, replies: [] })); data.forEach((c: any) => { if (c.parent_id) { const p = map.get(c.parent_id); if (p) p.replies?.push(map.get(c.id)!); } else roots.push(map.get(c.id)!); });
    setComments(roots);
  };

  const handleSubmitComment = async () => {
    if (!currentUserId) return;
    try { commentSchema.parse({ content: newComment }); } catch (e: any) { if (e instanceof z.ZodError) toast.error(e.errors[0].message); return; }
    setLoading(true);
    try {
      const { error } = await supabase.from(commentTable).insert({ post_id: postId, user_id: currentUserId, parent_id: replyTo, content: newComment.trim() }); if (error) throw error;
      setNewComment(""); setReplyTo(null); toast.success("Komentar berhasil ditambahkan");
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  const handleEditComment = async (id: string) => {
    if (!currentUserId) return;
    try { commentSchema.parse({ content: editContent }); } catch (e: any) { if (e instanceof z.ZodError) toast.error(e.errors[0].message); return; }
    setLoading(true);
    try {
      const { error } = await supabase.from(commentTable).update({ content: editContent.trim() }).eq("id", id).eq("user_id", currentUserId); if (error) throw error;
      setEditingCommentId(null); setEditContent(""); toast.success("Komentar berhasil diupdate");
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  const handleDeleteComment = async () => {
    if (!currentUserId || !deleteCommentId) return;
    setLoading(true);
    try {
      const { error } = await supabase.from(commentTable).delete().eq("id", deleteCommentId).eq("user_id", currentUserId); if (error) throw error;
      setDeleteCommentId(null); toast.success("Komentar berhasil dihapus"); loadComments();
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  const getInitials = (n: string) => { const a = n.split(" "); return a.length >= 2 ? (a[0][0] + a[1][0]).toUpperCase() : n.slice(0, 2).toUpperCase(); };

  const renderComment = (c: Comment, depth = 0) => {
    const isOwner = currentUserId === c.user_id; const isEditing = editingCommentId === c.id;
    return (
      <div key={c.id} className={`${depth > 0 ? "ml-12 mt-3" : "mt-4"}`}>
        <div className="flex gap-3">
          <Link to={`/profile/${c.user_id}`}>
            <Avatar className="h-8 w-8 ring-1 ring-border">
              <AvatarImage src={c.profiles.avatar_url} />
              <AvatarFallback className="bg-primary text-primary-foreground">{getInitials(c.profiles.full_name)}</AvatarFallback>
            </Avatar>
          </Link>
          <div className="flex-1">
            <div className="rounded-xl border border-border bg-card/60 p-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold">{c.profiles.full_name}</span>
                  <RankBadge rank={followerRankMap.get(c.user_id)} type="follower" />
                  <RankBadge rank={likerRankMap.get(c.user_id)} type="like" />
                  <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: id })}</span>
                </div>
                {isOwner && !isEditing && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingCommentId(c.id); setEditContent(c.content); }}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteCommentId(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                )}
              </div>
              {isEditing ? (
                <div className="mt-2 space-y-2">
                  <MentionInput value={editContent} onChange={setEditContent} placeholder="Edit komentar..." className="min-h-[60px] resize-none text-sm" multiline currentUserId={currentUserId} allowedUserIds={postType === "group" ? allowedUserIds : undefined}/>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleEditComment(c.id)} disabled={loading || !editContent.trim()} className="h-8 px-3 text-xs"><Check className="mr-1 h-3.5 w-3.5" />Simpan</Button>
                    <Button size="sm" variant="outline" onClick={() => { setEditingCommentId(null); setEditContent(""); }} disabled={loading} className="h-8 px-3 text-xs"><X className="mr-1 h-3.5 w-3.5" />Batal</Button>
                  </div>
                </div>
              ) : (
                <ContentRenderer content={c.content} className="text-sm" />
              )}
            </div>

            {!isEditing && (
              <Button variant="ghost" size="sm" className="mt-1 h-7 w-fit gap-1 rounded-full px-2 text-xs text-muted-foreground hover:text-accent" onClick={() => setReplyTo(c.id)}>
                <Reply className="h-3.5 w-3.5" /> Balas
              </Button>
            )}

            {c.replies && c.replies.length > 0 && (<div className="mt-2 border-l border-border/70 pl-4">{c.replies.map(r => renderComment(r, depth + 1))}</div>)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="mt-6 border-t border-white/10 pt-6">
      <Button 
        variant="ghost" 
        size="sm" 
        className="mb-4 gap-2 rounded-xl px-4 text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all w-full justify-between group" 
        onClick={() => setShowComments(!showComments)}
      >
        <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 group-hover:text-primary transition-colors" />
            <span className="font-medium">{showComments ? "Sembunyikan" : "Tampilkan"} Komentar</span>
        </div>
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs font-bold text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-all">
            {totalCount ?? 0}
        </span>
      </Button>

      {showComments && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-500 space-y-6">
          <div className="space-y-4 relative">
             <div className="absolute left-4 top-0 bottom-0 w-px bg-white/5 -z-10" />
             {comments.map(c => renderComment(c))}
          </div>
          
          <div className="sticky bottom-0 bg-card/80 backdrop-blur-xl p-4 -mx-4 border-t border-white/5 rounded-t-2xl shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.3)]">
            {replyTo && (
              <div className="mb-3 flex items-center justify-between gap-2 text-xs text-muted-foreground bg-primary/5 p-2 rounded-lg border border-primary/10">
                <div className="flex items-center gap-2">
                    <Reply className="h-3.5 w-3.5 text-primary" />
                    <span>Membalas komentar...</span>
                </div>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setReplyTo(null)}>Batalkan</Button>
              </div>
            )}
            <div className="flex gap-3 items-end">
              <div className="relative flex-1 group">
                 <div className="absolute inset-0 bg-primary/20 blur-lg rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
                 <MentionInput 
                    value={newComment} 
                    onChange={setNewComment} 
                    placeholder="Tulis komentar..." 
                    className="min-h-[48px] max-h-[120px] w-full resize-none rounded-2xl bg-black/20 border-white/10 focus:bg-black/40 focus:border-primary/30 text-sm p-3 shadow-inner relative z-10 transition-all placeholder:text-muted-foreground/50" 
                    multiline 
                    currentUserId={currentUserId} 
                    allowedUserIds={postType === "group" ? allowedUserIds : undefined}
                 />
              </div>
              <Button 
                onClick={handleSubmitComment} 
                disabled={loading || !newComment.trim()} 
                size="icon" 
                className="h-12 w-12 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 hover:scale-105 hover:rotate-6 transition-all flex-shrink-0"
              >
                <Send className="h-5 w-5 ml-0.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <AlertDialog open={!!deleteCommentId} onOpenChange={() => setDeleteCommentId(null)}>
        <AlertDialogContent className="bg-card/95 backdrop-blur-xl border-white/10 rounded-3xl shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-center">Hapus Komentar?</AlertDialogTitle>
            <AlertDialogDescription className="text-center text-muted-foreground">
                Apakah Anda yakin ingin menghapus komentar ini? <br/>Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center gap-3">
            <AlertDialogCancel disabled={loading} className="rounded-xl border-white/10 bg-white/5 hover:bg-white/10 h-11 px-6">Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteComment} disabled={loading} className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-lg shadow-destructive/20 h-11 px-6">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CommentSection;