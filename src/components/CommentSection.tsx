import React, { useState, useRef, ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "./UserAvatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send, MoreHorizontal, Trash2, Image as ImageIcon, X, Heart } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

interface Comment {
  id: string;
  user_id: string;
  content: string | null;
  image_url: string | null;
  created_at: string;
  likes_count: number;
  profiles: { name: string; avatar_text: string };
}

interface CommentSectionProps {
  postId: string;
  currentUserName?: string;
  currentUserInitials?: string;
  currentUserId: string;
}

interface CommentItemProps {
  comment: Comment;
  currentUserId: string;
  postId: string;
}

const CommentItem = ({ comment, currentUserId, postId }: CommentItemProps) => {
  const queryClient = useQueryClient();
  const isCommentAuthor = comment.user_id === currentUserId;

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const { data: commentData } = await supabase.from('comments').select('image_url').eq('id', commentId).single();
      const { error } = await supabase.from('comments').delete().eq('id', commentId);
      if (error) throw new Error(error.message);
      
      if (commentData?.image_url) {
         try {
           const urlParts = commentData.image_url.split('/');
           const fileName = urlParts.pop();
           const folderPath = urlParts.slice(urlParts.indexOf('comments')).join('/');
           if (folderPath && fileName) {
             await supabase.storage.from('post_media').remove([`${folderPath}/${fileName}`]);
           }
         } catch(storageError){
           console.error("Gagal menghapus gambar dari storage:", storageError);
         }
      }
    },
    onSuccess: () => {
      toast.success("Komentar dihapus.");
      queryClient.invalidateQueries({ queryKey: ['comments', postId] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
    onError: (error) => {
      toast.error(`Gagal menghapus: ${error.message}`);
    }
  });

  const { data: userLike } = useQuery({
    queryKey: ['userCommentLike', comment.id, currentUserId],
    queryFn: async () => {
      const { data } = await supabase.from("comment_likes").select("id").eq("comment_id", comment.id).eq("user_id", currentUserId).maybeSingle();
      return data;
    },
    enabled: !!currentUserId
  });

  const likeCommentMutation = useMutation({
    mutationFn: async () => {
      if (!currentUserId) throw new Error("Login dulu");
      
      if (userLike) {
        await supabase.from("comment_likes").delete().eq("comment_id", comment.id).eq("user_id", currentUserId);
      } else {
        await supabase.from("comment_likes").insert({ comment_id: comment.id, user_id: currentUserId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userCommentLike', comment.id, currentUserId] });
      queryClient.invalidateQueries({ queryKey: ['comments', postId] });
    },
    onError: (error) => {
      toast.error(`Error: ${(error as Error).message}`);
    }
  });

  const formatTime = (t: string | null | undefined): string => { 
    if (!t) return 'Beberapa saat lalu';
    try {
      const dateObj = new Date(t);
      if (isNaN(dateObj.getTime())) return 'Waktu tidak valid';
      const diff = Date.now() - dateObj.getTime();
      if (diff < 0) return "Baru saja";
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return "Baru saja";
      if (mins < 60) return `${mins} menit lalu`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs} jam lalu`;
      return `${Math.floor(hrs / 24)} hari lalu`;
    } catch (error) {
      console.error("Error formatting time:", error, "Input was:", t);
      return 'Error waktu';
    }
  };

  return (
    <div className="flex gap-2">
      <UserAvatar name={comment.profiles.name} initials={comment.profiles.avatar_text} size="sm" />
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">{comment.profiles.name}</p>
            {isCommentAuthor && <Badge variant="secondary" className="px-1.5 py-0 text-xs font-medium h-fit"> Saya </Badge>}
            <span className="text-xs text-muted-foreground">{formatTime(comment.created_at)}</span>
          </div>

          {isCommentAuthor && (
            <AlertDialog>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0 text-muted-foreground hover:text-foreground">
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem
                      className="flex gap-2 items-center text-red-500 focus:text-red-500 cursor-pointer px-2 py-1.5"
                      onSelect={(e) => e.preventDefault()}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="text-sm">Hapus Komentar</span>
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                </DropdownMenuContent>
              </DropdownMenu>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Anda yakin?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tindakan ini tidak dapat dibatalkan dan akan menghapus komentar Anda.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Batal</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-red-500 hover:bg-red-600"
                    onClick={() => deleteCommentMutation.mutate(comment.id)}
                    disabled={deleteCommentMutation.isPending}
                  >
                    {deleteCommentMutation.isPending ? "Menghapus..." : "Ya, Hapus"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        {comment.content && <p className="text-sm mt-1 whitespace-pre-wrap break-all">{comment.content}</p>}

        {comment.image_url && (
          <Dialog>
            <DialogTrigger asChild>
              <img
                src={comment.image_url}
                alt="Gambar komentar"
                className="mt-2 max-h-32 max-w-[200px] rounded-md border cursor-pointer object-cover"
              />
            </DialogTrigger>
            <DialogContent className="max-w-xl p-0 border-0">
              <img
                src={comment.image_url}
                alt="Gambar komentar full size"
                className="w-full h-auto max-h-[80vh] object-contain"
              />
            </DialogContent>
          </Dialog>
        )}
        
        <div className="mt-1 flex items-center">
            <Button
                variant="ghost"
                size="sm"
                className={`group flex items-center gap-1 p-1 h-auto text-xs ${userLike ? "text-red-500" : "text-muted-foreground"}`}
                onClick={() => likeCommentMutation.mutate()}
                disabled={likeCommentMutation.isPending}
            >
                <Heart className={`h-3.5 w-3.5 ${userLike ? "fill-current" : ""} ${!userLike ? "group-hover:text-red-500" : ""}`} />
                <span className={!userLike ? "group-hover:text-red-500" : ""}>
                    {comment.likes_count}
                </span>
            </Button>
        </div>
      </div>
    </div>
  );
};

export const CommentSection = ({ postId, currentUserName, currentUserInitials, currentUserId }: CommentSectionProps) => {
  const [commentText, setCommentText] = useState("");
  const [commentImageFile, setCommentImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: comments = [], isLoading } = useQuery<Comment[]>({
    queryKey: ["comments", postId],
    queryFn: async () => {
      const { data, error } = await supabase.from("comments").select("id, user_id, content, image_url, created_at, likes_count, profiles(name, avatar_text)").eq("post_id", postId).order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const MAX_SIZE_MB = 5;
    const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

    if (file) {
      if (!file.type.startsWith('image/')) {
         toast.error("Hanya file gambar yang diizinkan.");
         if (imageInputRef.current) imageInputRef.current.value = "";
         return;
      }
      if (file.size > MAX_SIZE_BYTES) {
        toast.error(`Ukuran gambar maksimal ${MAX_SIZE_MB} MB.`);
        if (imageInputRef.current) imageInputRef.current.value = "";
        setCommentImageFile(null);
        setImagePreviewUrl(null);
        return;
      }
      setCommentImageFile(file);
      setImagePreviewUrl(URL.createObjectURL(file));
    } else {
      setCommentImageFile(null);
      setImagePreviewUrl(null);
    }
  };

  const triggerImageInput = () => imageInputRef.current?.click();

  const clearImageSelection = () => {
    setCommentImageFile(null);
    setImagePreviewUrl(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const addCommentMutation = useMutation({
    mutationFn: async ({ text, file }: { text: string, file: File | null }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Login dulu ya");

      let imageUrl: string | null = null;
      let filePath: string | null = null;

      if (file) {
        const fileExt = file.name.split('.').pop();
        filePath = `comments/${postId}/${user.id}_${Date.now()}.${fileExt}`;
        toast.info("Mengupload gambar...");
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('post_media')
          .upload(filePath, file);

        if (uploadError) throw new Error(uploadError.message);

        const { data: urlData } = supabase.storage
          .from('post_media')
          .getPublicUrl(uploadData.path);
        imageUrl = urlData.publicUrl;
      }

      if (!text && !imageUrl) throw new Error("Komentar tidak boleh kosong");

      const { error: insertError } = await supabase
        .from("comments")
        .insert({
            post_id: postId,
            user_id: user.id,
            content: text || null,
            image_url: imageUrl
        });

      if (insertError) {
        if (imageUrl && file && filePath) {
          await supabase.storage.from('post_media').remove([filePath]);
        }
        throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", postId] });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      setCommentText("");
      clearImageSelection();
      toast.success("Komentar ditambahkan!");
    },
    onError: (error) => { 
       toast.error(`Gagal menambah komentar: ${(error as Error).message}`);
    }
  });

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = commentText.trim();
    if (text || commentImageFile) {
      addCommentMutation.mutate({ text, file: commentImageFile });
    }
  };

  return (
    <div className="space-y-3">
      {isLoading && <p className="text-sm text-muted-foreground text-center">Memuat komentar...</p>}

      {!isLoading && comments.length > 0 && (
        <div className="space-y-3 border-t pt-3">
          {comments.map((c, index) => (
            <div key={c.id} className={`flex gap-2 ${index > 0 ? 'border-t pt-3' : ''}`}>
                <CommentItem
                    comment={c}
                    currentUserId={currentUserId}
                    postId={postId}
                />
            </div>
          ))}
        </div>
      )}

      {currentUserName && (
        <form onSubmit={handleCommentSubmit} className="border-t pt-3 space-y-2">
          {imagePreviewUrl && (
             <div className="relative w-fit">
               <img src={imagePreviewUrl} alt="Preview" className="max-h-24 rounded border" />
               <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 h-5 w-5 rounded-full z-10 p-0" onClick={clearImageSelection} aria-label="Hapus Gambar"> <X className="h-3 w-3" /> </Button>
             </div>
          )}

          <div className="flex gap-2 items-center">
            <UserAvatar name={currentUserName} initials={currentUserInitials!} size="sm" />
            <input type="file" ref={imageInputRef} onChange={handleImageChange} className="hidden" accept="image/*" />

            <Button variant="ghost" size="icon" type="button" onClick={triggerImageInput} disabled={addCommentMutation.isPending} className="text-muted-foreground">
                <ImageIcon className="h-5 w-5"/>
            </Button>

            <Input value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Tulis komentar..." className="flex-1" />

            <Button
                type="submit"
                size="icon"
                disabled={addCommentMutation.isPending || (!commentText.trim() && !commentImageFile)}
            >
                <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
      )}
    </div>
  );
};

export default CommentSection;