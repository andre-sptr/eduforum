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
import React, { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { CommentSection } from "./CommentSection";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useNavigate, Link } from "react-router-dom";
import { LazyMedia } from "./LazyMedia";
import { profilePath } from "@/utils/profilePath";
import type { PostWithCounts } from "@/pages/PostPage";
import { formatTime } from "@/lib/time";

export type PostWithAuthor = PostWithCounts & {
  profiles: { name: string | null; username?: string | null; avatar_text: string | null; role: string | null } | null;
  original_author: { name: string | null; username?: string | null; avatar_text: string | null; role: string | null } | null;
};

interface PostCardProps {
  post: PostWithAuthor;
  currentUserName?: string;
  currentUserInitials?: string;
  currentUserId: string;
}

const PostCardBase = ({ post, currentUserName, currentUserInitials, currentUserId }: PostCardProps) => {
  const [showComments, setShowComments] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [loadingChat, setLoadingChat] = useState(false);

  const isRepost = post.original_post_id !== null;
  const displayAuthorProfile = isRepost ? post.original_author : post.profiles;
  const displayAuthorId = isRepost ? post.original_author_id : post.user_id;
  const isAuthor = post.user_id === currentUserId;

  const { data: userLike } = useQuery({
    queryKey: ["userLike", post.id, currentUserId],
    enabled: !!currentUserId && !!post.id,
    staleTime: 30000,
    queryFn: async () => {
      const { data } = await supabase
        .from("post_likes")
        .select("id")
        .eq("post_id", post.id)
        .eq("user_id", currentUserId)
        .maybeSingle();
      return data;
    },
  });

  const likeMutation = useMutation({
    mutationFn: async () => {
      if (!currentUserId) throw new Error("Login dulu");
      if (userLike) {
        const { error } = await supabase.from("post_likes").delete().eq("post_id", post.id).eq("user_id", currentUserId);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("post_likes").insert({ post_id: post.id, user_id: currentUserId });
        if (error) throw new Error(error.message);
      }
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["posts"] });
      await queryClient.cancelQueries({ queryKey: ["post", post.id] });

      const prevLists = queryClient.getQueryData<any>(["posts"]);
      const prevDetail = queryClient.getQueryData<any>(["post", post.id]);
      const delta = userLike ? -1 : 1;

      queryClient.setQueriesData({ queryKey: ["posts"], exact: false }, (old: any) => {
        if (!old || !Array.isArray(old.pages)) return old;
        return {
          ...old,
          pages: old.pages.map((pg: any) => ({
            ...pg,
            rows: Array.isArray(pg.rows)
              ? pg.rows.map((it: any) =>
                  it.id === post.id ? { ...it, likes_count: Math.max(0, (it.likes_count || 0) + delta) } : it
                )
              : pg.rows,
          })),
        };
      });

      if (prevDetail) {
        queryClient.setQueryData(["post", post.id], {
          ...prevDetail,
          likes_count: Math.max(0, (prevDetail.likes_count || 0) + delta),
        });
      }

      queryClient.setQueryData(["userLike", post.id, currentUserId], userLike ? null : { id: "optimistic" });
      return { prevLists, prevDetail };
    },
    onError: (error, _, ctx) => {
      if (ctx?.prevLists) queryClient.setQueryData(["posts"], ctx.prevLists);
      if (ctx?.prevDetail) queryClient.setQueryData(["post", post.id], ctx.prevDetail);
      queryClient.setQueryData(["userLike", post.id, currentUserId], userLike ?? null);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["post", post.id] });
      queryClient.invalidateQueries({ queryKey: ["userLike", post.id, currentUserId] });
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase.from("posts").delete().eq("id", postId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
  });

  const repostMutation = useMutation({
    mutationFn: async () => {
      const idToRepost = post.original_post_id || post.id;
      const { error } = await supabase.rpc("repost_post", { post_id_to_repost: idToRepost });
      if (error) {
        if ((error as any).code === "23505") throw new Error("Anda sudah me-repost postingan ini.");
        throw new Error(error.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
  });

  const startOrGoToChat = async (recipientId: string) => {
    if (!currentUserId) return;
    if (currentUserId === recipientId) return;
    setLoadingChat(true);
    try {
      const { data: roomId, error } = await supabase.rpc("create_or_get_chat_room", { recipient_id: recipientId });
      if (error) throw error;
      if (!roomId) throw new Error("Gagal mendapatkan ID room chat.");
      navigate(`/chat/${roomId}`);
    } finally {
      setLoadingChat(false);
    }
  };

  const renderContentWithMentions = (content: string | null): React.ReactNode => {
    if (!content) return null;
    const mentionRegex = /@([a-z0-9]+(?:-[a-z0-9]+)*)/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = mentionRegex.exec(content)) !== null) {
      const [full, uname] = match;
      const start = match.index;
      const end = start + full.length;
      if (start > lastIndex) parts.push(content.slice(lastIndex, start));
      parts.push(
        <Link key={`${start}-${end}`} to={profilePath(uname, undefined)} className="text-primary hover:underline font-medium">
          @{uname}
        </Link>
      );
      lastIndex = end;
    }
    if (lastIndex < content.length) parts.push(content.slice(lastIndex));
    return parts;
  };

  const ext = (post.image_url || "").split(".").pop()?.toLowerCase()?.split("?")[0] || "";
  const isImage = ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext);
  const isVideo = ["mp4", "webm", "ogg"].includes(ext);
  const authorUsername = displayAuthorProfile?.username || undefined;
  const authorName = displayAuthorProfile?.name || "Pengguna";
  const authorLink = profilePath(authorUsername, authorName);
  const disableRepost =
    repostMutation.isPending || ((isRepost ? post.original_author_id : post.user_id) === currentUserId) || isAuthor;

  return (
    <Card className="overflow-hidden shadow-md">
      {isRepost && (
        <div className="flex items-center gap-2 px-4 pt-3 text-sm text-muted-foreground">
          <Repeat className="h-4 w-4" />
          <Link to={profilePath(post.profiles?.username || undefined, post.profiles?.name || undefined)} className="font-medium hover:underline transition-colors">
            {post.profiles?.name || "Seseorang"}
          </Link>
          <span>me-repost</span>
        </div>
      )}

      <div className="p-4">
        <div className="flex gap-3 justify-between items-start">
          <div className="flex gap-3">
            <Link to={authorLink} className="flex gap-3 items-start group">
              <UserAvatar name={displayAuthorProfile?.name || "User"} initials={displayAuthorProfile?.avatar_text || "??"} />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{displayAuthorProfile?.name || "Pengguna Dihapus"}</h3>
                  {!isRepost && isAuthor && (
                    <Badge variant="secondary" className="px-2 py-0.5 text-xs font-medium">
                      Saya
                    </Badge>
                  )}
                  {isRepost && post.original_author_id === currentUserId && (
                    <Badge variant="outline" className="px-2 py-0.5 text-xs font-medium">
                      Penulis Asli
                    </Badge>
                  )}
                  {displayAuthorProfile?.role === "Guru" && (
                    <Badge className="bg-accent">
                      <Award className="h-3 w-3 mr-1" />
                      Guru
                    </Badge>
                  )}
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
            <Button
              size="sm"
              variant="outline"
              onClick={() => startOrGoToChat(displayAuthorId!)}
              disabled={loadingChat || !displayAuthorId}
            >
              {loadingChat ? "..." : "Chat"}
            </Button>
          )}
        </div>

        <p className="mt-3" style={{ whiteSpace: "pre-wrap" }}>{renderContentWithMentions(post.content)}</p>

        {post.image_url && (isImage || isVideo) && (
          <Dialog>
            <DialogTrigger asChild>
              <div className="mt-3">
                <LazyMedia url={post.image_url} aspect="video" objectFit={isVideo ? "contain" : "cover"} />
              </div>
            </DialogTrigger>
            <DialogContent className="max-w-4xl p-0 border-0">
              {isImage ? (
                <img
                  src={post.image_url}
                  alt=""
                  className="w-full h-auto max-h-[80vh] object-contain"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <video src={post.image_url} controls className="w-full h-auto max-h-[80vh] bg-black" preload="metadata" />
              )}
            </DialogContent>
          </Dialog>
        )}

        {post.image_url && !isImage && !isVideo && (
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
                <p className="text-sm font-medium truncate">
                  {decodeURIComponent(post.image_url.substring(post.image_url.lastIndexOf("/") + 1).split("?")[0])}
                </p>
                <p className="text-xs text-muted-foreground">Klik untuk mengunduh</p>
              </div>
            </div>
          </a>
        )}

        <div className="mt-4 text-sm text-muted-foreground">
          {post.likes_count} suka • {post.comments_count} komentar
        </div>

        <div className="mt-3 flex justify-around border-t pt-2">
          <Button
            variant="ghost"
            size="sm"
            className={`group flex items-center gap-2 ${userLike ? "text-red-500" : "text-muted-foreground"}`}
            onClick={() => likeMutation.mutate()}
            disabled={likeMutation.isPending}
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
              currentUserProfile={{
                id: currentUserId,
                name: currentUserName,
                avatar_text: currentUserInitials,
              }}
            />
          </div>
        )}
      </div>
    </Card>
  );
};

export const PostCard = React.memo(PostCardBase);