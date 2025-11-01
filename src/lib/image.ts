export const getOptimizedImageUrl = (url: string | null, width: number): string | null => {
  if (typeof url !== "string" || url.length === 0) return null;
  const [base, q] = url.split("?");
  const params = new URLSearchParams(q || "");
  params.set("width", String(width));
  params.set("quality", "80");
  params.set("format", "webp");
  return `${base}?${params.toString()}`;
};