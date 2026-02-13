
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Music, Plus } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIsMobile } from "@/hooks/use-mobile";

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
  const isMobile = useIsMobile();

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

  const Content = (
    <>
      <div className="relative mt-2">
        <Input
          placeholder="Ketik judul lagu atau artis..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10 h-11 bg-black/20 border-white/10 rounded-xl focus:bg-black/30 transition-all placeholder:text-muted-foreground/50"
        />
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50">
          <Music className="h-4 w-4" />
        </div>
      </div>

      <ScrollArea className={isMobile ? "h-[50vh] mt-4" : "h-72 pr-3 -mr-3"}>
        <div className="space-y-2 mt-2">
          {isSearching && (
            <div className="flex flex-col justify-center items-center py-8 gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-green-500" />
              <span className="text-xs font-medium animate-pulse">Mencari lagu...</span>
            </div>
          )}
          
          {!isSearching && results.length === 0 && query.length > 2 && (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
              <div className="h-12 w-12 rounded-full bg-white/5 flex items-center justify-center">
                  <Music className="h-6 w-6 opacity-30" />
              </div>
              <p className="text-sm font-medium">Tidak ada hasil ditemukan.</p>
            </div>
          )}
          
          {results.map((track) => (
            <button
              key={track.trackId}
              onClick={() => onSelectTrack(track)}
              className="group flex items-center w-full gap-4 p-3 rounded-2xl text-left hover:bg-white/5 border border-transparent hover:border-white/5 transition-all"
            >
              <div className="relative h-12 w-12 flex-shrink-0">
                  <Avatar className="h-12 w-12 rounded-xl shadow-md group-hover:scale-105 transition-transform duration-300">
                  <AvatarImage src={track.albumArtUrl || ""} className="object-cover" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                      <Plus className="h-5 w-5 text-white" />
                  </div>
                  </Avatar>
              </div>
              
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-sm font-bold truncate text-foreground/90 group-hover:text-green-400 transition-colors">
                  {track.trackName}
                </p>
                <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500/50" />
                  {track.artistName}
                </p>
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="bg-card/95 backdrop-blur-xl border-t border-white/10 rounded-t-[20px]">
          <DrawerHeader className="text-left">
            <DrawerTitle className="text-xl font-bold bg-gradient-to-r from-green-400 to-green-600 bg-clip-text text-transparent flex items-center gap-2">
              <Music className="h-5 w-5 text-green-500" />
              Cari Lagu Spotify
            </DrawerTitle>
            <DrawerDescription className="text-muted-foreground">
            </DrawerDescription>
          </DrawerHeader>
          <div className="p-4 pt-0">
            {Content}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-xl border-white/10 rounded-3xl shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold bg-gradient-to-r from-green-400 to-green-600 bg-clip-text text-transparent flex items-center gap-2">
            <Music className="h-5 w-5 text-green-500" />
            Cari Lagu Spotify
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
          </DialogDescription>
        </DialogHeader>
        {Content}
      </DialogContent>
    </Dialog>
  );
};