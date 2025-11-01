import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/database.types";
import { useMemo } from "react";

type ProfileLite = {
  name: string | null;
  username?: string | null;
  avatar_text: string | null;
  role: string | null;
};

export type FeedPost = {
  id: string;
  content: string | null;
  image_url: string | null;
  created_at: string;
  user_id: string;
  profiles: ProfileLite | null;
  original_post_id: string | null;
  original_author_id: string | null;
  original_author: ProfileLite | null;
  likes_count: number;
  comments_count: number;
  viewer_has_liked: boolean;
};

export type UseInfinitePostsOptions = {
  pageSize?: number;
  orderBy?: "created_at";
  orderDesc?: boolean;
  userFilterId?: string | null;
  currentUserId?: string | null;
  enabled?: boolean;
};

type PageResult = { rows: FeedPost[]; nextOffset: number | null };
type PostLikeRow = { user_id: string };
type PostRow = Database["public"]["Tables"]["posts"]["Row"] & {
  profiles: ProfileLite | null;
  original_author: ProfileLite | null;
  user_like: PostLikeRow[];
};

async function fetchPostsPage(
  offset: number,
  pageSize: number,
  opts: UseInfinitePostsOptions
): Promise<PageResult> {
  let query = supabase
    .from("posts")
    .select(
      `
      id, content, image_url, created_at, user_id,
      likes_count, comments_count,
      tagged_user_ids, updated_at, 
      profiles!user_id(name, username, avatar_text, role),
      original_post_id, original_author_id,
      original_author:profiles!original_author_id(name, username, avatar_text, role),
      user_like:post_likes!left(post_id, user_id)
    `
    );

  if (opts.userFilterId) {
    query = query.eq("user_id", opts.userFilterId);
  }
  if (opts.currentUserId) {
    query = query.eq("user_like.user_id", opts.currentUserId);
  }
  const orderDesc = opts.orderDesc ?? true;
  query = query.order(opts.orderBy ?? "created_at", { ascending: !orderDesc });

  const { data, error } = await query.range(offset, offset + pageSize - 1);
  if (error) throw new Error(error.message);

  const rows: FeedPost[] =
    ((data as PostRow[] | null) ?? []).map((row) => ({
      id: row.id,
      content: row.content ?? null,
      image_url: row.image_url ?? null,
      created_at: row.created_at,
      user_id: row.user_id,
      profiles: row.profiles ?? null,
      original_post_id: row.original_post_id ?? null,
      original_author_id: row.original_author_id ?? null,
      original_author: row.original_author ?? null,
      likes_count: typeof row.likes_count === "number" ? row.likes_count : 0,
      comments_count: typeof row.comments_count === "number" ? row.comments_count : 0,
      viewer_has_liked: (row.user_like?.length || 0) > 0,
    })) ?? [];

  const nextOffset = rows.length < pageSize ? null : offset + pageSize;
  return { rows, nextOffset };
}

export function useInfinitePosts(options: UseInfinitePostsOptions = {}) {
  const pageSize = options.pageSize ?? 10;
  const enabled = options.enabled ?? true;
  const query = useInfiniteQuery({
    queryKey: [
      "posts",
      {
        pageSize,
        orderBy: options.orderBy ?? "created_at",
        orderDesc: options.orderDesc ?? true,
        user: options.userFilterId ?? null,
        viewer: options.currentUserId ?? null,
      },
    ],
    initialPageParam: 0,
    getNextPageParam: (lastPage: PageResult) => lastPage.nextOffset,
    queryFn: async ({ pageParam }) => fetchPostsPage(pageParam as number, pageSize, options),
    staleTime: 30_000,
    gcTime: 300_000,
    enabled,
  });

  const posts = useMemo(
    () => (query.data?.pages ?? []).flatMap((p) => p.rows),
    [query.data]
  );

  return {
    ...query,
    posts,
    hasNextPage: Boolean(query.hasNextPage),
    loadMore: () => query.fetchNextPage(),
  };
}