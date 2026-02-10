import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useLeaderboardData() {
  const [topFollowers, setTopFollowers] = useState<any[]>([]);
  const [topLiked, setTopLiked] = useState<any[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        const [{ data: followersData, error: followersError }, { data: likedData, error: likedError }, { data: suggestedData, error: suggestedError }] = await Promise.all([
          supabase.rpc("get_top_5_followers"),
          supabase.rpc("get_top_5_liked_users"),
          user ? supabase.rpc("get_suggested_users" as any, { current_user_id: user.id }) : Promise.resolve({ data: [], error: null })
        ]);

        if (followersError) throw followersError;
        if (likedError) throw likedError;
        if (suggestedError) throw suggestedError;

        setTopFollowers(followersData || []);
        setTopLiked(likedData || []);
        setSuggestedUsers(suggestedData || []);
      } catch (e: any) {
        console.error("Leaderboard error:", e);
        
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  return { topFollowers, topLiked, suggestedUsers, loading };
}
