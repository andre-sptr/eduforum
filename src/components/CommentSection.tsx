import React, { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { nestComments, RawComment } from "@/lib/commentHelpers";
import { CommentItem } from "./CommentItem";
import { CommentForm } from "./CommentForm";
import { resolveMentionsToIds } from "@/lib/mentionHelpers";
import { Button } from "@/components/ui/button";

interface CommentSectionProps {
  postId: string;
  currentUserProfile: { id: string; name: string; avatar_text: string };
  pageSize?: number;
}

type PageResult = {
  rows: RawComment[];
  nextOffset: number | null;
};

async function fetchCommentsPage(postId: string, offset: number, pageSize: number): Promise<PageResult> {
  const { data, error } = await supabase
    .from("comments")
    .select(
      `
      id, user_id, content, image_url, created_at, likes_count,
      parent_comment_id,
      profiles(name, avatar_text),
      user_like:comment_likes!left(id, user_id)
    `
    )
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
    .range(offset, offset + pageSize - 1);
  if (error) throw error;
  const rows = (data ?? []) as RawComment[];
  const nextOffset = rows.length < pageSize ? null : offset + pageSize;
  return { rows, nextOffset };
}

export const CommentSection = ({ postId, currentUserProfile, pageSize = 20 }: CommentSectionProps): JSX.Element => {
  const queryClient = useQueryClient();
  const currentUserId = currentUserProfile.id;

  const commentsQuery = useInfiniteQuery({
    queryKey: ["comments", postId, { pageSize }],
    enabled: !!postId,
    initialPageParam: 0,
    getNextPageParam: (lastPage: PageResult) => lastPage.nextOffset,
    queryFn: async ({ pageParam }) => fetchCommentsPage(postId, pageParam as number, pageSize),
    staleTime: 30000,
    gcTime: 300000,
  });

  const flatComments: RawComment[] = useMemo(
    () => (commentsQuery.data?.pages ?? []).flatMap((p) => p.rows),
    [commentsQuery.data]
  );

  const nestedComments = useMemo(() => nestComments(flatComments), [flatComments]);

  const addCommentMutation = useMutation({
    mutationFn: async ({
      text,
      file,
      parentId,
    }: {
      text: string;
      file: File | null;
      parentId: string | null;
    }) => {
      if (!currentUserId) throw new Error("Login dulu");
      const taggedIds = await resolveMentionsToIds(text);
      let imageUrl: string | null = null;
      let filePath: string | null = null;

      if (file) {
        const ext = (file.name.split(".").pop() || "bin").replace(/[^\w]+/g, "");
        filePath = `comments/${postId}/${currentUserId}_${Date.now()}.${ext}`;
        const { data: uploadData, error: uploadError } = await supabase.storage.from("post_media").upload(filePath, file);
        if (uploadError) throw new Error(uploadError.message);
        const { data: urlData } = supabase.storage.from("post_media").getPublicUrl(uploadData.path);
        imageUrl = urlData.publicUrl;
      }

      if (!text && !imageUrl) throw new Error("Komentar tidak boleh kosong");

      const { error: insertError } = await supabase
        .from("comments")
        .insert({
          post_id: postId,
          user_id: currentUserId,
          content: text || null,
          image_url: imageUrl,
          parent_comment_id: parentId,
          tagged_user_ids: taggedIds.length > 0 ? taggedIds : null,
        })
        .select("id")
        .single();

      if (insertError) {
        if (filePath) await supabase.storage.from("post_media").remove([filePath]);
        throw insertError;
      }

      if (taggedIds.length > 0) {
        const rows = taggedIds
          .filter((id) => id !== currentUserId)
          .map((uid) => ({
            user_id: uid,
            actor_id: currentUserId,
            type: "mention_comment",
            post_id: postId,
          }));
        const uniqueRows = rows.filter(
          (r, i, arr) => i === arr.findIndex((x) => x.user_id === r.user_id && x.post_id === r.post_id && x.type === r.type)
        );
        if (uniqueRows.length > 0) {
          const { error } = await supabase.from("notifications").insert(uniqueRows);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", postId] });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["post", postId] });
      queryClient.invalidateQueries({ queryKey: ["activity_notifications", currentUserId] });
      toast.success("Komentar ditambahkan!");
    },
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : String(error);
      toast.error(`Gagal menambah komentar: ${msg}`);
    },
  });

  const { data: allUserNames = [] } = useQuery<string[]>({
    queryKey: ["allUserNames"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("name");
      return data?.map((p) => p.name).filter(Boolean).sort((a, b) => b.length - a.length) || [];
    },
    staleTime: Infinity,
  });

  const handleTopLevelSubmit = (data: { text: string; file: File | null }) => {
    addCommentMutation.mutate({ ...data, parentId: null });
  };

  const handleReplySubmit = (data: { text: string; file: File | null }, parentId: string) => {
    addCommentMutation.mutate({ ...data, parentId });
  };

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold border-t pt-4">Komentar ({flatComments.length})</h3>

      <div className="pt-3">
        <CommentForm
          onSubmit={handleTopLevelSubmit}
          isLoading={addCommentMutation.isPending}
          placeholder="Tulis komentar..."
          currentUserName={currentUserProfile.name}
          currentUserInitials={currentUserProfile.avatar_text}
          currentUserId={currentUserId}
        />
      </div>

      {commentsQuery.isLoading && (
        <div className="space-y-4 pt-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {!commentsQuery.isLoading && nestedComments.length > 0 && (
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
                isSubmitting={addCommentMutation.isPending}
                allUserNames={allUserNames}
                depth={1}
              />
            </div>
          ))}
        </div>
      )}

      {!commentsQuery.isLoading && nestedComments.length === 0 && (
        <p className="text-center text-muted-foreground py-4">Belum ada komentar.</p>
      )}

      <div className="pt-2">
        {commentsQuery.hasNextPage && (
          <Button variant="outline" onClick={() => commentsQuery.fetchNextPage()} disabled={commentsQuery.isFetchingNextPage}>
            {commentsQuery.isFetchingNextPage ? "Memuat..." : "Muat komentar lama"}
          </Button>
        )}
      </div>
    </div>
  );
};

export default CommentSection;