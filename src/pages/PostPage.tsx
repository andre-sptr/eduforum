import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PostCard } from "@/components/PostCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Card } from '@/components/ui/card';

type PostWithDetails = {
  id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  user_id: string;
  profiles: {
    name: string;
    avatar_text: string;
    role: string;
  } | null;
  likes: Array<{ user_id: string }>;
  comments: Array<{ id: string }>;
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
    queryKey: ['post', postId],
    queryFn: async () => {
      if (!postId) return null;

      const { data, error } = await supabase
        .from('posts')
        .select(`
          id,
          content,
          image_url,
          created_at,
          user_id, 
          profiles!user_id (name, avatar_text, role),
          likes:post_likes ( user_id ),
          comments ( id ),
          original_post_id,
          original_author_id,
          original_author:profiles!original_author_id (name, avatar_text, role)
        `)
        .eq('id', postId)
        .single();

      if (error) {
        throw new Error(error.message);
      }
      return data as PostWithDetails;
    },
    enabled: !!postId,
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
              likes_count: post.likes.length,
              comments_count: post.comments.length,
              original_post_id: post.original_post_id || null,
              original_author_id: post.original_author_id || null,
              original_author: post.original_author || null,
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