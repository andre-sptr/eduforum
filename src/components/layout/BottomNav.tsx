import { Home, Search, PlusSquare, MessageCircle, User } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export function BottomNav() {
  const { pathname } = useLocation();

  const navItems = [
    { icon: Home, label: "Home", href: "/home" },
    { icon: Search, label: "Search", href: "/search" },
    { icon: PlusSquare, label: "Post", href: "/create-post" },
    { icon: MessageCircle, label: "Chat", href: "/messages" },
    { icon: User, label: "Profile", href: "/profile" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-t border-border lg:hidden safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              to={item.href}
              className="relative flex flex-col items-center justify-center w-full h-full min-h-[44px] min-w-[44px]"
            >
              {isActive && (
                <motion.div
                  layoutId="bottom-nav-indicator"
                  className="absolute inset-0 bg-primary/10 rounded-xl"
                  initial={false}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
              <div className={cn(
                "relative z-10 flex flex-col items-center justify-center space-y-1 transition-colors duration-200",
                isActive ? "text-primary" : "text-muted-foreground"
              )}>
                <motion.div
                  whileTap={{ scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 400, damping: 10 }}
                >
                  <item.icon className={cn("h-6 w-6", isActive && "fill-current")} />
                </motion.div>
                <span className="text-[10px] font-medium">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
