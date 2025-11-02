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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Input validation schema
const commentSchema = z.object({
  content: z.string().trim().min(1, "Comment cannot be empty").max(1000, "Comment is too long (max 1000 characters)"),
});

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  parent_id: string | null;
  profiles: {
    id: string;
    full_name: string;
    avatar_url?: string;
    role: string;
  };
  replies?: Comment[];
}

interface CommentSectionProps {
  postId: string;
  currentUserId?: string;
}

const CommentSection = ({ postId, currentUserId }: CommentSectionProps) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [deleteCommentId, setDeleteCommentId] = useState<string | null>(null);

  useEffect(() => {
    if (showComments) {
      loadComments();
      
      // Subscribe to real-time updates
      const channel = supabase
        .channel(`comments-${postId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'comments',
            filter: `post_id=eq.${postId}`,
          },
          () => {
            loadComments();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [postId, showComments]);

  const loadComments = async () => {
    const { data, error } = await supabase
      .from('comments')
      .select(`
        *,
        profiles (
          id,
          full_name,
          avatar_url,
          role
        )
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) {
      toast.error(error.message);
      return;
    }

    // Build threaded structure
    const commentMap = new Map<string, Comment>();
    const rootComments: Comment[] = [];

    data.forEach((comment: any) => {
      commentMap.set(comment.id, { ...comment, replies: [] });
    });

    data.forEach((comment: any) => {
      if (comment.parent_id) {
        const parent = commentMap.get(comment.parent_id);
        if (parent) {
          parent.replies?.push(commentMap.get(comment.id)!);
        }
      } else {
        rootComments.push(commentMap.get(comment.id)!);
      }
    });

    setComments(rootComments);
  };

  const handleSubmitComment = async () => {
    if (!currentUserId) return;

    // Validate input
    try {
      commentSchema.parse({ content: newComment });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      }
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.from('comments').insert({
        post_id: postId,
        user_id: currentUserId,
        parent_id: replyTo,
        content: newComment.trim(),
      });

      if (error) throw error;

      setNewComment("");
      setReplyTo(null);
      toast.success("Komentar berhasil ditambahkan");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditComment = async (commentId: string) => {
    if (!currentUserId) return;

    // Validate input
    try {
      commentSchema.parse({ content: editContent });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      }
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('comments')
        .update({ content: editContent.trim() })
        .eq('id', commentId)
        .eq('user_id', currentUserId);

      if (error) throw error;

      setEditingCommentId(null);
      setEditContent("");
      toast.success("Komentar berhasil diupdate");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteComment = async () => {
    if (!currentUserId || !deleteCommentId) return;

    setLoading(true);

    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', deleteCommentId)
        .eq('user_id', currentUserId);

      if (error) throw error;

      setDeleteCommentId(null);
      toast.success("Komentar berhasil dihapus");
      loadComments(); // Reload immediately for instant UI update
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (comment: Comment) => {
    setEditingCommentId(comment.id);
    setEditContent(comment.content);
  };

  const cancelEdit = () => {
    setEditingCommentId(null);
    setEditContent("");
  };

  const getInitials = (name: string) => {
    const names = name.split(" ");
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const renderComment = (comment: Comment, depth = 0) => {
    const isOwner = currentUserId === comment.user_id;
    const isEditing = editingCommentId === comment.id;

    return (
      <div key={comment.id} className={`${depth > 0 ? 'ml-12 mt-3' : 'mt-4'}`}>
        <div className="flex gap-3">
          <Avatar className="h-8 w-8 border border-accent/20">
            <AvatarImage src={comment.profiles.avatar_url} />
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              {getInitials(comment.profiles.full_name)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1">
            <div className="bg-muted rounded-lg p-3">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-foreground">
                    {comment.profiles.full_name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: id })}
                  </span>
                </div>
                
                {isOwner && !isEditing && (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-accent"
                      onClick={() => startEdit(comment)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteCommentId(comment.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
              
              {isEditing ? (
                <div className="space-y-2 mt-2">
                  <MentionInput
                    value={editContent}
                    onChange={setEditContent}
                    placeholder="Edit komentar..."
                    className="min-h-[60px] resize-none text-sm"
                    multiline
                    currentUserId={currentUserId}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleEditComment(comment.id)}
                      disabled={loading || !editContent.trim()}
                      className="h-7 text-xs"
                    >
                      <Check className="h-3 w-3 mr-1" />
                      Simpan
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={cancelEdit}
                      disabled={loading}
                      className="h-7 text-xs"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Batal
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-foreground" dangerouslySetInnerHTML={{
                  __html: comment.content.replace(
                    /@\[([^\]]+)\]\([a-f0-9\-]+\)/g,
                    '<span class="text-primary font-semibold">@$1</span>'
                  )
                }} />
              )}
            </div>

            {!isEditing && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-1 h-7 text-xs text-muted-foreground hover:text-accent"
                onClick={() => setReplyTo(comment.id)}
              >
                <Reply className="h-3 w-3 mr-1" />
                Balas
              </Button>
            )}

            {comment.replies && comment.replies.length > 0 && (
              <div className="mt-2">
                {comment.replies.map((reply) => renderComment(reply, depth + 1))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="mt-4 border-t border-border pt-4">
      <Button
        variant="ghost"
        size="sm"
        className="gap-2 text-muted-foreground hover:text-accent mb-2"
        onClick={() => setShowComments(!showComments)}
      >
        <MessageCircle className="h-4 w-4" />
        {showComments ? 'Sembunyikan' : 'Tampilkan'} Komentar ({comments.length})
      </Button>

      {showComments && (
        <>
          <div className="mb-4">
            {replyTo && (
              <div className="text-xs text-muted-foreground mb-2">
                Membalas komentar
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 ml-2 text-accent"
                  onClick={() => setReplyTo(null)}
                >
                  Batalkan
                </Button>
              </div>
            )}
            <div className="flex gap-2">
              <MentionInput
                value={newComment}
                onChange={setNewComment}
                placeholder="Tulis komentar... (gunakan @ untuk mention)"
                className="min-h-[60px] resize-none text-sm"
                multiline
                currentUserId={currentUserId}
              />
              <Button
                onClick={handleSubmitComment}
                disabled={loading || !newComment.trim()}
                size="icon"
                className="bg-accent text-accent-foreground hover:bg-accent/90"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {comments.map((comment) => renderComment(comment))}
          </div>
        </>
      )}

      <AlertDialog open={!!deleteCommentId} onOpenChange={() => setDeleteCommentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Komentar?</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus komentar ini? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteComment}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CommentSection;
