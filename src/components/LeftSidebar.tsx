import { Home, User, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from "@/components/ui/skeleton";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/profile", label: "Profil", icon: User, actualLink: "/settings/profile" }, 
];

interface LeaderboardUser {
    user_id: string;
    name: string;
    avatar_text: string;
    role: string;
    follower_count: number;
}

export const LeftSidebar = () => {
  const location = useLocation();
  const currentPath = location.pathname;

  const { data: leaderboard, isLoading: isLoadingLeaderboard } = useQuery<LeaderboardUser[]>({
    queryKey: ['followerLeaderboard'],
    queryFn: async () => {
      const { data } = await supabase
        .rpc('get_follower_leaderboard');
      if (data) {
          return data.map(item => ({...item, follower_count: Number(item.follower_count)})) as LeaderboardUser[];
      }
      return [];
    },
    staleTime: 5 * 60 * 1000,
  });

  return (
    <aside className="col-span-2 hidden md:block">
      <div className="sticky top-20 rounded-lg border bg-card p-4 shadow-sm">

        <h3 className="font-bold mb-4 text-card-foreground">Navigasi</h3>
        
        <nav className="flex flex-col space-y-1 mb-4 border-b pb-4">
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
        
        <h3 className="font-bold mb-3 text-card-foreground flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary/70"/> Leaderboard
        </h3>
        
        <div className="space-y-1">
          {isLoadingLeaderboard ? (
            [1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-6 w-full rounded-md" />)
          ) : (
            leaderboard.map((user, index) => (
              <Link 
                key={user.user_id} 
                to={`/profile/name/${encodeURIComponent(user.name)}`}
                className="flex items-center justify-between hover:bg-muted p-1.5 rounded-lg transition-colors" 
              >
                <div className="flex items-center gap-3 truncate">
                  <span className={`font-extrabold w-5 text-center text-sm flex-shrink-0 ${
                    index === 0 ? 'text-yellow-500' : 
                    index === 1 ? 'text-slate-400' : 
                    index === 2 ? 'text-orange-400' : 'text-muted-foreground'
                  }`}>
                    {index < 3 ? '👑' : `${index + 1}.`} 
                  </span>
                  
                  <span className="text-sm truncate">{user.name}</span>
                </div>

                <span className="text-xs text-primary font-semibold flex-shrink-0">
                  {user.follower_count} Pengikut
                </span>
              </Link>
            ))
          )}
        </div>
      </div>
    </aside>
  );
};