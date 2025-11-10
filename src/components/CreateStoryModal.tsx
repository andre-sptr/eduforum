import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MediaFile, compressImage, getMediaType, validateMediaFile, maxSizeLabel } from "@/lib/mediaUtils";
import { toast } from "sonner";
import { Loader2, Send, X, ArrowLeft, FileImage, Music } from "lucide-react";
import { z } from "zod";

const storySchema = z.object({
  media: z.object({}).nullable().refine(val => val !== null, "Media story tidak boleh kosong"),
  content: z.string().max(1000, "Caption terlalu panjang (maks 1000 karakter)").optional(),
});

interface CreateStoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser: { id: string; full_name: string; avatar_url?: string };
  onStoryCreated: () => void;
}

export const CreateStoryModal = ({ open, onOpenChange, currentUser, onStoryCreated }: CreateStoryModalProps) => {
  const [mediaFile, setMediaFile] = useState<MediaFile | null>(null);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setMediaFile(null);
      setContent("");
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [open]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const type = getMediaType(file);
    if (!type) {
      toast.error(`File ${file.name} bukan tipe media yang valid (gambar, video, audio).`);
      return;
    }

    if (!validateMediaFile(file, type)) {
      toast.error(`File ${file.name} terlalu besar (Maks: ${maxSizeLabel(type)}).`);
      return;
    }

    setMediaFile({
      file: file,
      preview: URL.createObjectURL(file),
      type: type,
    });
  };

  const uploadMedia = async (file: File, userId: string, type: string): Promise<string> => {
    let f = file;
    if (type === "image") f = await compressImage(file); 

    const ext = f.name.split(".").pop();
    const name = `${userId}/stories/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("media").upload(name, f);
    if (uploadError) throw uploadError;
    const { data: { publicUrl } } = supabase.storage.from("media").getPublicUrl(name);
    return publicUrl;
  };

  const handleSubmit = async () => {
    try {
      storySchema.parse({ media: mediaFile, content });
    } catch (e: any) {
      if (e instanceof z.ZodError) toast.error(e.errors[0].message);
      return;
    }

    if (!mediaFile) return;

    setLoading(true);
    try {
      const mediaUrl = await uploadMedia(mediaFile.file, currentUser.id, mediaFile.type);
      
      const { error } = await supabase.from("stories").insert({
        user_id: currentUser.id,
        media_url: mediaUrl,
        media_type: mediaFile.type,
        content: content.trim() || null,
      });

      if (error) throw error;

      toast.success("Story berhasil diposting!");
      onOpenChange(false);
      onStoryCreated();
    } catch (e: any) {
      toast.error("Gagal memposting story: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <div className="relative h-full w-full max-w-md max-h-[95vh] aspect-[9/16] bg-black rounded-2xl overflow-hidden shadow-2xl flex flex-col">
        
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4 z-20 rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white transition-all"
          onClick={() => onOpenChange(false)}
          disabled={loading}
        >
          <X className="h-6 w-6" />
        </Button>

        {!mediaFile && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
            <h2 className="text-2xl font-semibold text-center text-white">Buat Story Baru</h2>
            <div className="w-40 h-40 rounded-2xl border-4 border-dashed border-border flex items-center justify-center">
              <FileImage className="h-16 w-16 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Pilih foto, video, atau audio dari perangkat Anda.
            </p>
            <Button
              size="lg"
              className="w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => fileInputRef.current?.click()}
            >
              Pilih File
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*,audio/*"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
        )}

        {mediaFile && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 left-4 z-20 rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white transition-all"
              onClick={() => setMediaFile(null)}
              disabled={loading}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            
            {(mediaFile.type === 'image' || mediaFile.type === 'video') && (
              <div
                className="absolute inset-0 bg-cover bg-center filter blur-xl scale-110 opacity-50"
                style={{ backgroundImage: `url(${mediaFile.preview})` }}
              />
            )}
            {mediaFile.type === 'video' && (
              <video
                src={mediaFile.preview}
                className="absolute inset-0 object-cover filter blur-xl scale-110 opacity-50"
                playsInline muted loop autoPlay
              />
            )}

            <div
              className="absolute inset-0 flex items-center justify-center overflow-hidden"
            >
              {mediaFile.type === 'image' && (
                <img 
                  src={mediaFile.preview} 
                  className="w-full h-full object-contain" 
                  alt="Story preview"
                />
              )}
              {mediaFile.type === 'video' && (
                <video src={mediaFile.preview} className="w-full h-full object-contain" playsInline controls />
              )}
              {mediaFile.type === 'audio' && (
                <div className="flex flex-col items-center justify-center p-8 gap-4">
                  <div className="w-40 h-40 rounded-2xl bg-black/30 border border-white/20 flex items-center justify-center">
                    <Music className="h-16 w-16 text-white/80" />
                  </div>
                  <audio src={mediaFile.preview} controls className="w-full" />
                </div>
              )}
            </div>

            <div className="absolute bottom-0 left-0 right-0 z-10 p-4 space-y-3 bg-gradient-to-t from-black/70 to-transparent">
              
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Tulis caption..."
                className="min-h-[80px] bg-black/30 border-white/20 text-white placeholder:text-white/60 rounded-xl resize-none"
                disabled={loading}
              />
              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full h-12 rounded-xl bg-primary text-primary-foreground text-base font-bold hover:bg-primary/90"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Send className="h-5 w-5 mr-2" />
                    Posting ke Story Anda
                  </>
                )}
              </Button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}; 