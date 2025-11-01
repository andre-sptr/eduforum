export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

export function profilePath(username?: string | null, name?: string | null): string {
  const u = (username || "").trim();
  if (u) return `/profile/u/${slugify(u)}`;
  const n = (name || "").trim();
  if (n) return `/profile/u/${slugify(n)}`;
  return "/profile/u/unknown";
}