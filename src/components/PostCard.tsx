// src/components/PostCard.tsx
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, MessageCircle, Award, MoreHorizontal, Trash2, FileText, Repeat } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { UserAvatar } from "./UserAvatar";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CommentSection } from "./CommentSection";
import { useNavigate, Link } from "react-router-dom";
import type { FeedPost } from "@/hooks/useInfinitePosts";
import { ImageDialog } from "@/components/ImageDialog";
import { getOptimizedImageUrl } from "@/lib/image";

export type PostWithAuthor = FeedPost & {
  profiles: { name: string; avatar_text: string; role: string };
  original_author: { name: string; avatar_text: string; role: string } | null;
};

interface PostCardProps {
  post: PostWithAuthor;
  currentUserName?: string;
  currentUserInitials?: string;
  currentUserId: string;
}

const getFileMeta = (rawUrl: string) => {
  const [path] = rawUrl.split("?");
  const fileName = path.substring(path.lastIndexOf("/") + 1);
  const ext = (fileName.split(".").pop() || "").toLowerCase();
  const isImage = ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext);
  const isVideo = ["mp4", "webm", "ogg"].includes(ext);
  return { isImage, isVideo, fileName };
};

export const PostCard = ({ post, currentUserName, currentUserInitials, currentUserId }: PostCardProps) => {
  const [showComments, setShowComments] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [loadingChat, setLoadingChat] = useState(false);
  const isRepost = post.original_post_id !== null;
  const displayAuthorProfile = isRepost ? post.original_author : post.profiles;
  const displayAuthorId = isRepost ? post.original_post_id : post.user_id;
  const reposterName = isRepost ? post.profiles.name : null;
  const isAuthor = post.user_id === currentUserId;
  const userHasLiked = post.viewer_has_liked;

  const likeMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Login dulu");
      if (userHasLiked) {
        await supabase.from("post_likes").delete().eq("post_id", post.id).eq("user_id", user.id);
      } else {
        await supabase.from("post_likes").insert({ post_id: post.id, user_id: user.id });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
    onError: (error) => {
      toast.error(`Gagal: ${(error as Error).message}`);
    }
  });

  const deletePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase.from("posts").delete().eq("id", postId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Postingan berhasil dihapus.");
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
    onError: (error: any) => {
      toast.error(`Gagal menghapus: ${error.message}`);
    }
  });

  const repostMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Anda harus login untuk me-repost.");
      const idToRepost = post.original_post_id || post.id;
      const { error } = await supabase.rpc("repost_post", { post_id_to_repost: idToRepost });
      if (error) {
        if (error.code === "23505") throw new Error("Anda sudah me-repost postingan ini.");
        throw new Error(error.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
    onError: (error) => {
      toast.error(`Gagal me-repost: ${(error as Error).message}`);
    }
  });

  const formatTime = (t: string) => {
    const diff = Date.now() - new Date(t).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Baru saja";
    if (mins < 60) return `${mins} menit lalu`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} jam lalu`;
    const days = Math.floor(hours / 24);
    return `${days} hari lalu`;
  };

  const startOrGoToChat = async (recipientId: string) => {
    if (!currentUserId) return toast.error("Gagal memulai chat: ID pengguna saat ini tidak ditemukan.");
    if (currentUserId === recipientId) return toast.info("Anda tidak bisa chat dengan diri sendiri.");
    setLoadingChat(true);
    try {
      const { data: roomId, error } = await supabase.rpc("create_or_get_chat_room", { recipient_id: recipientId });
      if (error) throw error;
      if (!roomId) throw new Error("Gagal mendapatkan ID room chat.");
      navigate(`/chat/${roomId}`);
    } catch (error) {
      toast.error(`Gagal memulai chat: ${(error as Error).message}`);
    } finally {
      setLoadingChat(false);
    }
  };

  const renderContentWithMentions = (content: string | null): React.ReactNode => {
    if (!content) return null;
    const mentionRegex = /@([a-zA-Z0-9_\s]+)/g;
    const parts = content.split(mentionRegex);
    return parts.map((part, index) =>
      index % 2 === 1 ? (
        <Link key={index} to={`/profile/name/${encodeURIComponent(part.trim())}`} className="text-primary hover:underline font-medium">
          @{part.trim()}
        </Link>
      ) : (
        part
      )
    );
  };

  const disableRepost = repostMutation.isPending || displayAuthorId === currentUserId || isAuthor;
  const profileLink = `/profile/name/${encodeURIComponent(post.profiles.name)}`;

  return (
    <Card className="overflow-hidden shadow-md">
      {isRepost && (
        <div className="flex items-center gap-2 px-4 pt-3 text-sm text-muted-foreground">
          <Repeat className="h-4 w-4" />
          <Link to={`/profile/name/${encodeURIComponent(reposterName || "Seseorang")}`} className="font-medium hover:underline transition-colors">
            {reposterName || "Seseorang"}
          </Link>
          <span>me-repost</span>
        </div>
      )}
      <div className="p-4">
        <div className="flex gap-3 justify-between items-start">
          <div className="flex gap-3">
            <Link to={profileLink} className="flex gap-3 items-start group">
              <UserAvatar name={displayAuthorProfile?.name || "User"} initials={displayAuthorProfile?.avatar_text || "??"} />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{displayAuthorProfile?.name || "Pengguna Dihapus"}</h3>
                  {!isRepost && isAuthor && <Badge variant="secondary" className="px-2 py-0.5 text-xs font-medium">Saya</Badge>}
                  {isRepost && displayAuthorId === currentUserId && <Badge variant="outline" className="px-2 py-0.5 text-xs font-medium">Penulis Asli</Badge>}
                  {displayAuthorProfile?.role === "Guru" && <Badge className="bg-accent"><Award className="h-3 w-3 mr-1" />Guru</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{formatTime(post.created_at)}</p>
              </div>
            </Link>
          </div>
          {isAuthor ? (
            <AlertDialog>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem
                      className="flex gap-2 items-center text-red-500 focus:text-red-500 cursor-pointer"
                      onSelect={(e) => e.preventDefault()}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Hapus Postingan</span>
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                </DropdownMenuContent>
              </DropdownMenu>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Anda yakin?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tindakan ini tidak dapat dibatalkan dan akan menghapus postingan Anda.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Batal</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-red-500 hover:bg-red-600"
                    onClick={() => deletePostMutation.mutate(post.id)}
                    disabled={deletePostMutation.isPending}
                  >
                    {deletePostMutation.isPending ? "Menghapus..." : "Ya, Hapus"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <Button size="sm" variant="outline" onClick={() => startOrGoToChat(displayAuthorId!)} disabled={loadingChat || !displayAuthorId}>
              {loadingChat ? "..." : "Chat"}
            </Button>
          )}
        </div>
        <p className="mt-3 whitespace-pre-wrap">{renderContentWithMentions(post.content)}</p>
        {post.image_url && (() => {
          const { isImage, isVideo, fileName } = getFileMeta(post.image_url);
          if (isImage) {
            const thumb = getOptimizedImageUrl(post.image_url, 500)!;
            const full = getOptimizedImageUrl(post.image_url, 1600)!;
            return (
              <ImageDialog
                trigger={
                  <div className="mt-3 aspect-video overflow-hidden rounded-lg border bg-muted cursor-pointer">
                    <img src={thumb} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
                  </div>
                }
                thumbSrc={thumb}
                fullSrc={full}
                alt={`Gambar dari ${displayAuthorProfile?.name || "pengguna"}`}
              />
            );
          }
          if (isVideo) {
            return (
              <div className="mt-3 aspect-video overflow-hidden rounded-lg border bg-black">
                <video src={post.image_url} controls preload="none" className="w-full h-full object-contain">
                  Browser Anda tidak mendukung tag video.
                </video>
              </div>
            );
          }
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
        })()}
        <div className="mt-4 text-sm text-muted-foreground">
          {post.likes_count} suka • {post.comments_count} komentar
        </div>
        <div className="mt-3 flex justify-around border-t pt-2">
          <Button
            variant="ghost"
            size="sm"
            className={`group flex items-center gap-2 ${userHasLiked ? "text-red-500" : "text-muted-foreground"}`}
            onClick={() => likeMutation.mutate()}
            disabled={likeMutation.isPending}
          >
            <Heart className={`h-5 w-5 ${userHasLiked ? "fill-current" : ""} ${!userHasLiked ? "group-hover:text-red-500" : ""}`} />
            <span className={!userHasLiked ? "group-hover:text-red-500" : ""}>Suka</span>
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
            onClick={() => repostMutation.mutate()}
            disabled={disableRepost}
          >
            <Repeat className={`h-5 w-5 ${!disableRepost ? "group-hover:text-green-500" : ""}`} />
            <span className={`${!disableRepost ? "group-hover:text-green-500" : ""}`}>
              {repostMutation.isPending ? "..." : "Repost"}
            </span>
          </Button>
        </div>
        {showComments && currentUserId && currentUserName && currentUserInitials && (
          <div className="mt-4">
            <CommentSection
              postId={post.id}
              currentUserProfile={{ id: currentUserId, name: currentUserName, avatar_text: currentUserInitials }}
            />
          </div>
        )}
      </div>
    </Card>
  );
};