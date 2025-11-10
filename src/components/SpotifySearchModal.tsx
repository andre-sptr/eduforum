// src/components/SpotifySearchModal.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Music } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "./ui/button";

interface Track {
  trackId: string;
  trackName: string;
  artistName: string;
  albumArtUrl: string | null;
}

interface SpotifySearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTrack: (track: Track) => void;
}

export const SpotifySearchModal = ({
  open,
  onOpenChange,
  onSelectTrack,
}: SpotifySearchModalProps) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Track[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setIsSearching(false);
    }
  }, [open]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (query.trim().length > 2) {
        searchTracks();
      } else {
        setResults([]);
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [query]);

  const searchTracks = async () => {
    setIsSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke("spotify-search", {
        body: { query },
      });
      if (error) throw new Error(error.message);
      setResults(data || []);
    } catch (e: any) {
      toast.error("Gagal mencari lagu: " + e.message);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle>Cari Lagu Spotify</DialogTitle>
          <DialogDescription>
            Cari judul lagu atau artis untuk ditambahkan ke postingan Anda.
          </DialogDescription>
        </DialogHeader>
        <Input
          placeholder="Ketik judul lagu atau artis..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="bg-input/60 border-border"
        />
        <ScrollArea className="h-64 pr-3">
          <div className="space-y-2">
            {isSearching && (
              <div className="flex justify-center items-center py-4">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}
            {!isSearching && results.length === 0 && query.length > 2 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Tidak ada hasil ditemukan.
              </p>
            )}
            {results.map((track) => (
              <button
                key={track.trackId}
                onClick={() => onSelectTrack(track)}
                className="flex items-center w-full gap-3 p-2 rounded-lg text-left hover:bg-muted/50 transition"
              >
                <Avatar className="h-10 w-10 rounded-md">
                  <AvatarImage src={track.albumArtUrl || ""} />
                  <Music className="h-4 w-4" />
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {track.trackName}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {track.artistName}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};