import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserAvatar } from '@/components/UserAvatar';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Send, Settings } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface UserProfile {
  id: string;
  name: string;
  bio: string | null;
  avatar_text: string;
  role: string;
  username: string;
}

const UserProfilePage = () => {
  const { user } = useAuth();
  const { name: username } = useParams<{ name: string }>(); 
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUserId = user?.id;
  const [loadingChat, setLoadingChat] = React.useState(false);

  const { data: profile, isLoading, isError } = useQuery<UserProfile | null>({
      queryKey: ['publicProfile', username],
      queryFn: async () => {
          if (!username) return null;
          const decodedUsername = decodeURIComponent(username);
          const { data } = await supabase
              .from('profiles')
              .select('id, name, bio, avatar_text, role, username') 
              .eq('name', decodedUsername)
              .limit(1) // <-- Perbaikan Kritis
              .maybeSingle(); 
          return data;
      },
      enabled: !!username,
  });

  const isCurrentUser = user?.id === profile?.id;

  const { data: isFollowing, isLoading: isFollowingLoading } = useQuery<boolean>({
      queryKey: ['followStatus', profile?.id, user?.id],
      queryFn: async () => {
          if (!user || !profile?.id || isCurrentUser) return false;
          const { data } = await supabase
              .from('user_followers')
              .select('follower_id')
              .eq('follower_id', user.id)
              .eq('following_id', profile.id)
              .maybeSingle(); 
          return !!data; 
      },
      enabled: !!user && !!profile?.id && !isCurrentUser,
  });

  const { data: followerCount = 0 } = useQuery<number>({
      queryKey: ['followerCount', profile?.id],
      queryFn: async () => {
          if (!profile?.id) return 0;
          const { count, error } = await supabase
              .from('user_followers')
              .select('following_id', { count: 'exact', head: true }) 
              .eq('following_id', profile.id);
          if (error) {
              console.error("Error fetching follower count:", error);
              return 0; 
          }
          return count ?? 0;
      },
      enabled: !!profile?.id,
  });

  const toggleFollowMutation = useMutation({
      mutationFn: async () => {
          if (!user || !profile?.id) throw new Error("ID pengguna tidak valid.");
          if (isFollowing) {
              const { error } = await supabase.from('user_followers').delete()
                  .eq('follower_id', user.id)
                  .eq('following_id', profile.id);
              if (error) throw error;
          } else {
              const { error } = await supabase.from('user_followers').insert({
                  follower_id: user.id,
                  following_id: profile.id
              });
              if (error) throw error; 
          }
      },
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['followStatus', profile?.id, user?.id] });
          queryClient.invalidateQueries({ queryKey: ['followerCount', profile?.id] });
          toast.success(isFollowing ? "Berhasil Unfollow." : "Berhasil Follow!");
      },
      onError: (error) => {
          const errorMessage = (error as Error).message;
          if (errorMessage.includes('23505') || errorMessage.includes('duplicate key value')) {
              toast.info("Anda sudah mengikuti pengguna ini."); 
              queryClient.invalidateQueries({ queryKey: ['followStatus', profile?.id, user?.id] });
              return;
          }
          toast.error(`Gagal: ${errorMessage}`);
      }
  });

  const startOrGoToChat = async (recipientId: string) => {
      if (!currentUserId) {
      toast.error("Gagal memulai chat: ID pengguna saat ini tidak ditemukan.");
      return;
      }
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

  if (isLoading) {
      return (
        <div className="flex justify-center p-6 min-h-screen bg-muted">
          <Card className="w-full max-w-2xl shadow-lg">
            <CardContent className="flex items-center p-6 space-x-4">
              <Skeleton className="h-20 w-20 rounded-full" />
              <Skeleton className="h-6 w-48" />
            </CardContent>
          </Card>
        </div>
      );
  }

  if (isError || !profile) {
      return (
        <div className="flex justify-center p-6 min-h-screen bg-muted">
          <Card className="w-full max-w-2xl p-6 text-center text-muted-foreground">
            <p>{!profile ? 'Profil tidak ditemukan.' : 'Gagal memuat profil.'}</p>
          </Card>
        </div>
      );
  }
  
  return (
  <div className="bg-muted min-h-screen p-6">
      <div className="w-full max-w-2xl mx-auto">
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
              <ArrowLeft className="h-5 w-5 mr-2" /> Kembali
          </Button>
          <Card className="shadow-xl">
              <CardHeader className="flex flex-row items-center justify-between">
                  <div className="flex items-center space-x-4">
                      <UserAvatar name={profile.name} initials={profile.avatar_text} size="lg" />
                      <div>
                          <CardTitle className="text-2xl">{profile.name}</CardTitle>
                          <p className="text-sm text-muted-foreground">{profile.role}</p>
                      </div>
                  </div>
                  <div className="flex items-center space-x-2"> 
                      {isCurrentUser ? (
                          <Button variant="secondary" size="sm" onClick={() => navigate('/settings/profile')}>
                              <Settings className="h-4 w-4 mr-2" /> Atur Profil
                          </Button>
                      ) : (
                          <>
                              <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => startOrGoToChat(profile.id)}
                                  disabled={loadingChat}
                              >
                                  <Send className="h-4 w-4 mr-2" /> {loadingChat ? '...' : 'Chat'}
                              </Button>
                              <Button 
                                  variant={isFollowing ? 'secondary' : 'default'}
                                  size="sm"
                                  onClick={() => toggleFollowMutation.mutate()}
                                  disabled={toggleFollowMutation.isPending || isFollowingLoading} 
                              >
                                  {isFollowingLoading 
                                      ? 'Memproses...' 
                                      : isFollowing 
                                      ? 'Mengikuti'
                                      : 'Ikuti'} 
                              </Button>
                          </>
                      )}
                  </div>
              </CardHeader>
              <CardContent className="border-t pt-4">
                  <div className="flex items-center gap-6 mb-4">
                      <div className="text-sm font-medium">
                          <strong>
                              {isFollowingLoading ? '...' : followerCount} 
                          </strong> 
                          <span className="text-muted-foreground"> Pengikut</span>
                      </div>
                  </div>
                  <h3 className="font-semibold mb-2">Bio</h3>
                  <p className="text-muted-foreground">
                      {profile.bio || "Tidak ada bio yang tersedia."}
                  </p>
              </CardContent>
          </Card>
      </div>
  </div>
);
};

export default UserProfilePage;