import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Send, Image, Paperclip, X, FileText } from "lucide-react"; 
import { UserAvatar } from "./UserAvatar";
import { useState, useRef, ChangeEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface CreatePostProps {
  userName: string;
  userInitials: string;
}

export const CreatePost = ({ userName, userInitials }: CreatePostProps) => {
  const [content, setContent] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    const MAX_FILE_SIZE_MB = 15;

    const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024; 

    if (file) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast.error(`Ukuran file maksimal adalah ${MAX_FILE_SIZE_MB} MB.`); 
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        setSelectedFile(null);
        setPreviewUrl(null);
        return;
      }
      setSelectedFile(file);
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        setPreviewUrl(URL.createObjectURL(file));
      } else {
        setPreviewUrl(null);
      }
    } else {
      setSelectedFile(null);
      setPreviewUrl(null);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const clearFileSelection = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = ""; 
    }
  };

  const createPostMutation = useMutation({
    mutationFn: async ({ content, file }: { content: string, file: File | null }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Login dulu");

      let mediaUrl: string | null = null;

      if (file) {
        const fileExt = file.name.split('.').pop();
        const filePath = `${user.id}/${Date.now()}.${fileExt}`;
        
        toast.info("Mengupload media...");

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('post_media')
          .upload(filePath, file);

        if (uploadError) {
          toast.error(`Gagal mengupload: ${uploadError.message}`);
          throw new Error(uploadError.message);
        }

        const { data: urlData } = supabase.storage
          .from('post_media')
          .getPublicUrl(uploadData.path);
        
        mediaUrl = urlData.publicUrl;
      }

      const { error: insertError } = await supabase.from("posts").insert({ 
        user_id: user.id, 
        content: content || null, 
        image_url: mediaUrl 
      });

      if (insertError) {
        if (mediaUrl && file) {
            const filePath = mediaUrl.substring(mediaUrl.lastIndexOf('/') + 1); 
            await supabase.storage.from('post_media').remove([`${user.id}/${filePath}`]); 
        }
        toast.error(`Gagal membuat post: ${insertError.message}`);
        throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      setContent("");
      clearFileSelection(); 
      toast.success("Postingan dibuat!");
    },
    onError: (error) => {
      console.error("Mutation error:", error);
    }
  });

  const handlePostSubmit = () => {
    if (content.trim() || selectedFile) {
      createPostMutation.mutate({ content: content.trim(), file: selectedFile });
    } else {
        toast.warning("Tulis sesuatu atau pilih file untuk diposting.");
    }
  };

  return (
    <Card className="p-4 shadow-sm">
      <div className="flex gap-3">
        <UserAvatar name={userName} initials={userInitials} />
        <div className="flex-1">
          <Textarea 
            value={content} 
            onChange={(e) => setContent(e.target.value)} 
            placeholder=" Apa yang ingin kamu bagikan?" 
            className="min-h-[80px] border-0 p-0 text-base shadow-none focus-visible:ring-0" 
          />

          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
            accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" 
          />

          {selectedFile && ( 
            <div className="mt-3 relative w-fit">
              {selectedFile.type.startsWith('image/') && previewUrl && (
                <img src={previewUrl} alt="Image Preview" className="max-h-40 rounded-lg border" />
              )}
              {selectedFile.type.startsWith('video/') && previewUrl && (
                <video src={previewUrl} controls className="max-h-40 rounded-lg border bg-black"> 
                  Preview video tidak didukung.
                </video>
              )}
              {!selectedFile.type.startsWith('image/') && !selectedFile.type.startsWith('video/') && (
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
                aria-label="Hapus Pilihan File"
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
                className="text-primary" 
                onClick={triggerFileInput} 
                aria-label="Upload Dokumen"
                disabled={createPostMutation.isPending} 
              >
                <Paperclip className="h-5 w-5" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-primary" 
                onClick={triggerFileInput} 
                aria-label="Upload Gambar/Video"
                disabled={createPostMutation.isPending}
              >
                <Image className="h-5 w-5" />
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