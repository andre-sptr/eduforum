import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useLikedPosts = (userId: string | undefined, postIds: string[]) => {
  return useQuery<Set<string>>({
    queryKey: ["likedPosts", userId, postIds],
    enabled: !!userId && postIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("post_likes")
        .select("post_id")
        .eq("user_id", userId)
        .in("post_id", postIds);
      if (error) throw error;
      return new Set<string>((data || []).map((r: { post_id: string }) => r.post_id));
    },
    staleTime: 60_000,
    gcTime: 300_000,
  });
};