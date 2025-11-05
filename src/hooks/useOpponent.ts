import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Profile = { id: string; full_name: string; avatar_url?: string | null };
type GameSessionLike = { player1_id: string; player2_id: string | null };

export function useOpponent(session: GameSessionLike | null, currentUserId: string) {
  const [opponent, setOpponent] = useState<Profile | null>(null);
  const [loadingOpponent, setLoadingOpponent] = useState(false);

  useEffect(() => {
    const opponentId =
      !session ? null :
      session.player1_id === currentUserId ? session.player2_id : session.player1_id;

    if (!opponentId) { setOpponent(null); return; }

    let active = true;
    (async () => {
      setLoadingOpponent(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("id,full_name,avatar_url")
        .eq("id", opponentId)
        .single();
      if (!active) return;
      if (!error && data) setOpponent(data);
      setLoadingOpponent(false);
    })();

    return () => { active = false; };
  }, [session?.player1_id, session?.player2_id, currentUserId]);

  return { opponent, loadingOpponent };
}