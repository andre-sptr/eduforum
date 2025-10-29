import React, { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { Navbar } from '@/components/Navbar'; 
import { LeftSidebar } from '@/components/LeftSidebar'; 
import { RightSidebar } from '@/components/RightSidebar'; 
import { PostCard, PostWithAuthor } from '@/components/PostCard';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth'; 
import { useQuery } from '@tanstack/react-query'; 
import { supabase } from '@/integrations/supabase/client'; 
import { Card, CardContent } from '@/components/ui/card';
import { UserAvatar } from '@/components/UserAvatar';
import { Button } from '@/components/ui/button';
import { Badge } from "@/components/ui/badge";
import { toast } from 'sonner';

interface Post {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
  profiles: { name: string; avatar_text: string; role: string };
}

interface SearchedProfile {
  id: string;
  name: string;
  bio: string | null
  avatar_text: string;
  role: string;
}

const SearchPage = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const { user, loading: authLoading } = useAuth();
  const [currentUserProfile, setCurrentUserProfile] = useState<{id: string, name: string, avatar_text: string} | null>(null);
  const navigate = useNavigate();
  const [loadingChat, setLoadingChat] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (user) {
        const { data } = await supabase.from("profiles").select("id, name, avatar_text").eq("id", user.id).maybeSingle();
        setCurrentUserProfile(data);
      }
    };
    fetchProfile();
  }, [user]);

  const { data: searchResults = [], isLoading } = useQuery<PostWithAuthor[]>({
    queryKey: ['searchPosts', query],
    queryFn: async () => {
      if (!query) return [];

      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          profiles!user_id(name, avatar_text, role),
          original_author:profiles!original_author_id(name, avatar_text, role)
        `)
        .ilike('content', `%${query}%`) 
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data as PostWithAuthor[]) || [];
    },
    enabled: !!query && !!user,
  });

  const { data: userResults = [], isLoading: isLoadingUsers } = useQuery<SearchedProfile[]>({
    queryKey: ['searchUsers', query],
    queryFn: async () => {
      if (!query) return [];
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, bio, avatar_text, role')
        .ilike('name', `%${query}%`)
        .limit(10);

      if (error) throw error;
      return data || [];
    },
    enabled: !!query && !!user,
  });

  const startOrGoToChat = async (recipientId: string) => {
    if (!currentUserProfile) {
      toast.error("Gagal memulai chat: Profil pengguna tidak ditemukan.");
      return;
    }
    const currentUserId = currentUserProfile.id;

    if (currentUserId === recipientId) {
        toast.info("Anda tidak bisa chat dengan diri sendiri.");
        return;
    }
    
    setLoadingChat(true); 

    try {
      const { data: roomId, error } = await supabase
        .rpc('create_or_get_chat_room', { 
            recipient_id: recipientId
        });

      if (error) throw error;
      if (!roomId) throw new Error("Gagal mendapatkan ID room chat."); 

      navigate(`/chat/${roomId}`);

    } catch (error) {
      console.error("Error memulai chat:", error);
      toast.error(`Gagal memulai chat: ${(error as Error).message}`);
    } finally {
       setLoadingChat(false); 
    }
  };

  if (authLoading || !currentUserProfile) {
    return (
      <div className="min-h-screen bg-muted">
        <Navbar /> 
        
        <main className="container mx-auto grid grid-cols-10 gap-6 py-6">
          <aside className="col-span-2 hidden md:block">
            <Skeleton className="h-40 w-full rounded-lg" />
          </aside>
          
          <section className="col-span-10 md:col-span-5 space-y-4">
            <Skeleton className="h-8 w-3/4 mb-4" /> 
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </section>

          <aside className="col-span-10 md:col-span-3 hidden md:block">
            <Skeleton className="h-40 w-full rounded-lg" />
            <Skeleton className="h-64 w-full rounded-lg mt-6" /> 
          </aside>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted">
      <Navbar userName={currentUserProfile.name} userInitials={currentUserProfile.avatar_text} /> 
      
      <main className="container mx-auto grid grid-cols-10 gap-6 py-6">
        <LeftSidebar />

        <section className="col-span-10 md:col-span-5 space-y-4">
          <h2 className="text-xl font-semibold mb-4">
            Hasil Pencarian untuk: "{query}"
          </h2>

          <div>
            {isLoading ? (
              <>
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-40 w-full" />
              </>
            ) : searchResults.length === 0 ? (
              <p className="text-center text-muted-foreground">Tidak ada hasil postingan ditemukan.</p>
            ) : (
              searchResults.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  currentUserId={currentUserProfile.id}
                  currentUserName={currentUserProfile.name}
                  currentUserInitials={currentUserProfile.avatar_text}
                />
              ))
            )}
          </div>

          <div>
            <h3 className="text-lg font-medium mb-3 border-b pb-2">Pengguna</h3>
            {isLoadingUsers ? (
              <Skeleton className="h-20 w-full" />
            ) : userResults.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">Tidak ada pengguna ditemukan.</p>
            ) : (
              <Card>
                <CardContent className="p-4 space-y-4">
                  {userResults.map((profile) => (
                    <div key={profile.id} className="flex items-center justify-between">
                      <div className="flex items-start gap-3">
                        <UserAvatar name={profile.name} initials={profile.avatar_text} />
                        <div>
                          <div className="flex items-baseline gap-1">
                            <h4 className="font-semibold">{profile.name}</h4>
                            <Badge variant="secondary" className="px-1.5 py-0 text-xs font-medium h-fit">
                              {profile.role}
                            </Badge>
                          </div>

                          {profile.bio ? ( 
                              <p className="text-xs text-muted-foreground mt-0.5">{profile.bio}</p>
                          ) : (
                              <p className="text-xs text-muted-foreground mt-0.5 italic">Tidak ada bio</p> 
                          )}
                        </div>
                      </div>

                      {profile.id !== currentUserProfile.id && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => startOrGoToChat(profile.id)}
                          disabled={loadingChat}
                        > 
                          {loadingChat ? '...' : 'Chat'}
                        </Button>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </section>

        <RightSidebar />
      </main>

      <footer className="border-t py-4 bg-muted/30">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground">
            <a
              href="https://flamyheart.site"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary hover:underline underline-offset-4"
            >
              © {new Date().getFullYear()} Andre Saputra
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default SearchPage;