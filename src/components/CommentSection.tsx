import React, { useMemo } from "react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { CommentItem } from "./CommentItem";
import { CommentForm } from "./CommentForm";
import { Button } from "@/components/ui/button";
import { useComments } from "@/hooks/useComments";

interface CommentSectionProps {
  postId: string;
  currentUserProfile: { id: string; name: string; avatar_text: string };
  pageSize?: number;
}

export const CommentSection = ({ postId, currentUserProfile, pageSize = 20 }: CommentSectionProps): JSX.Element => {
  const currentUserId = currentUserProfile.id;
  const {
    comments,
    nestedComments,
    addComment,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    isLoading,
  } = useComments(postId, currentUserProfile, pageSize);

  const mentionableNames = useMemo(() => {
    const unique = new Set<string>();
    comments.forEach((comment) => {
      if (comment.profiles?.name) unique.add(comment.profiles.name);
    });
    unique.add(currentUserProfile.name);
    return Array.from(unique);
  }, [comments, currentUserProfile.name]);

  const handleTopLevelSubmit = (data: { text: string; file: File | null }) => {
    addComment.mutate(
      { ...data, parentId: null },
      {
        onSuccess: () => toast.success("Komentar ditambahkan!"),
        onError: (error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          toast.error(`Gagal menambah komentar: ${message}`);
        },
      }
    );
  };

  const handleReplySubmit = (data: { text: string; file: File | null }, parentId: string) => {
    addComment.mutate(
      { ...data, parentId },
      {
        onSuccess: () => toast.success("Balasan dikirim!"),
        onError: (error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          toast.error(`Gagal menambah balasan: ${message}`);
        },
      }
    );
  };

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold border-t pt-4">Komentar ({comments.length})</h3>

      <div className="pt-3">
        <CommentForm
          onSubmit={handleTopLevelSubmit}
          isLoading={addComment.isPending}
          placeholder="Tulis komentar..."
          currentUserName={currentUserProfile.name}
          currentUserInitials={currentUserProfile.avatar_text}
          currentUserId={currentUserId}
        />
      </div>

      {isLoading && (
        <div className="space-y-4 pt-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {!isLoading && nestedComments.length > 0 && (
        <div className="space-y-3 pt-3">
          {nestedComments.map((comment) => (
            <div key={comment.id} className="flex gap-2">
              <CommentItem
                comment={comment}
                currentUserId={currentUserProfile.id}
                currentUserName={currentUserProfile.name}
                currentUserInitials={currentUserProfile.avatar_text}
                postId={postId}
                onReplySubmit={handleReplySubmit}
                isSubmitting={addComment.isPending}
                allUserNames={mentionableNames}
                depth={1}
              />
            </div>
          ))}
        </div>
      )}

      {!isLoading && nestedComments.length === 0 && (
        <p className="text-center text-muted-foreground py-4">Belum ada komentar.</p>
      )}

      <div className="pt-2">
        {hasNextPage && (
          <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? "Memuat..." : "Muat komentar lama"}
          </Button>
        )}
      </div>
    </div>
  );
};

export default CommentSection;