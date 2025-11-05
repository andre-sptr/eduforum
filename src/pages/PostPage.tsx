// src/pages/PostPage.tsx
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import PostCard from "@/components/PostCard";

const PostPage = () => {
  const { postId } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => { loadPost(); }, [postId]);

  const loadPost = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
      const { data: postData, error: postError } = await supabase.from("posts").select("*").eq("id", postId).single();
      if (postError) throw postError;
      if (!postData) { toast.error("Postingan tidak ditemukan"); navigate("/"); return; }
      const { data: profileData } = await supabase.from("profiles").select("*").eq("id", postData.user_id).single();
      const { data: likesData } = await supabase.from("likes").select("*").eq("post_id", postId);
      setPost({ ...postData, profiles: profileData, likes: likesData || [] });
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
        <PostCard post={post} currentUserId={currentUser?.id} onLike={loadPost} onPostUpdated={loadPost} onPostDeleted={() => navigate("/")} postType="global" />
      </main>
    </div>
  );
};

export default PostPage;