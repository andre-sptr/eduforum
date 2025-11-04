// src/components/Navbar.tsx
import { useEffect, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, LogOut, Home } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Notifications } from "@/components/Notifications";
import { ChatNotifications } from "@/components/ChatNotifications";

export default function Navbar() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [userId, setUserId] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setUserId(s?.user?.id ?? null));
    return () => subscription.unsubscribe();
  }, []);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim()) nav(`/search?q=${encodeURIComponent(q.trim())}`);
  };

  const logout = async () => { await supabase.auth.signOut(); nav("/auth"); };
  useEffect(() => setQ(""), [pathname]);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/90 backdrop-blur">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2">
            <img src="/favicon.ico" alt="Logo" className="h-8 w-8 rounded-md shadow" />
            <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              EduForum MAN IC Siak
            </h1>
          </Link>

          <form onSubmit={onSubmit} className="flex-1 max-w-md mx-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e)=>setQ(e.target.value)}
                placeholder="Cari postingan atau user..."
                className="pl-9 rounded-xl bg-input/60 border-border focus-visible:ring-2 focus-visible:ring-accent"
              />
            </div>
          </form>

          <div className="flex items-center gap-2">
            {/* Tombol Home baru */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => nav("/")}
              aria-label="Home"
              title="Home"
              className="rounded-xl ring-1 ring-border hover:ring-accent/50"
            >
              <Home className="h-5 w-5" />
            </Button>

            {userId && (<><ChatNotifications userId={userId} /><Notifications userId={userId} /></>)}
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={logout} className="text-muted-foreground hover:text-foreground rounded-xl">
              <LogOut className="h-4 w-4 mr-2" /> Keluar
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}