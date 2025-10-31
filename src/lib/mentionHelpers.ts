import { supabase } from "@/integrations/supabase/client";

export type Mention = { name: string; index: number; length: number };

const EMAIL_OR_URL_RE =
  /\b((mailto:)?[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|https?:\/\/[^\s)]+)\b/gi;

const cache = new Map<string, RegExp>();

function maskEmailsAndUrls(input: string): string {
  if (!input) return input;
  EMAIL_OR_URL_RE.lastIndex = 0;
  return input.replace(EMAIL_OR_URL_RE, (m) => " ".repeat(m.length));
}

export function buildMentionRegex(names: string[]): RegExp | null {
  if (!names.length) return null;
  const key = names.join("\u0001");
  const cached = cache.get(key);
  if (cached) return cached;
  const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const re = new RegExp(String.raw`(?<![\p{L}\p{N}_])@(${escaped})(?![\p{L}\p{N}_])`, "giu");
  cache.set(key, re);
  return re;
}

export function extractMentions(content: string, names: string[]): Mention[] {
  if (!content || !names.length) return [];
  const re = buildMentionRegex(names);
  if (!re) return [];
  const source = maskEmailsAndUrls(content);
  return scanMentions(source, re);
}

function scanMentions(source: string, re: RegExp): Mention[] {
  const out: Mention[] = [];
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    const name = m[1];
    if (!name) continue;
    out.push({ name, index: m.index, length: m[0].length });
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return dedupeMentions(out);
}

function dedupeMentions(items: Mention[]): Mention[] {
  const seen = new Set<string>();
  const res: Mention[] = [];
  for (const it of items) {
    const key = `${it.index}:${it.length}`;
    if (seen.has(key)) continue;
    seen.add(key);
    res.push(it);
  }
  return res.sort((a, b) => a.index - b.index);
}

export function uniqueNames(items: Mention[]): string[] {
  return Array.from(new Set(items.map((m) => m.name)));
}

export function getProfileUrl(name: string): string {
  return `/profile/name/${encodeURIComponent(name)}`;
}

function extractGenericMentionNames(content: string): string[] {
  if (!content) return [];
  const masked = maskEmailsAndUrls(content);
  const re = /(?<![\p{L}\p{N}_])@([\p{L}\p{N}_]{2,100})(?![\p{L}\p{N}_])/giu;
  const set = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(masked))) set.add(m[1]);
  return Array.from(set);
}

export async function resolveMentionsToIds(content: string): Promise<string[]> {
  const names = extractGenericMentionNames(content);
  if (names.length === 0) return [];
  const { data, error } = await supabase.from("profiles").select("id, name").in("name", names);
  if (error) throw error;
  return Array.from(new Set((data || []).map((r) => r.id)));
}