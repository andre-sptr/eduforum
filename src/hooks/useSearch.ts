import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDebounce } from './useDebounce';
import { toast } from 'sonner';

export type SearchMode = 'AND' | 'OR';

interface UseSearchOptions {
  initialQuery?: string;
  initialMode?: SearchMode;
  debounceDelay?: number;
}

export function useSearch({ initialQuery = '', initialMode = 'OR', debounceDelay = 300 }: UseSearchOptions = {}) {
  const [query, setQuery] = useState(initialQuery);
  const [mode, setMode] = useState<SearchMode>(initialMode);
  const debouncedQuery = useDebounce(query, debounceDelay);
  
  const [posts, setPosts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('search_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse search history", e);
      }
    }
  }, []);

  const saveToHistory = (term: string) => {
    if (!term.trim()) return;
    const cleanTerm = term.trim();
    const newHistory = [cleanTerm, ...history.filter(h => h.toLowerCase() !== cleanTerm.toLowerCase())].slice(0, 5);
    setHistory(newHistory);
    localStorage.setItem('search_history', JSON.stringify(newHistory));
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('search_history');
  };

  const removeFromHistory = (term: string) => {
    const newHistory = history.filter(h => h !== term);
    setHistory(newHistory);
    localStorage.setItem('search_history', JSON.stringify(newHistory));
  };

  const search = useCallback(async (searchTerm: string, searchMode: SearchMode, pageNum: number) => {
    if (!searchTerm.trim()) {
      setPosts([]);
      setUsers([]);
      return;
    }

    setLoading(true);
    try {
      const terms = searchTerm.trim().split(/\s+/).filter(t => t.length > 0);

      let postQuery = supabase
        .from("posts")
        .select(`
          id, content, created_at, media_urls, media_types, user_id,
          spotify_track_id,
          profiles:profiles!user_id ( id, full_name, avatar_url, role ),
          likes ( user_id, post_id ),
          reposts ( count ),
          quote_reposts:posts!repost_of_id ( count ),
          quoted_post:repost_of_id (
            id, content, created_at, user_id,
            profiles:profiles!user_id ( id, full_name, avatar_url, role )
          )
        `)
        .order("created_at", { ascending: false })
        .range(pageNum * 10, (pageNum + 1) * 10 - 1);

      if (terms.length > 0) {
        if (searchMode === 'OR') {
            const orClause = terms.map(t => `content.ilike.%${t}%`).join(',');
            if (orClause) postQuery = postQuery.or(orClause);
        } else {
            terms.forEach(t => {
                postQuery = postQuery.ilike('content', `%${t}%`);
            });
        }
      }

      const { data: postsData, error: postsError } = await postQuery;
      if (postsError) throw postsError;

      if (pageNum === 0) {
         let userQuery = supabase
           .from("profiles")
           .select("*")
           .neq("full_name", "Deleted User")
           .limit(10);

         if (terms.length > 0) {
             const userOrClause = terms.map(t => `full_name.ilike.%${t}%`).join(',');
             if (userOrClause) userQuery = userQuery.or(userOrClause);
         }
         
         const { data, error } = await userQuery;
         if (error) throw error;
         setUsers(data || []);
      }

      if (pageNum === 0) {
        setPosts(postsData || []);
      } else {
        setPosts(prev => [...prev, ...(postsData || [])]);
      }
      
      setHasMore((postsData?.length || 0) === 10);

    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debouncedQuery.trim()) {
        setPage(0);
        setPosts([]);
        setUsers([]);
        search(debouncedQuery, mode, 0);
    } else {
        setPosts([]);
        setUsers([]);
        setLoading(false);
    }
  }, [debouncedQuery, mode, search]);

  const loadMore = () => {
    if (!loading && hasMore) {
        const nextPage = page + 1;
        setPage(nextPage);
        search(debouncedQuery, mode, nextPage);
    }
  };

  return {
    query,
    setQuery,
    mode,
    setMode,
    posts,
    users,
    loading,
    history,
    saveToHistory,
    clearHistory,
    removeFromHistory,
    loadMore,
    hasMore
  };
}
