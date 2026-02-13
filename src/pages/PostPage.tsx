
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import PostCard from "@/components/PostCard";

import { useLeaderboardData } from "@/hooks/useLeaderboardData";

const PostPage = () => {
  const { postId } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const { topFollowers, topLiked } = useLeaderboardData();

  useEffect(() => { loadPost(); }, [postId]);

  const loadPost = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
      const { data: postData, error: postError } = await supabase
          .from("posts")
          .select(`
            id, content, created_at, media_urls, media_types, user_id,
            spotify_track_id,
            profiles:profiles!user_id ( id, full_name, avatar_url, role ),
            likes ( user_id, post_id ),
            reposts ( count ),
            quote_reposts:posts!repost_of_id ( count ),
            quoted_post:repost_of_id (
              id, content, created_at, user_id,
              profiles:profiles!user_id ( id, full_name, avatar_url, role )
            )
          `)
          .eq("id", postId)
          .single();

      if (postError) throw postError;
      if (!postData) {
        toast.error("Postingan tidak ditemukan");
        navigate("/");
        return;
      }
      setPost(postData);
    } catch (e: any) { toast.error(e.message); navigate("/"); } finally { setLoading(false); }
  };

  if (loading) return (
    <div className="min-h-screen grid place-items-center bg-background">
      <div className="text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
        <p className="mt-4 text-muted-foreground animate-pulse">Memuat postingan...</p>
      </div>
    </div>
  );

  if (!post) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-20">
      <div className="flex items-center gap-4 bg-card/30 backdrop-blur-md p-4 rounded-2xl border border-white/10 sticky top-4 z-20 shadow-sm">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-xl hover:bg-primary/10 transition-colors">
              <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
             <h1 className="text-lg font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Utas Postingan</h1>
             <p className="text-xs text-muted-foreground">Detail diskusi dan komentar</p>
          </div>
      </div>

      <div className="animate-in fade-in-50 slide-in-from-bottom-4 duration-700">
         <PostCard 
            post={post} 
            currentUserId={currentUser?.id} 
            onPostUpdated={loadPost} 
            onPostDeleted={() => navigate("/")} 
            postType="global" 
            topFollowers={topFollowers} 
            topLiked={topLiked}
            isDetailView={true}
         />
      </div>
    </div>
  );
};

export default PostPage;