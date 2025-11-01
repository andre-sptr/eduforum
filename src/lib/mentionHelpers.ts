import { supabase } from "@/integrations/supabase/client";

const MENTION_REGEX = /@([a-zA-Z0-9_.]+(?:\s[a-zA-Z0-9_.]+)*)/g;

export async function resolveMentionsToIds(commentText: string): Promise<string[]> {
  const mentions = [...commentText.matchAll(MENTION_REGEX)].map(match => match[1]);
  if (mentions.length === 0) {
    return [];
  }
  const uniqueNames = Array.from(new Set(mentions));
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, name')
    .in('name', uniqueNames);

  if (error) {
    console.error("Gagal resolve mentions:", error.message);
    return [];
  }
  return profiles.map(profile => profile.id);
}