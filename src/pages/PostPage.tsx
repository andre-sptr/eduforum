// src/pages/PostPage.tsx
import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import PostCard from "@/components/PostCard";
import { RankBadge } from "@/components/RankBadge";

const PostPage = () => {
  const { postId } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [topFollowers, setTopFollowers] = useState<any[]>([]);
  const [topLiked, setTopLiked] = useState<any[]>([]);

  useEffect(() => { loadPost(); }, [postId]);

  const loadPost = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
      const [postRes, tfRes, tlRes] = await Promise.all([
        supabase
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
          .single(),
        supabase.rpc("get_top_5_followers"),
        supabase.rpc("get_top_5_liked_users")
      ]);
      if (tfRes.data) setTopFollowers(tfRes.data);
      if (tlRes.data) setTopLiked(tlRes.data);
      if (postRes.error) throw postRes.error;
      if (!postRes.data) {
        toast.error("Postingan tidak ditemukan");
        navigate("/");
        return;
      }
      setPost(postRes.data);
    } catch (e: any) { toast.error(e.message); navigate("/"); } finally { setLoading(false); }
  };

  if (loading) return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-b from-background to-muted/40">
      <div className="rounded-2xl bg-card shadow-2xl border border-border px-8 py-10 text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-accent/40 border-t-accent" />
        <p className="mt-4 text-muted-foreground">Memuat postingan...</p>
      </div>
    </div>
  );

  if (!post) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/40">
      <header className="sticky top-0 z-50 bg-card border-b border-border shadow-sm">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="rounded-xl hover:bg-accent/10">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Postingan</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-3xl">
        <PostCard post={post} currentUserId={currentUser?.id} 
        // onLike={loadPost} 
        onPostUpdated={loadPost} onPostDeleted={() => navigate("/")} postType="global" topFollowers={topFollowers} topLiked={topLiked}/>
      </main>
    </div>
  );
};

export default PostPage;