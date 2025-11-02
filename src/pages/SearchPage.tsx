import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Search, User, FileText } from "lucide-react";
import PostCard from "@/components/PostCard";
import PostSkeleton from "@/components/PostSkeleton";
import { toast } from "sonner";

const SearchPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [posts, setPosts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const refreshPosts = async () => {
    if (searchQuery.trim()) {
      await handleSearch(searchQuery);
    }
  };

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    const query = searchParams.get("q");
    if (query) {
      setSearchQuery(query);
      handleSearch(query);
    }
  }, [searchParams]);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    setCurrentUser(profile);
  };

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setPosts([]);
      setUsers([]);
      return;
    }

    setLoading(true);
    try {
      // Search posts
      const { data: postsData, error: postsError } = await supabase
        .from("posts")
        .select("*")
        .ilike("content", `%${query}%`)
        .order("created_at", { ascending: false })
        .limit(20);

      if (postsError) throw postsError;

      if (postsData && postsData.length > 0) {
        const userIds = [...new Set(postsData.map(p => p.user_id))];
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url, role")
          .in("id", userIds);

        const postIds = postsData.map(p => p.id);
        const { data: likesData } = await supabase
          .from("likes")
          .select("post_id, user_id")
          .in("post_id", postIds);

        const profilesMap = new Map(
          (profilesData || []).map(p => [p.id, p])
        );

        const likesMap = new Map<string, any[]>();
        (likesData || []).forEach(like => {
          if (!likesMap.has(like.post_id)) {
            likesMap.set(like.post_id, []);
          }
          likesMap.get(like.post_id)!.push(like);
        });

        const postsWithData = postsData.map(post => ({
          ...post,
          profiles: profilesMap.get(post.user_id),
          likes: likesMap.get(post.id) || []
        }));

        setPosts(postsWithData);
      } else {
        setPosts([]);
      }

      // Search users
      const { data: usersData, error: usersError } = await supabase
        .from("profiles")
        .select("*")
        .ilike("full_name", `%${query}%`)
        .limit(20);

      if (usersError) throw usersError;
      setUsers(usersData || []);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card border-b border-border shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <form onSubmit={handleSearchSubmit} className="flex-1 max-w-2xl">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Cari postingan atau user..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </form>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <Tabs defaultValue="posts" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="posts" className="gap-2">
              <FileText className="h-4 w-4" />
              Postingan ({posts.length})
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <User className="h-4 w-4" />
              User ({users.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="posts" className="space-y-4">
            {loading ? (
              <div className="space-y-4">
                <PostSkeleton />
                <PostSkeleton />
                <PostSkeleton />
              </div>
            ) : posts.length > 0 ? (
              posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  currentUserId={currentUser?.id}
                  onLike={refreshPosts}
                  onPostUpdated={refreshPosts}
                  onPostDeleted={refreshPosts}
                />
              ))
            ) : (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery ? "Tidak ada postingan ditemukan" : "Masukkan kata kunci untuk mencari"}
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto"></div>
                <p className="mt-4 text-muted-foreground">Mencari...</p>
              </div>
            ) : users.length > 0 ? (
              users.map((user) => (
                <Card 
                  key={user.id}
                  className="cursor-pointer hover:bg-accent/5 transition-colors"
                  onClick={() => navigate(`/profile/${user.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={user.avatar_url} alt={user.full_name} />
                        <AvatarFallback>{user.full_name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground">{user.full_name}</h3>
                        {user.bio && (
                          <p className="text-sm text-muted-foreground line-clamp-1">{user.bio}</p>
                        )}
                      </div>
                      <Button variant="ghost" size="sm">
                        Lihat Profil
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-12">
                <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery ? "Tidak ada user ditemukan" : "Masukkan kata kunci untuk mencari"}
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default SearchPage;
