// CreatePost.tsx
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Send, Image, Paperclip, X, FileText, Volume2 } from "lucide-react";
import { UserAvatar } from "./UserAvatar";
import { useState, useRef, ChangeEvent, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

interface CreatePostProps {
  userName: string;
  userInitials: string;
}

type SuggestedUser = { id: string; name: string; avatar_text: string; role: string };

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;

export const CreatePost = ({ userName, userInitials }: CreatePostProps): JSX.Element => {
  const [content, setContent] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const imageVideoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const [activeMention, setActiveMention] = useState<string | null>(null);
  const { user } = useAuth();

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setSelectedFile(null);
      setPreviewUrl(null);
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error("Ukuran file maksimal adalah 15 MB.");
      event.target.value = "";
      setSelectedFile(null);
      setPreviewUrl(null);
      return;
    }
    setSelectedFile(file);
    if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setPreviewUrl(null);
    }
  };

  const triggerImageVideoInput = () => imageVideoInputRef.current?.click();
  const triggerAudioInput = () => audioInputRef.current?.click();
  const triggerDocInput = () => docInputRef.current?.click();

  const clearFileSelection = () => {
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (imageVideoInputRef.current) imageVideoInputRef.current.value = "";
    if (audioInputRef.current) audioInputRef.current.value = "";
    if (docInputRef.current) docInputRef.current.value = "";
  };

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const createPostMutation = useMutation({
    mutationFn: async ({ content, file }: { content: string; file: File | null }) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Login dulu");

      let mediaUrl: string | null = null;
      let filePath: string | null = null;

      if (file) {
        const extFromName = file.name.includes(".") ? file.name.split(".").pop() : "";
        const extFromType = file.type.split("/")[1] || "";
        const ext = (extFromName || extFromType || "bin").replace(/[^\w]+/g, "");
        filePath = `${auth.user.id}/${Date.now()}.${ext}`;
        toast.info("Mengupload media...");
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("post_media")
          .upload(filePath, file);
        if (uploadError) throw new Error(uploadError.message);
        const { data: urlData } = supabase.storage.from("post_media").getPublicUrl(uploadData.path);
        mediaUrl = urlData.publicUrl;
      }

      let taggedUserIds: string[] = [];
      const rawNames = Array.from(
        new Set((content.match(/@([\p{L}\p{N}_][\p{L}\p{N}_\s]{1,99})/giu) || []).map((m) => m.slice(1).trim()))
      );
      if (rawNames.length > 0) {
        const ors = rawNames.map((n) => `name.ilike.%${n}%`).join(",");
        const { data: mentionedUsers } = await supabase.from("profiles").select("id,name").or(ors);
        taggedUserIds = (mentionedUsers || []).map((u) => u.id);
      }

      const { data: inserted, error: insertError } = await supabase
        .from("posts")
        .insert({
          user_id: auth.user.id,
          content: content || null,
          image_url: mediaUrl,
          tagged_user_ids: taggedUserIds.length ? taggedUserIds : null,
        })
        .select("id")
        .single();

      if (insertError) {
        if (filePath) await supabase.storage.from("post_media").remove([filePath]);
        throw new Error(insertError.message);
      }

      if (taggedUserIds.length > 0) {
        const notifications = taggedUserIds
          .filter((id) => id !== auth.user!.id)
          .map((uid) => ({ user_id: uid, actor_id: auth.user!.id, type: "mention", post_id: inserted.id }));
        if (notifications.length) await supabase.from("notifications").insert(notifications);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      setContent("");
      clearFileSelection();
      toast.success("Postingan dibuat!");
    },
    onError: (error: any) => {
      toast.error(`Terjadi kesalahan: ${error.message}`);
    },
  });

  const handlePostSubmit = () => {
    if (content.trim() || selectedFile) {
      createPostMutation.mutate({ content: content.trim(), file: selectedFile });
    } else {
      toast.warning("Tulis sesuatu atau pilih file untuk diposting.");
    }
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);
    const m = val.match(/@([\p{L}\p{N}_]{2,})$/u);
    if (m && m[1]) setActiveMention(m[1]);
    else setActiveMention(null);
  };

  const { data: suggestedUsers = [], isLoading: isSearching } = useQuery<SuggestedUser[]>({
    queryKey: ["suggestedUsers", activeMention, user?.id],
    enabled: !!activeMention && activeMention.length > 1 && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, avatar_text, role")
        .ilike("name", `${activeMention}%`)
        .neq("id", user!.id)
        .limit(5);
      if (error) throw error;
      return data || [];
    },
    staleTime: 0,
  });

  return (
    <Card className="p-4 shadow-sm">
      <div className="flex gap-3">
        <UserAvatar name={userName} initials={userInitials} />
        <div className="flex-1">
          <Textarea
            value={content}
            onChange={handleContentChange}
            placeholder=" Apa yang ingin kamu bagikan? Gunakan @ untuk mention teman."
            className="min-h-[80px] border-0 p-0 text-base shadow-none focus-visible:ring-0"
          />

          {activeMention && (
            <div className="absolute z-20 w-1/2 mt-1 bg-card border rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {isSearching && <p className="p-2 text-xs text-muted-foreground">Mencari...</p>}
              {suggestedUsers.length === 0 && !isSearching && activeMention.length > 1 && (
                <p className="p-2 text-xs text-muted-foreground">Tidak ada saran ditemukan.</p>
              )}
              {suggestedUsers.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center gap-2 p-2 hover:bg-muted cursor-pointer"
                  onClick={() => {
                    const replaced = content.replace(new RegExp(`@${activeMention}$`), `@${u.name} `);
                    setContent(replaced);
                    setActiveMention(null);
                  }}
                >
                  <UserAvatar name={u.name} initials={u.avatar_text} size="xs" />
                  <span className="text-sm font-medium">{u.name}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{u.role}</span>
                </div>
              ))}
            </div>
          )}

          <input type="file" ref={imageVideoInputRef} onChange={handleFileChange} className="hidden" accept="image/*,video/*" />
          <input type="file" ref={audioInputRef} onChange={handleFileChange} className="hidden" accept="audio/*" />
          <input
            type="file"
            ref={docInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
          />

          {selectedFile && (
            <div className="mt-3 relative w-fit">
              {selectedFile.type.startsWith("image/") && previewUrl && (
                <img src={previewUrl} alt="Preview" className="max-h-40 rounded-lg border" />
              )}
              {selectedFile.type.startsWith("video/") && previewUrl && (
                <video src={previewUrl} controls className="max-h-40 rounded-lg border bg-black" />
              )}
              {!selectedFile.type.startsWith("image/") && !selectedFile.type.startsWith("video/") && (
                <div className="border rounded-md p-2 flex items-center gap-2 text-sm bg-muted max-w-xs">
                  <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <span className="truncate">{selectedFile.name}</span>
                </div>
              )}
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-1 right-1 h-6 w-6 rounded-full z-10"
                onClick={clearFileSelection}
                aria-label="Hapus"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="mt-4 flex justify-between items-center">
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-primary"
                onClick={triggerDocInput}
                aria-label="Upload Dokumen"
                disabled={createPostMutation.isPending}
              >
                <Paperclip className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-primary"
                onClick={triggerImageVideoInput}
                aria-label="Upload Gambar/Video"
                disabled={createPostMutation.isPending}
              >
                <Image className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-primary"
                onClick={triggerAudioInput}
                aria-label="Upload Audio"
                disabled={createPostMutation.isPending}
              >
                <Volume2 className="h-5 w-5" />
              </Button>
            </div>
            <Button
              size="sm"
              onClick={handlePostSubmit}
              disabled={createPostMutation.isPending || (!content.trim() && !selectedFile)}
            >
              <Send className="h-4 w-4 mr-2" />
              {createPostMutation.isPending ? "Posting..." : "Posting"}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};