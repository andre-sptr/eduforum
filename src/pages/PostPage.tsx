import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PostCard, PostWithAuthor } from "@/components/PostCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Card } from '@/components/ui/card';

type PostLike = { user_id: string };
type PostWithDetails = {
  id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  user_id: string;
  likes_count: number;
  comments_count: number;
  profiles: {
    name: string;
    avatar_text: string;
    role: string;
  } | null;
  user_like: PostLike[];
  original_post_id?: string | null;
  original_author_id?: string | null;
  original_author?: {
    name: string;
    avatar_text: string;
    role: string;
  } | null;
};
type UserProfileData = {
  id: string;
  name: string;
  avatar_text: string;
};

const PostPage = () => {
  const { postId } = useParams<{ postId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { 
    data: post, 
    isLoading: isLoadingPost, 
    error: postError 
  } = useQuery<PostWithDetails | null>({
    queryKey: ['post', postId, user?.id],
    queryFn: async () => {
      if (!postId || !user?.id) return null;
      const { data, error } = await supabase
        .from('posts')
        .select(`
          id, content, image_url, created_at, user_id,
          likes_count, comments_count, original_post_id, original_author_id,
          profiles!user_id (name, avatar_text, role),
          original_author:profiles!original_author_id (name, avatar_text, role),
          user_like:post_likes!left(user_id)
        `)
        .eq('id', postId)
        .eq('user_like.user_id', user.id)
        .single();
      if (error) {
        throw new Error(error.message);
      }
      return data as PostWithDetails;
    },
    enabled: !!postId && !!user?.id,
  });

  const { 
    data: currentUserProfile, 
    isLoading: isLoadingProfile 
  } = useQuery<UserProfileData | null>({
    queryKey: ['currentUserProfile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("id, name, avatar_text")
        .eq("id", user.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  if (isLoadingPost || isLoadingProfile) {
    return (
      <div className="container mx-auto max-w-2xl p-4 mt-6">
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (postError) {
    return (
      <div className="container mx-auto max-w-2xl p-4 mt-6 text-center text-red-500">
        Terjadi kesalahan: {postError.message}
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

  const viewerHasLiked = (post.user_like?.length || 0) > 0;

  return (
    <div className="bg-muted min-h-screen p-6">
      <div className="w-full max-w-2xl mx-auto">
        <Button 
            variant="ghost" 
            onClick={() => navigate(-1)}
            className="mb-4"
        >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Kembali
        </Button>
        <Card className="shadow-xl">
          <PostCard
            key={post.id}
            post={{
              ...post,
              likes_count: post.likes_count,
              comments_count: post.comments_count,
              original_post_id: post.original_post_id || null,
              original_author_id: post.original_author_id || null,
              original_author: post.original_author || null,
              viewer_has_liked: viewerHasLiked,
            }}
            currentUserId={currentUserProfile.id}
            currentUserName={currentUserProfile.name}
            currentUserInitials={currentUserProfile.avatar_text}
          />
        </Card>
      </div>
    </div>
  );
};

export default PostPage;