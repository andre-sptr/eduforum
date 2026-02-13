
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import MediaUploader from "./MediaUploader";
import { MediaFile, DocumentFile, compressImage } from "@/lib/mediaUtils";
import { z } from "zod";
import { MentionInput } from "./MentionInput";
import { Music, X } from "lucide-react";
import { SpotifySearchModal } from "./SpotifySearchModal";
import { Card as UiCard } from "@/components/ui/card";
import { Avatar as UiAvatar, AvatarFallback as UiAvatarFallback, AvatarImage as UiAvatarImage } from "@/components/ui/avatar";

const postSchema = z.object({ content: z.string().trim().min(1, "Post cannot be empty").max(5000, "Post is too long (max 5000 characters)") });

interface CreatePostProps { currentUser:{ id:string; full_name:string; avatar_url?:string }; onPostCreated:()=>void }

const CreatePost = ({ currentUser, onPostCreated }: CreatePostProps) => {
  const [content, setContent] = useState(""); const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [documentFiles, setDocumentFiles] = useState<DocumentFile[]>([]);
  const [loading, setLoading] = useState(false); const [mediaKey, setMediaKey] = useState(0);
  const [showSpotifySearch, setShowSpotifySearch] = useState(false);
  const [spotifyTrack, setSpotifyTrack] = useState<any>(null);

  const getInitials = (n:string) => { const a=n.split(" "); return a.length>=2?`${a[0][0]}${a[1][0]}`.toUpperCase():n.slice(0,2).toUpperCase(); };

  const uploadMedia = async (file:File, userId:string, type:string):Promise<string> => {
    let f=file; if (type==="image") f=await compressImage(file);
    const ext=f.name.split(".").pop(); const name=`${userId}/${Date.now()}.${ext}`;
    const { error:uploadError } = await supabase.storage.from("media").upload(name, f); if (uploadError) throw uploadError;
    const { data:{ publicUrl } } = supabase.storage.from("media").getPublicUrl(name); return publicUrl;
  };

  const handleSubmit = async () => {
    if (mediaFiles.length===0 && documentFiles.length===0) { try { postSchema.parse({ content }); } catch (e:any){ if (e instanceof z.ZodError) toast.error(e.errors[0].message); return; } }
    else if (!content.trim()) {}
    setLoading(true);
    try {
      const mediaUrls:string[]=[]; const mediaTypes:string[]=[];
      for (const m of mediaFiles) { const url=await uploadMedia(m.file,currentUser.id,m.type); mediaUrls.push(url); mediaTypes.push(m.type); }
      for (const d of documentFiles) { const url=await uploadMedia(d.file,currentUser.id,"document"); mediaUrls.push(url); mediaTypes.push("document"); }
      
      const { error } = await supabase.from("posts").insert({
        user_id: currentUser.id,
        content: content.trim() || "",
        media_urls: mediaUrls.length ? mediaUrls : null,
        media_types: mediaTypes.length ? mediaTypes : null,
        spotify_track_id: spotifyTrack?.trackId || null
      });

      if (error) throw error;
      toast.success("Postingan berhasil dibuat!"); 
      setContent(""); 
      setMediaFiles([]); 
      setDocumentFiles([]);
      setSpotifyTrack(null);
      setMediaKey(v => v + 1); 
      onPostCreated();
    } catch (e: any) { 
      toast.error(e.message); 
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <Card className="rounded-3xl border border-white/10 shadow-xl bg-card/40 backdrop-blur-xl p-4 sm:p-6 relative overflow-hidden group">
      {}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

      <div className="flex gap-4 relative z-10">
        <Avatar className="h-12 w-12 ring-2 ring-white/10 shadow-lg">
          <AvatarImage src={currentUser.avatar_url} />
          <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60 text-primary-foreground font-bold">{getInitials(currentUser.full_name)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 space-y-4">
          <div className="relative">
            <MentionInput 
                value={content} 
                onChange={setContent} 
                placeholder="Apa yang Anda pikirkan?" 
                className="min-h-[120px] resize-none rounded-2xl bg-white/5 border-white/10 focus:bg-white/10 focus-visible:ring-1 focus-visible:ring-primary/30 text-base p-4 shadow-inner transition-all placeholder:text-muted-foreground/50" 
                multiline 
                currentUserId={currentUser.id} 
            />
            {content.length > 4000 && (
                <span className={`absolute bottom-2 right-2 text-xs font-medium ${content.length > 5000 ? "text-red-500" : "text-yellow-500"}`}>
                    {content.length}/5000
                </span>
            )}
          </div>

          <div className={spotifyTrack ? "pointer-events-none opacity-50 grayscale transition-all duration-300" : "transition-all duration-300"}>
            <MediaUploader key={mediaKey} onMediaChange={setMediaFiles} onDocumentChange={setDocumentFiles} onSpotifyClick={() => setShowSpotifySearch(true)} />
          </div>
          
          <div className="flex items-center justify-between pt-2">
            <div className="flex gap-2">
            </div>

            <Button 
                onClick={handleSubmit} 
                disabled={loading || (!content.trim() && mediaFiles.length === 0 && documentFiles.length === 0 && !spotifyTrack)} 
                className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 px-6 h-11 font-medium transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {loading ? "Memposting..." : "Posting"}
            </Button>
          </div>

          {spotifyTrack && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <UiCard className="p-2.5 flex items-center gap-3 relative bg-black/20 border-white/5 rounded-xl backdrop-blur-md">
                <UiAvatar className="h-10 w-10 rounded-lg shadow-sm">
                    <UiAvatarImage src={spotifyTrack.albumArtUrl || ""} className="object-cover" />
                    <UiAvatarFallback className="rounded-lg bg-white/10"><Music className="h-5 w-5 text-green-500" /></UiAvatarFallback>
                </UiAvatar>
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold truncate text-foreground/90">{spotifyTrack.trackName}</p>
                    <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        {spotifyTrack.artistName}
                    </p>
                </div>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-white/10 hover:text-red-400 transition-colors" onClick={() => setSpotifyTrack(null)}>
                    <X className="h-4 w-4" />
                </Button>
                </UiCard>
            </div>
          )}

          <SpotifySearchModal
            open={showSpotifySearch}
            onOpenChange={setShowSpotifySearch}
            onSelectTrack={(track) => {
              setSpotifyTrack(track);
              setShowSpotifySearch(false);
            }}
          />
        </div>
      </div>
    </Card>
  );
};

export default CreatePost;