import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import MediaUploader from "./MediaUploader";
import { MediaFile, compressImage } from "@/lib/mediaUtils";
import { z } from "zod";
import { MentionInput } from "./MentionInput";

// Input validation schema
const postSchema = z.object({
  content: z.string().trim().min(1, "Post cannot be empty").max(5000, "Post is too long (max 5000 characters)"),
});

interface CreatePostProps {
  currentUser: {
    id: string;
    full_name: string;
    avatar_url?: string;
  };
  onPostCreated: () => void;
}

const CreatePost = ({ currentUser, onPostCreated }: CreatePostProps) => {
  const [content, setContent] = useState("");
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [mediaKey, setMediaKey] = useState(0);

  const getInitials = (name: string) => {
    const names = name.split(" ");
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const uploadMedia = async (file: File, userId: string, type: string): Promise<string> => {
    let fileToUpload = file;

    // Compress images
    if (type === 'image') {
      fileToUpload = await compressImage(file);
    }

    const fileExt = fileToUpload.name.split('.').pop();
    const fileName = `${userId}/${Date.now()}.${fileExt}`;

    const { error: uploadError, data } = await supabase.storage
      .from('media')
      .upload(fileName, fileToUpload);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('media')
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const handleSubmit = async () => {
    if (mediaFiles.length === 0) {
      // Validate content only if no media files
      try {
        postSchema.parse({ content });
      } catch (error) {
        if (error instanceof z.ZodError) {
          toast.error(error.errors[0].message);
        }
        return;
      }
    } else if (!content.trim()) {
      // Allow empty content if media is provided
    }

    setLoading(true);

    try {
      const mediaUrls: string[] = [];
      const mediaTypes: string[] = [];

      // Upload all media files
      for (const media of mediaFiles) {
        const url = await uploadMedia(media.file, currentUser.id, media.type);
        mediaUrls.push(url);
        mediaTypes.push(media.type);
      }

      const { error } = await supabase.from("posts").insert({
        user_id: currentUser.id,
        content: content.trim() || "",
        media_urls: mediaUrls.length > 0 ? mediaUrls : null,
        media_types: mediaTypes.length > 0 ? mediaTypes : null,
      });

      if (error) throw error;

      toast.success("Postingan berhasil dibuat!");
      setContent("");
      setMediaFiles([]);
      setMediaKey(prev => prev + 1); // Force MediaUploader to remount and clear previews
      onPostCreated();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-card border-border p-6">
      <div className="flex gap-4">
        <Avatar className="h-12 w-12 border-2 border-accent/20">
          <AvatarImage src={currentUser.avatar_url} />
          <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
            {getInitials(currentUser.full_name)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1">
          <MentionInput
            value={content}
            onChange={setContent}
            placeholder="Apa yang Anda pikirkan? (gunakan @ untuk mention)"
            className="min-h-[100px] resize-none mb-4"
            multiline
            currentUserId={currentUser.id}
          />

          <MediaUploader key={mediaKey} onMediaChange={setMediaFiles} />

          <div className="flex items-center justify-end">
            <Button
              onClick={handleSubmit}
              disabled={loading || (!content.trim() && mediaFiles.length === 0)}
              className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-[var(--shadow-gold)]"
            >
              {loading ? "Memposting..." : "Posting"}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default CreatePost;
