import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PostCard } from "@/components/PostCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";

type ProfileLite = {
  name: string | null;
  username?: string | null;
  avatar_text: string | null;
  role: string | null;
};

type UserProfile = {
  id: string;
  name: string;
  avatar_text: string;
};

export type PostWithCounts = {
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
};

export default function PostPage(): JSX.Element {
  const { postId } = useParams<{ postId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const {
    data: post,
    isLoading: isLoadingPost,
    error: postError,
  } = useQuery<PostWithCounts | null>({
    queryKey: ["post", postId],
    enabled: Boolean(postId),
    staleTime: 60000,
    gcTime: 300000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select(
          `
          id,
          content,
          image_url,
          created_at,
          user_id,
          profiles!user_id(name, username, avatar_text, role),
          post_likes:post_likes(count),
          comments:comments(count),
          original_post_id,
          original_author_id,
          original_author:profiles!original_author_id(name, username, avatar_text, role)
        `
        )
        .eq("id", postId as string)
        .single();

      if (error) throw new Error(error.message);

      const likes_count =
        (Array.isArray((data as any)?.post_likes) &&
          ((data as any).post_likes[0]?.count as number)) ||
        0;
      const comments_count =
        (Array.isArray((data as any)?.comments) &&
          ((data as any).comments[0]?.count as number)) ||
        0;

      const normalized: PostWithCounts = {
        id: (data as any).id,
        content: (data as any).content ?? null,
        image_url: (data as any).image_url ?? null,
        created_at: (data as any).created_at,
        user_id: (data as any).user_id,
        profiles: (data as any).profiles ?? null,
        original_post_id: (data as any).original_post_id ?? null,
        original_author_id: (data as any).original_author_id ?? null,
        original_author: (data as any).original_author ?? null,
        likes_count,
        comments_count,
      };

      return normalized;
    },
  });

  const {
    data: currentUserProfile,
    isLoading: isLoadingProfile,
    error: profileError,
  } = useQuery<UserProfile | null>({
    queryKey: ["profile", user?.id],
    enabled: Boolean(user?.id),
    staleTime: 60000,
    gcTime: 300000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, avatar_text")
        .eq("id", user!.id)
        .single();
      if (error) throw new Error(error.message);
      return data as UserProfile;
    },
  });

  if (isLoadingPost || isLoadingProfile) {
    return (
      <div className="container mx-auto max-w-2xl p-4 mt-6">
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (postError || profileError) {
    return (
      <div className="container mx-auto max-w-2xl p-4 mt-6 text-center text-red-500">
        {(postError as Error)?.message || (profileError as Error)?.message || "Terjadi kesalahan memuat data."}
      </div>
    );
  }

  if (!post || !currentUserProfile) {
    return (
      <div className="container mx-auto max-w-2xl p-4 mt-6 text-center text-muted-foreground">
        Postingan tidak ditemukan atau data pengguna gagal dimuat.
      </div>
    );
  }

  return (
    <div className="bg-muted min-h-screen p-6">
      <div className="w-full max-w-2xl mx-auto">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Kembali
        </Button>
        <Card className="shadow-xl">
          <PostCard
            post={post}
            currentUserId={currentUserProfile.id}
            currentUserName={currentUserProfile.name}
            currentUserInitials={currentUserProfile.avatar_text}
          />
        </Card>
      </div>
    </div>
  );
}