import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useCommentOptimistic(postId: string, currentUserId: string) {
  const qc = useQueryClient();

  const toggleLike = useMutation({
    mutationFn: async (comment: { id: string; user_like?: { id: string; user_id: string }[] | null }) => {
      const liked = Boolean(comment.user_like && comment.user_like.length > 0);
      if (liked) {
        const { error } = await supabase.from("comment_likes").delete().eq("comment_id", comment.id).eq("user_id", currentUserId);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("comment_likes").insert({ comment_id: comment.id, user_id: currentUserId });
        if (error) throw new Error(error.message);
      }
    },
    onMutate: async (comment) => {
      await qc.cancelQueries({ queryKey: ["comments", postId] });
      const prev = qc.getQueryData<any>(["comments", postId]) || qc.getQueryData<any>(["comments", postId, { pageSize: 20 }]);
      qc.setQueriesData({ queryKey: ["comments", postId], exact: false }, (old: any) => {
        if (!old?.pages) return old;
        const pages = old.pages.map((pg: any) => ({
          ...pg,
          rows: pg.rows.map((r: any) => {
            if (r.id !== comment.id) return r;
            const hasLike = Boolean(r.user_like && r.user_like.length > 0);
            const nextCount = Math.max(0, (r.likes_count || 0) + (hasLike ? -1 : 1));
            return { ...r, likes_count: nextCount, user_like: hasLike ? [] : [{ id: "me", user_id: currentUserId }] };
          }),
        }));
        return { ...old, pages };
      });
      return { prev };
    },
    onError: (_e, vars, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(["comments", postId], ctx.prev);
        qc.setQueryData(["comments", postId, { pageSize: 20 }], ctx.prev);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["comments", postId] });
    },
  });

  const deleteComment = useMutation({
    mutationFn: async (commentId: string) => {
      const { data: commentData } = await supabase.from("comments").select("image_url").eq("id", commentId).single();
      const { error } = await supabase.from("comments").delete().eq("id", commentId);
      if (error) throw new Error(error.message);
      if (commentData?.image_url) {
        try {
          const url = new URL(commentData.image_url);
          const idx = url.pathname.split("/").findIndex((p) => p === "comments");
          const path = url.pathname.split("/").slice(idx).join("/");
          await supabase.storage.from("post_media").remove([path]);
        } catch {}
      }
    },
    onMutate: async (commentId) => {
      await qc.cancelQueries({ queryKey: ["comments", postId] });
      await qc.cancelQueries({ queryKey: ["post", postId] });
      await qc.cancelQueries({ queryKey: ["posts"] });
      const prevComments = qc.getQueryData<any>(["comments", postId]) || qc.getQueryData<any>(["comments", postId, { pageSize: 20 }]);
      const prevPost = qc.getQueryData<any>(["post", postId]);
      const prevLists = qc.getQueryData<any>(["posts"]);
      qc.setQueriesData({ queryKey: ["comments", postId], exact: false }, (old: any) => {
        if (!old?.pages) return old;
        const pages = old.pages.map((pg: any) => ({
          ...pg,
          rows: pg.rows.filter((r: any) => r.id !== commentId),
        }));
        return { ...old, pages };
      });
      qc.setQueryData(["post", postId], (old: any) => (old ? { ...old, comments_count: Math.max(0, (old.comments_count || 0) - 1) } : old));
      qc.setQueriesData({ queryKey: ["posts"], exact: false }, (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((pg: any) => ({
            ...pg,
            rows: Array.isArray(pg.rows)
              ? pg.rows.map((it: any) => (it.id === postId ? { ...it, comments_count: Math.max(0, (it.comments_count || 0) - 1) } : it))
              : pg.rows,
          })),
        };
      });
      return { prevComments, prevPost, prevLists };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prevComments) {
        qc.setQueryData(["comments", postId], ctx.prevComments);
        qc.setQueryData(["comments", postId, { pageSize: 20 }], ctx.prevComments);
      }
      if (ctx?.prevPost) qc.setQueryData(["post", postId], ctx.prevPost);
      if (ctx?.prevLists) qc.setQueryData(["posts"], ctx.prevLists);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["comments", postId] });
      qc.invalidateQueries({ queryKey: ["post", postId] });
      qc.invalidateQueries({ queryKey: ["posts"] });
    },
  });

  return { toggleLike, deleteComment };
}