import React, { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "./UserAvatar";
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
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Comment } from "@/lib/commentHelpers";
import { CommentForm } from "./CommentForm";
import { linkifyMentionsToNodes } from "@/lib/textProcessor";
import { LazyMedia } from "./LazyMedia";
import { formatTime } from "@/lib/time";
import { useCommentOptimistic } from "@/hooks/useCommentOptimistic";

interface CommentItemProps {
  comment: Comment;
  currentUserId: string;
  currentUserName: string;
  currentUserInitials: string;
  postId: string;
  onReplySubmit: (data: { text: string; file: File | null }, parentId: string) => void;
  isSubmitting: boolean;
  depth: number;
  allUserNames: string[];
}

const CommentItemBase = ({
  comment,
  currentUserId,
  currentUserName,
  currentUserInitials,
  postId,
  onReplySubmit,
  isSubmitting,
  depth,
  allUserNames,
}: CommentItemProps) => {
  const isCommentAuthor = comment.user_id === currentUserId;
  const [isReplying, setIsReplying] = useState(false);
  const { toggleLike, deleteComment } = useCommentOptimistic(postId, currentUserId);
  const userHasLiked = useMemo(() => Boolean(comment.user_like && comment.user_like.length > 0), [comment.user_like]);

  const handleSubmitReply = useCallback(
    (data: { text: string; file: File | null }) => {
      onReplySubmit(data, comment.id);
      setIsReplying(false);
    },
    [onReplySubmit, comment.id]
  );

  return (
    <div className="flex gap-2">
      <UserAvatar name={comment.profiles.name} initials={comment.profiles.avatar_text} size="sm" />
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">{comment.profiles.name}</p>
            {isCommentAuthor && <Badge variant="secondary" className="px-1.5 py-0 text-xs font-medium h-fit">Saya</Badge>}
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
                    <DropdownMenuItem className="flex gap-2 items-center text-red-500 focus:text-red-500 cursor-pointer px-2 py-1.5" onSelect={(e) => e.preventDefault()}>
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="text-sm">Hapus Komentar</span>
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                </DropdownMenuContent>
              </DropdownMenu>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Anda yakin?</AlertDialogTitle>
                  <AlertDialogDescription>Tindakan ini tidak dapat dibatalkan dan akan menghapus komentar Anda.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Batal</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-red-500 hover:bg-red-600"
                    onClick={async () => {
                      try {
                        await deleteComment.mutateAsync(comment.id);
                        toast.success("Komentar dihapus.");
                      } catch (e: any) {
                        toast.error(e?.message || "Gagal menghapus");
                      }
                    }}
                    disabled={deleteComment.isPending}
                  >
                    {deleteComment.isPending ? "Menghapus..." : "Ya, Hapus"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        {comment.content && <p className="text-sm mt-1 whitespace-pre-wrap break-all">{linkifyMentionsToNodes(comment.content, allUserNames)}</p>}

        {comment.image_url && (
          <Dialog>
            <DialogTrigger asChild>
              <div className="mt-2 w-[200px]">
                <LazyMedia url={comment.image_url} aspect="4/3" objectFit="cover" />
              </div>
            </DialogTrigger>
            <DialogContent className="max-w-xl p-0 border-0">
              <img src={comment.image_url} alt="" className="w-full h-auto max-h-[80vh] object-contain" loading="lazy" decoding="async" />
            </DialogContent>
          </Dialog>
        )}

        <div className="mt-1 flex items-center">
          {depth < 2 && (
            <Button variant="ghost" size="sm" className="flex items-center gap-1 p-1 h-auto text-xs text-muted-foreground" onClick={() => setIsReplying((v) => !v)}>
              {isReplying ? "Batal" : "Balas"}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className={`group flex items-center gap-1 p-1 h-auto text-xs ${userHasLiked ? "text-red-500" : "text-muted-foreground"}`}
            onClick={() => toggleLike.mutate({ id: comment.id, user_like: comment.user_like as any })}
            disabled={toggleLike.isPending}
          >
            <Heart className={`h-3.5 w-3.5 ${userHasLiked ? "fill-current" : ""} ${!userHasLiked ? "group-hover:text-red-500" : ""}`} />
            <span className={!userHasLiked ? "group-hover:text-red-500" : ""}>{comment.likes_count}</span>
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
            {comment.replies.map((reply) => (
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

export const CommentItem = React.memo(CommentItemBase);