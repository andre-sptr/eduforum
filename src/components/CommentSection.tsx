import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "./UserAvatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send, MoreHorizontal, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Comment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles: { name: string; avatar_text: string };
}

interface CommentSectionProps {
  postId: string;
  currentUserName?: string;
  currentUserInitials?: string;
  currentUserId: string; 
}

export const CommentSection = ({ postId, currentUserName, currentUserInitials, currentUserId }: CommentSectionProps) => {
  const [commentText, setCommentText] = useState("");
  const queryClient = useQueryClient();

  const { data: comments = [], isLoading } = useQuery<Comment[]>({ 
    queryKey: ["comments", postId],
    queryFn: async () => {
      const { data, error } = await supabase.from("comments").select("id, user_id, content, created_at, profiles(name, avatar_text)").eq("post_id", postId).order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async (text: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Login dulu ya");
      const { error } = await supabase.from("comments").insert({ post_id: postId, user_id: user.id, content: text });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", postId] });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      setCommentText("");
      toast.success("Komentar ditambahkan!");
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase.from('comments').delete().eq('id', commentId);
      if (error) throw new Error(error.message);
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

  const formatTime = (t: string) => {
    const diff = Date.now() - new Date(t).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Baru saja";
    if (mins < 60) return `${mins} menit lalu`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} jam lalu`;
    return `${Math.floor(hrs / 24)} hari lalu`;
  };

  return (
    <div className="space-y-3">
      {isLoading && <p className="text-sm text-muted-foreground text-center">Memuat komentar...</p>}
      
      {!isLoading && comments.length > 0 && (
        <div className="space-y-3 border-t pt-3">
          {comments.map((c, index) => {
            const isCommentAuthor = c.user_id === currentUserId;

            return (
              <div 
                  key={c.id} 
                  className={`flex gap-2 ${index > 0 ? 'border-t pt-3' : ''}`} 
                > 
                <UserAvatar name={c.profiles.name} initials={c.profiles.avatar_text} size="sm" />
                <div className="flex-1">
                  <div className="flex items-center justify-between"> 
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{c.profiles.name}</p>
                      {isCommentAuthor && (
                        <Badge variant="secondary" className="px-1.5 py-0 text-xs font-medium h-fit">
                          Saya
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground">{formatTime(c.created_at)}</p>
                      {isCommentAuthor && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0 text-muted-foreground hover:text-foreground">
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              className="flex gap-2 items-center text-red-500 focus:text-red-500 cursor-pointer px-2 py-1.5"
                              onClick={() => deleteCommentMutation.mutate(c.id)}
                              disabled={deleteCommentMutation.isPending}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span className="text-sm">{deleteCommentMutation.isPending ? "Menghapus..." : "Hapus Komentar"}</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>

                  <p className="text-sm mt-1">{c.content}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {currentUserName && (
        <form onSubmit={(e) => { e.preventDefault(); if (commentText.trim()) addCommentMutation.mutate(commentText.trim()); }} className="flex gap-2 border-t pt-3">
          <UserAvatar name={currentUserName} initials={currentUserInitials!} size="sm" />
          <Input value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Tulis komentar..." className="flex-1" />
          <Button type="submit" size="icon" disabled={addCommentMutation.isPending || commentText.trim().length === 0}><Send className="h-4 w-4" /></Button>
        </form>
      )}
    </div>
  );
};