
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
    <header className="sticky top-0 z-50 border-b border-border bg-card/90 backdrop-blur">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/home" className="flex items-center gap-2">
            <img src="/favicon.ico" alt="Logo" className="h-8 w-8 rounded-md shadow" />
            <h1 className="text-lg font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              EduForum
            </h1>
          </Link>

          <div className="flex items-center gap-2">
            {userId && (<><ChatNotifications userId={userId} /><Notifications userId={userId} /></>)}
            <ThemeToggle />
          </div>
      </div>
    </header>
  );
}