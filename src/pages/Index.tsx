import { Navbar } from "@/components/Navbar";
import { CreatePost } from "@/components/CreatePost";
import { PostCard, PostWithAuthor } from "@/components/PostCard";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { LeftSidebar } from "@/components/LeftSidebar";
import { RightSidebar } from "@/components/RightSidebar";

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      return data;
    },
    enabled: !!user,
  });

  const { data: posts = [], isLoading } = useQuery<PostWithAuthor[]>({
    queryKey: ["posts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("posts")
        .select(`
          *,
          profiles!user_id(name, avatar_text, role),
          original_author:profiles!original_author_id(name, avatar_text, role)
        `)
        .order("created_at", { ascending: false });
        
      return (data as PostWithAuthor[]) || [];
    },
    enabled: !!user,
  });

  if (loading || !user || !profile) {
    return (
      <div className="min-h-screen bg-muted">
        <Navbar />
        <main className="container mx-auto grid grid-cols-10 gap-6 py-6">
          <aside className="col-span-2 hidden md:block">
            <Skeleton className="h-40 w-full rounded-lg" />
          </aside>
          
          <section className="col-span-10 md:col-span-5 space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </section>

          <aside className="col-span-10 md:col-span-3 hidden md:block">
            <Skeleton className="h-40 w-full rounded-lg" />
          </aside>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted">
      <Navbar userName={profile.name} userInitials={profile.avatar_text} />
      <main className="container mx-auto grid grid-cols-10 gap-6 py-6">
        
        <LeftSidebar />

        <section className="col-span-10 md:col-span-5 space-y-4">
          <CreatePost userName={profile.name} userInitials={profile.avatar_text} />
          
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            posts.map((post) => (
              <PostCard 
                key={post.id} 
                post={post} 
                currentUserName={profile.name} 
                currentUserInitials={profile.avatar_text} 
                currentUserId={profile.id}
              />
            ))
          )}
        </section>

        <RightSidebar />
        
      </main>
    </div>
  );
};

export default Index;