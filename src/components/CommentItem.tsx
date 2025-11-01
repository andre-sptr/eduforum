import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "./UserAvatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MoreHorizontal, Trash2, Heart } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Comment } from "@/lib/commentHelpers";
import { CommentForm } from "./CommentForm";
import { processCommentContent } from "@/lib/textProcessor";
import { getOptimizedImageUrl } from "@/lib/image";

interface CommentItemProps {
  comment: Comment;
  currentUserId: string;
  currentUserName: string;
  currentUserInitials: string;
  postId: string;
  onReplySubmit: (data: { text: string, file: File | null }, parentId: string) => void;
  isSubmitting: boolean;
  depth: number;
  allUserNames: string[];
}

export const CommentItem = ({
  comment,
  currentUserId,
  currentUserName,
  currentUserInitials,
  postId,
  onReplySubmit,
  isSubmitting,
  depth,
  allUserNames
}: CommentItemProps) => {
  const queryClient = useQueryClient();
  const isCommentAuthor = comment.user_id === currentUserId;
  const [isReplying, setIsReplying] = useState(false);

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const { data: commentData } = await supabase.from('comments').select('image_url').eq('id', commentId).single();
      const { error } = await supabase.from('comments').delete().eq('id', commentId);
      if (error) throw new Error(error.message);
      if (commentData?.image_url) {
        try {
          const urlParts = commentData.image_url.split('/');
          const fileName = urlParts.pop();
          const folderPath = urlParts.slice(urlParts.indexOf('comments')).join('/');
          if (folderPath && fileName) {
            await supabase.storage.from('post_media').remove([`${folderPath}/${fileName}`]);
          }
        } catch(storageError){
          console.error("Gagal menghapus gambar dari storage:", storageError);
        }
      }
    },
    onSuccess: () => {
      toast.success("Komentar dihapus.");
      queryClient.invalidateQueries({ queryKey: ['comments', postId] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
    onError: (error) => {
      toast.error(`Gagal menghapus: ${error.message}`);
    }
  });

  const userHasLiked = comment.user_like && comment.user_like.length > 0;

  const likeCommentMutation = useMutation({
    mutationFn: async () => {
      if (!currentUserId) throw new Error("Login dulu");
      if (userHasLiked) {
        await supabase.from("comment_likes").delete().eq("comment_id", comment.id).eq("user_id", currentUserId);
      } else {
        await supabase.from("comment_likes").insert({ comment_id: comment.id, user_id: currentUserId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', postId] });
    },
    onError: (error) => {
      toast.error(`Error: ${(error as Error).message}`);
    }
  });

  const formatTime = (t: string | null | undefined): string => { 
    if (!t) return 'Beberapa saat lalu';
    try {
      const dateObj = new Date(t);
      if (isNaN(dateObj.getTime())) return 'Waktu tidak valid';
      const diff = Date.now() - dateObj.getTime();
      if (diff < 0) return "Baru saja";
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return "Baru saja";
      if (mins < 60) return `${mins} menit lalu`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs} jam lalu`;
      return `${Math.floor(hrs / 24)} hari lalu`;
    } catch (error) {
      console.error("Error formatting time:", error, "Input was:", t);
      return 'Error waktu';
    }
  };

  const handleSubmitReply = (data: { text: string, file: File | null }) => {
    onReplySubmit(data, comment.id);
    setIsReplying(false);
  };

  return (
    <div className="flex gap-2">
      <UserAvatar name={comment.profiles.name} initials={comment.profiles.avatar_text} size="sm" />
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">{comment.profiles.name}</p>
            {isCommentAuthor && <Badge variant="secondary" className="px-1.5 py-0 text-xs font-medium h-fit"> Saya </Badge>}
            <span className="text-xs text-muted-foreground">{formatTime(comment.created_at)}</span>
          </div>
          {isCommentAuthor && (
            <AlertDialog>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0 text-muted-foreground hover:text-foreground">
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem
                      className="flex gap-2 items-center text-red-500 focus:text-red-500 cursor-pointer px-2 py-1.5"
                      onSelect={(e) => e.preventDefault()}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="text-sm">Hapus Komentar</span>
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                </DropdownMenuContent>
              </DropdownMenu>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Anda yakin?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tindakan ini tidak dapat dibatalkan dan akan menghapus komentar Anda.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Batal</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-red-500 hover:bg-red-600"
                    onClick={() => deleteCommentMutation.mutate(comment.id)}
                    disabled={deleteCommentMutation.isPending}
                  >
                    {deleteCommentMutation.isPending ? "Menghapus..." : "Ya, Hapus"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
        {comment.content && (
        <p className="text-sm mt-1 whitespace-pre-wrap break-all">
            {processCommentContent(comment.content, allUserNames)}
        </p>
        )}
        {comment.image_url && (
          <Dialog>
            <DialogTrigger asChild>
              <img 
                src={getOptimizedImageUrl(comment.image_url, 400) || undefined} 
                alt="Gambar komentar" 
                className="mt-2 max-h-32 max-w-[200px] rounded-md border cursor-pointer object-cover" 
                loading="lazy"
                decoding="async"
              />
            </DialogTrigger>
            <DialogContent className="max-w-xl p-0 border-0">
              <img 
                src={getOptimizedImageUrl(comment.image_url, 1200) || undefined} 
                alt="Gambar komentar full size" 
                className="w-full h-auto max-h-[80vh] object-contain" 
                loading="lazy"
                decoding="async"
              />
            </DialogContent>
          </Dialog>
        )}
        <div className="mt-1 flex items-center">
          {depth < 2 && (
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-1 p-1 h-auto text-xs text-muted-foreground"
              onClick={() => setIsReplying(!isReplying)}
            >
              {isReplying ? "Batal" : "Balas"}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className={`group flex items-center gap-1 p-1 h-auto text-xs ${userHasLiked ? "text-red-500" : "text-muted-foreground"}`}
            onClick={() => likeCommentMutation.mutate()}
            disabled={likeCommentMutation.isPending}
          >
            <Heart className={`h-3.5 w-3.5 ${userHasLiked ? "fill-current" : ""} ${!userHasLiked ? "group-hover:text-red-500" : ""}`} />
            <span className={!userHasLiked ? "group-hover:text-red-500" : ""}>
              {comment.likes_count}
            </span>
          </Button>
        </div>
        {isReplying && (
          <div className="mt-3">
            <CommentForm
              onSubmit={handleSubmitReply}
              isLoading={isSubmitting}
              placeholder={`Balas ${comment.profiles.name}...`}
              currentUserName={currentUserName}
              currentUserInitials={currentUserInitials}
              initialMention={`@${comment.profiles.name} `}
              currentUserId={currentUserId}
            />
          </div>
        )}
        {comment.replies.length > 0 && (
          <div className="mt-4 border-l-2 pl-4">
            {comment.replies.map(reply => (
              <CommentItem
                key={reply.id}
                comment={reply}
                currentUserId={currentUserId}
                currentUserName={currentUserName}
                currentUserInitials={currentUserInitials}
                postId={postId}
                onReplySubmit={onReplySubmit}
                isSubmitting={isSubmitting}
                allUserNames={allUserNames}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};