import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type FeedPost = {
  id: string;
  content: string | null;
  image_url: string | null;
  created_at: string;
  user_id: string;
  profiles: { name: string | null; avatar_text: string | null; role: string | null } | null;
  original_post_id: string | null;
  original_author_id: string | null;
  original_author: { name: string | null; avatar_text: string | null; role: string | null } | null;
  likes_count: number;
  comments_count: number;
};

export type UseInfinitePostsOptions = {
  pageSize?: number;
  orderBy?: "created_at";
  orderDesc?: boolean;
  userFilterId?: string | null;
};

type PageResult = {
  rows: FeedPost[];
  nextOffset: number | null;
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
      id,
      content,
      image_url,
      created_at,
      user_id,
      profiles!user_id(name, avatar_text, role),
      post_likes:post_likes(count),
      comments:comments(count),
      original_post_id,
      original_author_id,
      original_author:profiles!original_author_id(name, avatar_text, role)
    `
    );

  if (opts.userFilterId) {
    query = query.eq("user_id", opts.userFilterId);
  }

  const orderDesc = opts.orderDesc ?? true;
  query = query.order(opts.orderBy ?? "created_at", { ascending: !orderDesc });

  const { data, error } = await query.range(offset, offset + pageSize - 1);

  if (error) throw new Error(error.message);

  const rows: FeedPost[] =
    (data ?? []).map((d: any) => ({
      id: d.id,
      content: d.content ?? null,
      image_url: d.image_url ?? null,
      created_at: d.created_at,
      user_id: d.user_id,
      profiles: d.profiles ?? null,
      original_post_id: d.original_post_id ?? null,
      original_author_id: d.original_author_id ?? null,
      original_author: d.original_author ?? null,
      likes_count:
        (Array.isArray(d.post_likes) && (d.post_likes[0]?.count as number)) || 0,
      comments_count:
        (Array.isArray(d.comments) && (d.comments[0]?.count as number)) || 0,
    })) ?? [];

  const nextOffset = rows.length < pageSize ? null : offset + pageSize;

  return { rows, nextOffset };
}

/**
 * Infinite posts hook dengan offset-based pagination.
 * Kenapa offset: sederhana untuk Supabase, cocok untuk feed linear. Jika skala besar, pertimbangkan keyset.
 */
export function useInfinitePosts(options: UseInfinitePostsOptions = {}) {
  const pageSize = options.pageSize ?? 10;

  const query = useInfiniteQuery({
    queryKey: ["posts", { pageSize, orderBy: options.orderBy ?? "created_at", orderDesc: options.orderDesc ?? true, user: options.userFilterId ?? null }],
    initialPageParam: 0,
    getNextPageParam: (lastPage: PageResult) => lastPage.nextOffset,
    queryFn: async ({ pageParam }) => fetchPostsPage(pageParam as number, pageSize, options),
    staleTime: 30_000,
    gcTime: 300_000,
  });

  const posts = (query.data?.pages ?? []).flatMap((p) => p.rows);

  return {
    ...query,
    posts,
    hasNextPage: Boolean(query.hasNextPage),
    loadMore: () => query.fetchNextPage(),
  };
}