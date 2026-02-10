import { Home, Search, Bell, MessageCircle, User, Settings, LogOut, Gamepad2, Users } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

export function Sidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const navItems = [
    { icon: Home, label: "Home", href: "/home" },
    { icon: Search, label: "Search", href: "/search" },
    { icon: Gamepad2, label: "Games", href: "/games" },
    { icon: Users, label: "Groups", href: "/groups" },
    { icon: MessageCircle, label: "Messages", href: "/messages" },
    { icon: Bell, label: "Notifications", href: "/notifications" },
    { icon: User, label: "Profile", href: "/profile" },
    { icon: Settings, label: "Settings", href: "/settings" },
  ];

  return (
    <aside className="hidden lg:flex flex-col w-64 sticky top-0 h-screen border-r border-border bg-card/50 backdrop-blur-sm p-4">
      <div className="mb-8 px-2">
        <Link to="/home" className="flex items-center gap-3">
          <img src="/favicon.ico" alt="Logo" className="h-8 w-8 rounded-md shadow" />
          <h1 className="text-lg font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            EduForum
          </h1>
        </Link>
      </div>

      <nav className="flex-1 space-y-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 group",
                isActive 
                  ? "bg-primary/10 text-primary font-semibold" 
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className={cn("h-6 w-6 group-hover:scale-110 transition-transform", isActive && "fill-primary/20")} />
              <span className="text-base">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-4 border-t border-border">
        <Button 
          variant="ghost" 
          className="w-full justify-start gap-4 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5" />
          Logout
        </Button>
      </div>
    </aside>
  );
}
