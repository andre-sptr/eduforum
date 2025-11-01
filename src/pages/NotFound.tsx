import { useEffect, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";

export default function NotFound() {
  const { pathname } = useLocation(); const nav = useNavigate();
  const [q, setQ] = useState("");
  useEffect(() => { console.error("404:", pathname); document.title = "404 • Halaman tidak ditemukan"; }, [pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-muted/40 via-background to-primary/10 p-6">
      <div className="w-full max-w-lg rounded-2xl border bg-card shadow-xl p-8 text-center">
        <div className="mb-3 text-7xl font-extrabold tracking-tight">404</div>
        <p className="text-sm text-muted-foreground mb-6">Halaman <span className="font-mono break-all">{pathname}</span> tidak ditemukan.</p>

        <form
          onSubmit={(e)=>{e.preventDefault(); if(q.trim()) nav(`/search?q=${encodeURIComponent(q.trim())}`)}}
          className="flex gap-2 mb-4"
        >
          <input
            className="flex-1 rounded-lg border px-3 py-2 outline-none focus:ring"
            placeholder="Cari sesuatu…"
            value={q} onChange={e=>setQ(e.target.value)}
          />
          <button className="rounded-lg px-4 py-2 border hover:bg-muted transition">Cari</button>
        </form>

        <div className="flex flex-wrap justify-center gap-2">
          <button onClick={()=>nav(-1)} className="rounded-lg px-4 py-2 border hover:bg-muted transition">← Kembali</button>
          <Link to="/" className="rounded-lg px-4 py-2 border hover:bg-muted transition">🏠 Beranda</Link>
          <Link to="/profile/u/user-3c4bc6e4" className="rounded-lg px-4 py-2 border hover:bg-muted transition">👤 Profil</Link>
        </div>

        <div className="mt-6 text-xs text-muted-foreground">
          Tip: pastikan URL benar atau gunakan pencarian di atas.
        </div>
      </div>
    </div>
  );
}