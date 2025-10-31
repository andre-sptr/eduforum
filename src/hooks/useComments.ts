import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CommentRow = {
  id: string;
  post_id: string;
  user_id: string;
  content: string | null;
  image_url: string | null;
  created_at: string;
  parent_comment_id: string | null;
  profiles: { name: string | null; avatar_text: string | null } | null;
  user_like?: { id: string; user_id: string }[] | null;
  likes_count?: number | null;
};

type PageResult = { rows: CommentRow[]; nextOffset: number | null };

async function fetchCommentsPage(postId: string, offset: number, pageSize: number): Promise<PageResult> {
  const { data, error } = await supabase
    .from("comments")
    .select(
      `
      id, post_id, user_id, content, image_url, created_at, parent_comment_id,
      profiles(name, avatar_text),
      user_like:comment_likes!left(id, user_id),
      likes_count
    `
    )
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
    .range(offset, offset + pageSize - 1);
  if (error) throw new Error(error.message);

  const rows: CommentRow[] = (data ?? []).map((d: any) => {
    const prof = Array.isArray(d.profiles) ? d.profiles[0] ?? null : d.profiles ?? null;
    const likeArr = Array.isArray(d.user_like) ? d.user_like : d.user_like ? [d.user_like] : [];
    return {
      id: String(d.id),
      post_id: String(d.post_id),
      user_id: String(d.user_id),
      content: d.content ?? null,
      image_url: d.image_url ?? null,
      created_at: String(d.created_at),
      parent_comment_id: d.parent_comment_id ?? null,
      profiles: prof ? { name: prof.name ?? null, avatar_text: prof.avatar_text ?? null } : null,
      user_like: likeArr?.map((x: any) => ({ id: String(x.id), user_id: String(x.user_id) })) ?? [],
      likes_count: typeof d.likes_count === "number" ? d.likes_count : Number(d.likes_count ?? 0),
    };
  });

  const nextOffset = rows.length < pageSize ? null : offset + pageSize;
  return { rows, nextOffset };
}

export function useComments(postId: string, currentUserId: string, pageSize = 20) {
  const queryClient = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: ["comments", postId, { pageSize }],
    enabled: !!postId,
    initialPageParam: 0,
    getNextPageParam: (lastPage: PageResult) => lastPage.nextOffset,
    queryFn: async ({ pageParam }) => fetchCommentsPage(postId, pageParam as number, pageSize),
    staleTime: 30000,
    gcTime: 300000,
  });

  const addComment = useMutation({
    mutationFn: async ({ text, file, parentId }: { text: string; file: File | null; parentId: string | null }) => {
      if (!currentUserId) throw new Error("Login diperlukan");
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
      if (!text && !imageUrl) throw new Error("Komentar kosong");
      const insert = {
        post_id: postId,
        user_id: currentUserId,
        content: text || null,
        image_url: imageUrl,
        parent_comment_id: parentId,
      };
      const { data, error } = await supabase.from("comments").insert(insert).select("id, created_at").single();
      if (error) {
        if (filePath) await supabase.storage.from("post_media").remove([filePath]);
        throw new Error(error.message);
      }
      return data;
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: ["comments", postId] });
      await queryClient.cancelQueries({ queryKey: ["post", postId] });
      await queryClient.cancelQueries({ queryKey: ["posts"] });
      const prevComments = queryClient.getQueryData<any>(["comments", postId, { pageSize }]);
      const prevPost = queryClient.getQueryData<any>(["post", postId]);
      const prevLists = queryClient.getQueryData<any>(["posts"]);
      queryClient.setQueryData(["post", postId], (old: any) =>
        old ? { ...old, comments_count: Math.max(0, (old.comments_count || 0) + 1) } : old
      );
      queryClient.setQueriesData({ queryKey: ["posts"], exact: false }, (old: any) => {
        if (!old || !Array.isArray(old.pages)) return old;
        return {
          ...old,
          pages: old.pages.map((pg: any) => ({
            ...pg,
            rows: Array.isArray(pg.rows)
              ? pg.rows.map((it: any) =>
                  it.id === postId ? { ...it, comments_count: Math.max(0, (it.comments_count || 0) + 1) } : it
                )
              : pg.rows,
          })),
        };
      });
      queryClient.setQueryData(["comments", postId, { pageSize }], (old: any) => {
        if (!old || !Array.isArray(old.pages)) return old;
        const optimistic: CommentRow = {
          id: "optimistic-" + Date.now(),
          post_id: postId,
          user_id: currentUserId,
          content: vars.text || null,
          image_url: null,
          created_at: new Date().toISOString(),
          parent_comment_id: vars.parentId,
          profiles: null,
          user_like: [],
          likes_count: 0,
        };
        const first = old.pages[0];
        const newFirst = { ...first, rows: [...first.rows, optimistic] };
        const pages = [newFirst, ...old.pages.slice(1)];
        return { ...old, pages };
      });
      return { prevComments, prevPost, prevLists };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prevComments) queryClient.setQueryData(["comments", postId, { pageSize }], ctx.prevComments);
      if (ctx?.prevPost) queryClient.setQueryData(["post", postId], ctx.prevPost);
      if (ctx?.prevLists) queryClient.setQueryData(["posts"], ctx.prevLists);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", postId] });
      queryClient.invalidateQueries({ queryKey: ["post", postId] });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
  });

  const comments = (query.data?.pages ?? []).flatMap((p) => p.rows);

  return {
    ...query,
    comments,
    addComment,
  };
}

export { fetchCommentsPage };