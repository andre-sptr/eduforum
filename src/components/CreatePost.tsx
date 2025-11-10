// src/components/CreatePost.tsx
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
import { Music, X } from "lucide-react";
import { SpotifySearchModal } from "./SpotifySearchModal";
import { Card as UiCard } from "@/components/ui/card";
import { Avatar as UiAvatar, AvatarFallback as UiAvatarFallback, AvatarImage as UiAvatarImage } from "@/components/ui/avatar";

const postSchema = z.object({ content: z.string().trim().min(1, "Post cannot be empty").max(5000, "Post is too long (max 5000 characters)") });

interface CreatePostProps { currentUser:{ id:string; full_name:string; avatar_url?:string }; onPostCreated:()=>void }

const CreatePost = ({ currentUser, onPostCreated }: CreatePostProps) => {
  const [content, setContent] = useState(""); const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
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
    if (mediaFiles.length===0) { try { postSchema.parse({ content }); } catch (e:any){ if (e instanceof z.ZodError) toast.error(e.errors[0].message); return; } }
    else if (!content.trim()) {}
    setLoading(true);
    try {
      const mediaUrls:string[]=[]; const mediaTypes:string[]=[];
      for (const m of mediaFiles) { const url=await uploadMedia(m.file,currentUser.id,m.type); mediaUrls.push(url); mediaTypes.push(m.type); }
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
    <Card className="rounded-2xl border border-border shadow-xl bg-card p-5">
      <div className="flex gap-4">
        <Avatar className="h-12 w-12 ring-1 ring-border">
          <AvatarImage src={currentUser.avatar_url} />
          <AvatarFallback className="bg-primary text-primary-foreground font-semibold">{getInitials(currentUser.full_name)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 space-y-4">
          <MentionInput value={content} onChange={setContent} placeholder="Apa yang Anda pikirkan?" className="min-h-[110px] resize-none rounded-xl bg-input/60 border-border focus-visible:ring-2 focus-visible:ring-accent" multiline currentUserId={currentUser.id} />
          <MediaUploader key={mediaKey} onMediaChange={setMediaFiles} />
          <Button 
            type="button" 
            variant="ghost" 
            size="sm" 
            className="rounded-xl ring-1 ring-border hover:ring-accent/60 gap-2" 
            onClick={() => setShowSpotifySearch(true)}
            disabled={!!spotifyTrack}
          >
            <Music className="h-4 w-4"/> Spotify
          </Button>

          {spotifyTrack && (
            <UiCard className="p-2 flex items-center gap-3 relative">
              <UiAvatar className="h-8 w-8 rounded-sm">
                <UiAvatarImage src={spotifyTrack.albumArtUrl || ""} />
                <UiAvatarFallback><Music className="h-4 w-4" /></UiAvatarFallback>
              </UiAvatar>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{spotifyTrack.trackName}</p>
                <p className="text-xs text-muted-foreground truncate">{spotifyTrack.artistName}</p>
              </div>
              <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSpotifyTrack(null)}>
                <X className="h-4 w-4" />
              </Button>
            </UiCard>
          )}
          <div className="flex items-center justify-end">
            <Button 
              onClick={handleSubmit} 
              disabled={loading || (!content.trim() && mediaFiles.length === 0 && !spotifyTrack)} 
              className="..."
            >
              {loading ? "Memposting..." : "Posting"}
            </Button>
          </div>

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