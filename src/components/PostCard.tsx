import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, MessageCircle, Repeat2, Share2, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { id } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import MediaCarousel from "./MediaCarousel";
import CommentSection from "./CommentSection";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

interface PostCardProps {
  post: {
    id: string;
    content: string;
    created_at: string;
    media_urls?: string[];
    media_types?: string[];
    profiles: {
      id: string;
      full_name: string;
      avatar_url?: string;
      role: string;
    };
    likes: any[];
  };
  currentUserId?: string;
  onLike?: () => void;
  onPostUpdated?: () => void;
  onPostDeleted?: () => void;
}

const PostCard = ({ post, currentUserId, onLike, onPostUpdated, onPostDeleted }: PostCardProps) => {
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [isReposted, setIsReposted] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isOwnPost = currentUserId === post.profiles.id;

  useEffect(() => {
    if (currentUserId) {
      const userLiked = post.likes.some(like => like.user_id === currentUserId);
      setIsLiked(userLiked);
      checkRepost();
    }
    setLikeCount(post.likes.length);
  }, [post.likes, currentUserId]);

  const checkRepost = async () => {
    if (!currentUserId) return;

    const { data } = await supabase
      .from('reposts')
      .select('*')
      .eq('user_id', currentUserId)
      .eq('post_id', post.id)
      .single();

    setIsReposted(!!data);
  };

  const getInitials = (name: string) => {
    const names = name.split(" ");
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "siswa":
        return "bg-blue-500/20 text-blue-400";
      case "guru":
        return "bg-green-500/20 text-green-400";
      case "alumni":
        return "bg-purple-500/20 text-purple-400";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const handleLike = async () => {
    if (!currentUserId) {
      toast.error("Silakan login terlebih dahulu");
      return;
    }

    try {
      if (isLiked) {
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('user_id', currentUserId)
          .eq('post_id', post.id);

        if (error) throw error;

        setIsLiked(false);
        setLikeCount(prev => prev - 1);
      } else {
        const { error } = await supabase
          .from('likes')
          .insert({
            user_id: currentUserId,
            post_id: post.id,
          });

        if (error) throw error;

        setIsLiked(true);
        setLikeCount(prev => prev + 1);
      }

      onLike?.();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleRepost = async () => {
    if (!currentUserId) {
      toast.error("Silakan login terlebih dahulu");
      return;
    }

    try {
      if (isReposted) {
        const { error } = await supabase
          .from('reposts')
          .delete()
          .eq('user_id', currentUserId)
          .eq('post_id', post.id);

        if (error) throw error;

        setIsReposted(false);
        toast.success("Repost dibatalkan");
      } else {
        const { error } = await supabase
          .from('reposts')
          .insert({
            user_id: currentUserId,
            post_id: post.id,
          });

        if (error) throw error;

        setIsReposted(true);
        toast.success("Berhasil di-repost!");
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleShare = () => {
    const url = `${window.location.origin}/post/${post.id}`;
    navigator.clipboard.writeText(url);
    toast.success("Link postingan disalin!");
  };

  const handleEditPost = async () => {
    if (!editContent.trim()) {
      toast.error("Konten postingan tidak boleh kosong");
      return;
    }

    try {
      const { error } = await supabase
        .from("posts")
        .update({ content: editContent.trim() })
        .eq("id", post.id);

      if (error) throw error;

      setIsEditing(false);
      toast.success("Postingan berhasil diubah");
      onPostUpdated?.();
    } catch (error: any) {
      toast.error("Gagal mengubah postingan: " + error.message);
    }
  };

  const handleDeletePost = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("posts")
        .delete()
        .eq("id", post.id);

      if (error) throw error;

      toast.success("Postingan berhasil dihapus");
      onPostDeleted?.();
    } catch (error: any) {
      toast.error("Gagal menghapus postingan: " + error.message);
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const startEdit = () => {
    setIsEditing(true);
    setEditContent(post.content);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditContent(post.content);
  };

  return (
    <Card className="bg-card border-border p-6 hover:border-accent/50 transition-[var(--transition-smooth)]">
      <div className="flex gap-4">
        <Avatar className="h-12 w-12 border-2 border-accent/20">
          <AvatarImage src={post.profiles.avatar_url} />
          <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
            {getInitials(post.profiles.full_name)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold text-foreground">{post.profiles.full_name}</h3>
            <span className={`text-xs px-2 py-1 rounded-full ${getRoleBadgeColor(post.profiles.role)}`}>
              {post.profiles.role.charAt(0).toUpperCase() + post.profiles.role.slice(1)}
            </span>
            <span className="text-sm text-muted-foreground">
              · {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: id })}
            </span>
            
            {isOwnPost && !isEditing && (
              <div className="ml-auto">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={startEdit}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setShowDeleteDialog(true)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Hapus
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-3 mb-4">
              <MentionInput
                value={editContent}
                onChange={setEditContent}
                placeholder="Edit postingan..."
                className="min-h-[100px] resize-none"
                multiline
                currentUserId={currentUserId}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleEditPost}>
                  Simpan
                </Button>
                <Button size="sm" variant="ghost" onClick={cancelEdit}>
                  Batal
                </Button>
              </div>
            </div>
          ) : (
            <p 
              className="text-foreground mb-2 whitespace-pre-wrap"
              dangerouslySetInnerHTML={{
                __html: post.content.replace(
                  /@\[([^\]]+)\]\([a-f0-9\-]+\)/g,
                  '<span class="text-primary font-semibold">@$1</span>'
                )
              }}
            />
          )}

          {!isEditing && post.media_urls && post.media_types && (
            <MediaCarousel mediaUrls={post.media_urls} mediaTypes={post.media_types} />
          )}

          <div className="flex items-center gap-6 mt-4">
            <Button
              variant="ghost"
              size="sm"
              className={`gap-2 ${isLiked ? "text-red-500" : "text-muted-foreground"} hover:text-red-500`}
              onClick={handleLike}
            >
              <Heart className={`h-5 w-5 ${isLiked ? "fill-current" : ""}`} />
              <span>{likeCount}</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-muted-foreground hover:text-accent"
            >
              <MessageCircle className="h-5 w-5" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className={`gap-2 ${isReposted ? "text-green-500" : "text-muted-foreground"} hover:text-green-500`}
              onClick={handleRepost}
            >
              <Repeat2 className="h-5 w-5" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-muted-foreground hover:text-accent"
              onClick={handleShare}
            >
              <Share2 className="h-5 w-5" />
            </Button>
          </div>

          <CommentSection postId={post.id} currentUserId={currentUserId} />
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Postingan</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus postingan ini? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePost}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default PostCard;
