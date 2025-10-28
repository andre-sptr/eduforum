import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, MessageCircle, Share2, Award, MoreHorizontal, Trash2, FileText } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { UserAvatar } from "./UserAvatar";
import { Badge } from "@/components/ui/badge";
import { useState } from "react"; 
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { CommentSection } from "./CommentSection";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";

interface PostCardProps {
  post: {
    id: string;
    user_id: string;
    content: string;
    image_url: string | null;
    likes_count: number;
    comments_count: number;
    created_at: string;
    profiles: { name: string; avatar_text: string; role: string };
  };
  currentUserName?: string;
  currentUserInitials?: string;
  currentUserId: string;
}

export const PostCard = ({ post, currentUserName, currentUserInitials, currentUserId }: PostCardProps) => {
  const [showComments, setShowComments] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [loadingChat, setLoadingChat] = useState(false);

  const isAuthor = post.user_id === currentUserId;

  const { data: userLike } = useQuery({
    queryKey: ["userLike", post.id],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("post_likes").select("id").eq("post_id", post.id).eq("user_id", user.id).maybeSingle();
      return data;
    },
  });

  const likeMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Login dulu");
      if (userLike) {
        await supabase.from("post_likes").delete().eq("post_id", post.id).eq("user_id", user.id);
      } else {
        await supabase.from("post_likes").insert({ post_id: post.id, user_id: user.id });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["userLike", post.id] });
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase.from('posts').delete().eq('id', postId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Postingan berhasil dihapus.");
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
    onError: (error) => {
      toast.error(`Gagal menghapus: ${error.message}`);
    }
  });

  const formatTime = (t: string) => {
    const diff = Date.now() - new Date(t).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Baru saja";
    if (mins < 60) return `${mins} menit lalu`;
    return `${Math.floor(mins / 60)} jam lalu`;
  };

  const handleShare = async () => {
    const shareData = {
      title: "Lihat postingan ini di EduForum",
      text: `"${post.content}" - oleh ${post.profiles.name}`,
      url: `${window.location.origin}/post/${post.id}`
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error("Error saat berbagi:", err);
          toast.error("Gagal berbagi postingan.");
        }
      }
    } else {
      if (navigator.clipboard && navigator.clipboard.writeText) { 
        try {
          await navigator.clipboard.writeText(shareData.url);
          toast.success("Link postingan disalin ke clipboard!");
        } catch (err) {
          console.error("Gagal menyalin link:", err);
          toast.error("Gagal menyalin link ke clipboard.");
        }
      } else {
        toast.error("Browser tidak mendukung fitur berbagi atau menyalin."); 
      }
    }
  };

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

  return (
    <Card className="overflow-hidden shadow-md">
      <div className="p-4">
        <div className="flex gap-3 justify-between items-start">
          <div className="flex gap-3">
            <UserAvatar name={post.profiles.name} initials={post.profiles.avatar_text} />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{post.profiles.name}</h3>
                
                {isAuthor && (
                  <Badge variant="secondary" className="px-2 py-0.5 text-xs font-medium">
                    Saya
                  </Badge>
                )}
                
                {post.profiles.role === "Guru" && <Badge className="bg-accent"><Award className="h-3 w-3 mr-1" />Guru</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">{formatTime(post.created_at)}</p>
            </div>
          </div>

          {isAuthor ? ( 
              <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                          <MoreHorizontal className="h-4 w-4" />
                      </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                      <DropdownMenuItem
                          className="flex gap-2 items-center text-red-500 focus:text-red-500 cursor-pointer"
                          onClick={() => deletePostMutation.mutate(post.id)}
                          disabled={deletePostMutation.isPending}
                      >
                          <Trash2 className="h-4 w-4" />
                          <span>{deletePostMutation.isPending ? "Menghapus..." : "Hapus Postingan"}</span>
                      </DropdownMenuItem>
                  </DropdownMenuContent>
              </DropdownMenu>
          ) : (
              <Button
                  size="sm"
                  variant="outline"
                  onClick={() => startOrGoToChat(post.user_id)} 
                  disabled={loadingChat} 
              >
                  {loadingChat ? '...' : 'Chat'}
              </Button>
          )}
        </div>
        
        <p className="mt-3">{post.content}</p>
        
        {post.image_url && (() => {
          const urlParts = post.image_url.split('.');
          const extension = urlParts.pop()?.toLowerCase() || '';
          const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension);
          const isVideo = ['mp4', 'webm', 'ogg'].includes(extension);
          const fileNameWithParams = post.image_url.substring(post.image_url.lastIndexOf('/') + 1);
          const fileName = fileNameWithParams.split('?')[0];

          if (isImage) {
            return (
              <Dialog>
                <DialogTrigger asChild>
                  <div className="mt-3 aspect-video overflow-hidden rounded-lg border bg-muted cursor-pointer"> 
                    <img 
                      src={post.image_url} 
                      alt="Post image" 
                      className="w-full h-full object-cover" 
                    />
                  </div>
                </DialogTrigger>
                <DialogContent className="max-w-4xl p-0 border-0"> 
                  <img 
                    src={post.image_url} 
                    alt="Post image full size" 
                    className="w-full h-auto max-h-[80vh] object-contain"
                  />
                </DialogContent>
              </Dialog>
            );
          } else if (isVideo) {
             return (
              <div className="mt-3 aspect-video overflow-hidden rounded-lg border bg-black">
                <video 
                    src={post.image_url} 
                    controls 
                    className="w-full h-full object-contain" 
                >
                    Browser Anda tidak mendukung tag video.
                </video>
              </div>
            );
          } else {
            return (
              <a 
                href={post.image_url} 
                download 
                target="_blank" 
                rel="noopener noreferrer"
                className="mt-3 block border rounded-lg p-3 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-6 w-6 text-primary flex-shrink-0" /> 
                  <div className="overflow-hidden">
                    <p className="text-sm font-medium truncate">{decodeURIComponent(fileName)}</p> 
                    <p className="text-xs text-muted-foreground">Klik untuk mengunduh</p>
                  </div>
                </div>
              </a>
            );
          }
        })()}
        
        <div className="mt-4 text-sm text-muted-foreground">{post.likes_count} suka • {post.comments_count} komentar</div>

        <div className="mt-3 flex justify-around border-t pt-2">
          <Button
            variant="ghost"
            size="sm"
            className={`group flex items-center gap-2 ${userLike ? "text-red-500" : "text-muted-foreground"}`}
            onClick={() => likeMutation.mutate()}
          >
            <Heart className={`h-5 w-5 ${userLike ? "fill-current" : ""} ${!userLike ? "group-hover:text-red-500" : ""}`} />
            <span className={!userLike ? "group-hover:text-red-500" : ""}>Suka</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="group flex items-center gap-2 text-muted-foreground"
            onClick={() => setShowComments(!showComments)}
          >
            <MessageCircle className="h-5 w-5 group-hover:text-primary" />
            <span className="group-hover:text-primary">Komentar</span>
          </Button>
          <Button 
          variant="ghost" 
          size="sm" 
          className="group flex items-center gap-2 text-muted-foreground"
          onClick={handleShare}
        >
          <Share2 className="h-5 w-5 group-hover:text-primary" />
          <span className="group-hover:text-primary">Bagikan</span>
        </Button>
        </div>
        {showComments && <div className="mt-4"><CommentSection postId={post.id} currentUserName={currentUserName} currentUserInitials={currentUserInitials} currentUserId={currentUserId} /></div>}
      </div>
    </Card>
  );
};
