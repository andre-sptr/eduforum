import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Settings, UserPlus, UserMinus, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import PostCard from "@/components/PostCard";
import PostSkeleton from "@/components/PostSkeleton";

const Profile = () => {
  const navigate = useNavigate();
  const { userId } = useParams();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const refreshPosts = async () => {
    const profileId = userId || currentUser?.id;
    if (!profileId) return;

    const { data: postsData } = await supabase
      .from("posts")
      .select(
        `
        *,
        profiles (
          id,
          full_name,
          avatar_url,
          role
        ),
        likes (
          user_id
        )
      `,
      )
      .eq("user_id", profileId)
      .order("created_at", { ascending: false });

    setPosts(postsData || []);
  };

  useEffect(() => {
    loadProfile();
  }, [userId]);

  const loadProfile = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      setCurrentUser(user);

      const profileId = userId || user.id;

      // Load profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", profileId)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      // Load posts
      const { data: postsData } = await supabase
        .from("posts")
        .select(
          `
          *,
          profiles (
            id,
            full_name,
            avatar_url,
            role
          ),
          likes (
            user_id
          )
        `,
        )
        .eq("user_id", profileId)
        .order("created_at", { ascending: false });

      setPosts(postsData || []);

      // Check if following
      if (user.id !== profileId) {
        const { data: followData } = await supabase
          .from("follows")
          .select("*")
          .eq("follower_id", user.id)
          .eq("following_id", profileId)
          .single();

        setIsFollowing(!!followData);
      }

      // Load follower/following counts
      const { count: followers } = await supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", profileId);

      const { count: following } = await supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", profileId);

      setFollowerCount(followers || 0);
      setFollowingCount(following || 0);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!currentUser || !profile) return;

    try {
      if (isFollowing) {
        // Unfollow
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_id", currentUser.id)
          .eq("following_id", profile.id);

        if (error) throw error;

        setIsFollowing(false);
        setFollowerCount((prev) => prev - 1);
        toast.success("Berhenti mengikuti");
      } else {
        // Follow
        const { error } = await supabase.from("follows").insert({
          follower_id: currentUser.id,
          following_id: profile.id,
        });

        if (error) throw error;

        setIsFollowing(true);
        setFollowerCount((prev) => prev + 1);
        toast.success("Berhasil mengikuti");
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleStartChat = async () => {
    if (!currentUser || !profile) return;

    try {
      // Use RPC function to create/find direct conversation
      const { data: conversationId, error } = await supabase.rpc("create_direct_conversation", {
        target_user_id: profile.id,
      });

      if (error) {
        console.error("Error creating chat:", error);
        throw error;
      }

      if (conversationId) {
        navigate(`/chat/${conversationId}`);
      }
    } catch (error: any) {
      toast.error("Gagal membuat chat: " + error.message);
    }
  };

  const getInitials = (name: string) => {
    const names = name.split(" ");
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "siswa":
        return "bg-blue-500/20 text-blue-400";
      case "guru":
        return "bg-green-500/20 text-green-400";
      case "alumni":
        return "bg-purple-500/20 text-purple-400";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Memuat...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Profil tidak ditemukan</p>
      </div>
    );
  }

  const isOwnProfile = currentUser?.id === profile.id;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card border-b border-border shadow-lg">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Profil
          </h1>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <Card className="bg-card border-border p-8 mb-6">
          <div className="flex items-start gap-6">
            <Avatar className="h-24 w-24 border-4 border-accent/20">
              <AvatarImage src={profile.avatar_url} />
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                {getInitials(profile.full_name)}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl font-bold text-foreground">{profile.full_name}</h2>
                <span className={`text-sm px-3 py-1 rounded-full ${getRoleBadgeColor(profile.role)}`}>
                  {profile.role.charAt(0).toUpperCase() + profile.role.slice(1)}
                </span>
              </div>

              {profile.bio && <p className="text-muted-foreground mb-4">{profile.bio}</p>}

              <div className="flex gap-6 mb-4">
                <div>
                  <span className="font-bold text-foreground">{followerCount}</span>
                  <span className="text-muted-foreground ml-1">Pengikut</span>
                </div>
                <div>
                  <span className="font-bold text-foreground">{followingCount}</span>
                  <span className="text-muted-foreground ml-1">Mengikuti</span>
                </div>
              </div>

              <div className="flex gap-2">
                {isOwnProfile ? (
                  <Button
                    onClick={() => navigate("/settings")}
                    className="bg-accent text-accent-foreground hover:bg-accent/90"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Edit Profil
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={handleFollow}
                      className={
                        isFollowing
                          ? "bg-muted text-foreground hover:bg-muted/80"
                          : "bg-accent text-accent-foreground hover:bg-accent/90 shadow-[var(--shadow-gold)]"
                      }
                    >
                      {isFollowing ? (
                        <>
                          <UserMinus className="h-4 w-4 mr-2" />
                          Berhenti Mengikuti
                        </>
                      ) : (
                        <>
                          <UserPlus className="h-4 w-4 mr-2" />
                          Ikuti
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={handleStartChat}
                      variant="outline"
                      className="border-accent text-accent hover:bg-accent hover:text-accent-foreground"
                    >
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Chat
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <h3 className="text-xl font-bold text-foreground">Postingan</h3>
          {loading ? (
            <div className="space-y-4">
              <PostSkeleton />
              <PostSkeleton />
              <PostSkeleton />
            </div>
          ) : posts.length === 0 ? (
            <Card className="bg-card border-border p-8 text-center">
              <p className="text-muted-foreground">Belum ada postingan</p>
            </Card>
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
