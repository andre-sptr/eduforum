import Leaderboard from "@/components/Leaderboard";
import { useLeaderboardData } from "@/hooks/useLeaderboardData";

export function RightSidebar() {
  const { topFollowers, topLiked, suggestedUsers, loading } = useLeaderboardData();

  return (
    <aside className="hidden xl:flex flex-col w-80 sticky top-0 h-screen border-l border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 overflow-y-auto custom-scrollbar">
       <div className="p-6 space-y-6">
          {loading ? (
            <div className="space-y-4">
               {[1, 2, 3].map((i) => (
                 <div key={i} className="h-40 bg-muted/50 rounded-xl animate-pulse" />
               ))}
            </div>
          ) : (
            <Leaderboard users={topFollowers} likedUsers={topLiked} suggestedUsers={suggestedUsers} />
          )}
          
          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              <a
                href="https://andresptr.site"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline-offset-4"
              >
                © {new Date().getFullYear()} Andre Saputra
              </a>
            </p>
          </div>
       </div>
    </aside>
  );
}
