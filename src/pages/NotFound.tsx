import { useEffect, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";

export default function NotFound() {
  const { pathname } = useLocation(); const nav = useNavigate();
  const [q, setQ] = useState("");
  useEffect(()=>{ console.error("404:", pathname); document.title="404 • Halaman tidak ditemukan"; },[pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(ellipse_at_top_left,_hsl(var(--primary)/0.1),_transparent_50%),radial-gradient(ellipse_at_bottom_right,_hsl(var(--accent)/0.1),_transparent_50%)] p-6">
      <div className="relative w-full max-w-xl">
        <div className="absolute -inset-1 rounded-3xl bg-gradient-to-br from-primary/20 via-accent/20 to-muted/20 blur-2xl" />
        <div className="relative w-full rounded-3xl border border-border/60 bg-card/70 backdrop-blur-xl shadow-xl p-8">
          <div className="mx-auto mb-6 grid place-items-center">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl border border-border bg-background/60 shadow-sm">
              <img src="/favicon.png" alt="Favicon" className="w-10 h-10"/>
            </div>
          </div>

          <div className="mb-1 text-center text-sm tracking-wide text-muted-foreground">Oops…</div>
          <div className="mb-3 text-center text-6xl md:text-7xl font-black bg-gradient-to-r from-primary via-foreground to-accent bg-clip-text text-transparent leading-none">
            404
          </div>
          <p className="text-center text-sm md:text-base text-muted-foreground mb-7">
            Halaman <span className="font-mono break-all text-foreground/90">{pathname}</span> tidak ditemukan.
          </p>

          <form
            onSubmit={(e)=>{ e.preventDefault(); if(q.trim()) nav(`/search?q=${encodeURIComponent(q.trim())}`); }}
            className="mb-5"
          >
            <div className="group relative flex rounded-2xl border border-border bg-background/60 focus-within:ring-2 focus-within:ring-accent/40 transition">
              <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70">🔎</div>
              <input
                className="w-full pl-10 pr-24 py-3 bg-transparent outline-none placeholder:text-muted-foreground/70"
                placeholder="Cari sesuatu…"
                value={q}
                onChange={(e)=>setQ(e.target.value)}
              />
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl border border-border px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition"
              >
                Cari
              </button>
            </div>
          </form>

          <div className="flex flex-wrap justify-center gap-2.5">
            <button
              onClick={()=>nav(-1)}
              className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-muted/60 transition shadow-sm hover:shadow"
            >
              ← Kembali
            </button>
            <Link
              to="/"
              className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-muted/60 transition shadow-sm hover:shadow"
            >
              🏠 Beranda
            </Link>
            <Link
              to="/profile/8b65284e-3cec-4634-a0ef-24bf733175be"
              className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-muted/60 transition shadow-sm hover:shadow"
            >
              👤 Profil
            </Link>
          </div>

          <div className="mt-6 text-center text-xs text-muted-foreground">
            Tip: pastikan URL benar atau gunakan pencarian di atas.
          </div>
        </div>
      </div>
    </div>
  );
}