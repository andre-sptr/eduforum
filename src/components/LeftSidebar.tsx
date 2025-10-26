import { Home, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation, Link } from 'react-router-dom';

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/profile", label: "Profil", icon: User, actualLink: "/settings/profile" }, 
];

export const LeftSidebar = () => {
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <aside className="col-span-2 hidden md:block">
      <div className="sticky top-20 rounded-lg border bg-card p-4 shadow-sm">
        <h3 className="font-bold mb-4 text-card-foreground">Navigasi</h3>
        
        <nav className="flex flex-col space-y-1">
          {navItems.map((item) => {
            let isActive = false; 
            if (item.href === "/") {
              isActive = currentPath === "/";
            } else if (item.href === "/profile") {
              isActive = currentPath.startsWith("/profile") || currentPath.startsWith("/settings/profile");
            } else {
              isActive = currentPath.startsWith(item.href);
            }

            const Icon = item.icon; 
            const targetLink = item.actualLink || item.href; 

            return (
              <Button 
                variant={isActive ? "secondary" : "ghost"} 
                className={`w-full justify-start gap-2 ${isActive ? 'text-primary font-semibold' : 'text-muted-foreground'}`} 
                asChild 
                key={item.href} 
              >
                <Link to={targetLink}> 
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              </Button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
};