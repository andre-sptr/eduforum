import { useState, useEffect } from "react";
import { toast } from "sonner";

export interface Game {
  id: string;
  title: string;
  description: string;
  category: "single" | "multi";
  component?: React.ReactNode;
  icon?: React.ReactNode;
  badge?: { cls: string; icon: React.ReactNode };
  wrapColor?: string;
}

export function useGames(allGames: Game[]) {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [favorites, setFavorites] = useState<string[]>([]);
  const ITEMS_PER_PAGE = 6;

  useEffect(() => {
    const saved = localStorage.getItem("favorite_games");
    if (saved) {
      try {
        setFavorites(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse favorites", e);
      }
    }
  }, []);

  const toggleFavorite = (gameId: string) => {
    setFavorites((prev) => {
      const newFavs = prev.includes(gameId)
        ? prev.filter((id) => id !== gameId)
        : [...prev, gameId];
      
      localStorage.setItem("favorite_games", JSON.stringify(newFavs));
      
      if (newFavs.includes(gameId)) {
        toast.success("Game ditambahkan ke favorit");
      } else {
        toast.info("Game dihapus dari favorit");
      }
      
      return newFavs;
    });
  };

  const loadGames = async (reset = false) => {
    setLoading(true);
    
    await new Promise((resolve) => setTimeout(resolve, 800));

    const currentPage = reset ? 1 : page;
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    
    const newGames = allGames.slice(start, end);
    
    if (reset) {
      setGames(newGames);
      setPage(2);
    } else {
      setGames((prev) => [...prev, ...newGames]);
      setPage((prev) => prev + 1);
    }

    setHasMore(end < allGames.length);
    setLoading(false);
  };

  useEffect(() => {
    loadGames(true);
  }, []);

  const loadMore = () => {
    if (!loading && hasMore) {
      loadGames();
    }
  };

  return {
    games,
    loading,
    hasMore,
    favorites,
    toggleFavorite,
    loadMore
  };
}
