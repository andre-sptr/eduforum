import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Navbar } from '@/components/Navbar'; 
import { LeftSidebar } from '@/components/LeftSidebar'; 
import { RightSidebar } from '@/components/RightSidebar'; 
import { PostCard } from '@/components/PostCard'; 
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth'; 
import { useQuery } from '@tanstack/react-query'; 
import { supabase } from '@/integrations/supabase/client'; 
import { Card, CardContent } from '@/components/ui/card';
import { UserAvatar } from '@/components/UserAvatar';
import { Button } from '@/components/ui/button';

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
  avatar_text: string;
  role: string;
}

const SearchPage = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const { user, loading: authLoading } = useAuth();
  const [currentUserProfile, setCurrentUserProfile] = useState<{id: string, name: string, avatar_text: string} | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (user) {
        const { data } = await supabase.from("profiles").select("id, name, avatar_text").eq("id", user.id).maybeSingle();
        setCurrentUserProfile(data);
      }
    };
    fetchProfile();
  }, [user]);

  const { data: searchResults = [], isLoading } = useQuery<Post[]>({
    queryKey: ['searchPosts', query],
    queryFn: async () => {
      if (!query) return [];

      const { data, error } = await supabase
        .from('posts')
        .select('*, profiles(name, avatar_text, role)')
        .ilike('content', `%${query}%`) 
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!query && !!user,
  });

  const { data: userResults = [], isLoading: isLoadingUsers } = useQuery<SearchedProfile[]>({
    queryKey: ['searchUsers', query],
    queryFn: async () => {
      if (!query) return [];
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, avatar_text, role')
        .ilike('name', `%${query}%`)
        .limit(10);

      if (error) throw error;
      return data || [];
    },
    enabled: !!query && !!user,
  });

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
              <p className="text-center text-muted-foreground">Tidak ada hasil ditemukan.</p>
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
                      <Link to={`/profile/${profile.id}`} className="flex items-center gap-3 group">
                        <UserAvatar name={profile.name} initials={profile.avatar_text} />
                        <div>
                          <h4 className="font-semibold group-hover:underline">{profile.name}</h4>
                          <p className="text-xs text-muted-foreground">{profile.role}</p>
                        </div>
                      </Link>
                      {profile.id !== currentUserProfile.id && (
                          <Button size="sm" variant="outline"> Ikuti </Button>
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
    </div>
  );
};

export default SearchPage;