
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Notifications } from "@/components/Notifications";
import { ChatNotifications } from "@/components/ChatNotifications";

export default function Navbar() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setUserId(s?.user?.id ?? null));
    return () => subscription.unsubscribe();
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-card/80 backdrop-blur-xl shadow-sm transition-all duration-300">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/home" className="flex items-center gap-3 group min-h-[44px] min-w-[44px]">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/30 blur-lg rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <img src="/favicon.ico" alt="Logo" className="h-9 w-9 rounded-xl shadow-md ring-1 ring-white/10 relative z-10 transition-transform group-hover:scale-105" />
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient">
              EduForum
            </h1>
          </Link>

          <div className="flex items-center gap-3">
            {userId && (
              <div className="flex items-center gap-1 bg-white/5 rounded-full p-1 border border-white/5 backdrop-blur-sm">
                <ChatNotifications userId={userId} />
                <Notifications userId={userId} />
              </div>
            )}
            <div className="h-6 w-px bg-white/10 mx-1" />
            <ThemeToggle />
          </div>
      </div>
    </header>
  );
}