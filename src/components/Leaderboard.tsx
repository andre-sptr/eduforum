import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TrendingUp, Trophy, Medal, Award, FileText, Heart, UserPlus, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { RankBadge } from "@/components/RankBadge"

interface LeaderboardUser {
  id: string;
  full_name: string;
  avatar_url?: string;
  follower_count: number;
}

interface LeaderboardLikeUser {
  id: string;
  full_name: string;
  avatar_url?: string;
  total_likes: number;
}

interface LeaderboardProps {
  users: LeaderboardUser[];
  likedUsers: LeaderboardLikeUser[];
  suggestedUsers: LeaderboardUser[];
}

const freeTools = [
  { name: "PDF Tools", websiteUrl: "https://pdf.andresptr.site/" },
  { name: "Reka AI", iconUrl: "/reka.png", websiteUrl: "https://ai.andresptr.site/" },
  { name: "AetherNet", iconUrl: "/logo.png", websiteUrl: "https://aethernet.andresptr.site/" },
];

const getInitials = (name: string) => {
  const names = name.split(" ");
  return (names.length >= 2
    ? `${names[0][0]}${names[1][0]}`
    : name.slice(0, 2)
  ).toUpperCase();
};

const rankIcons = [
  <Trophy className="h-5 w-5 text-yellow-500" key="rank-1" />,
  <Medal className="h-5 w-5 text-gray-400" key="rank-2" />,
  <Award className="h-5 w-5 text-amber-600" key="rank-3" />,
];

const getRankIcon = (index: number) => {
  return rankIcons[index] ?? <span className="text-muted-foreground font-bold w-5 text-center">#{index + 1}</span>;
};

const Leaderboard = ({ users, likedUsers, suggestedUsers }: LeaderboardProps) => { 
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <Card className="border-none shadow-sm bg-gradient-to-br from-card to-card/50 overflow-hidden hover:shadow-md transition-shadow duration-300">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            Free Tools
            <ExternalLink className="h-4 w-4 opacity-50" />
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <TooltipProvider>
            <div className="grid grid-cols-4 gap-3">
              {freeTools.map((tool) => (
                <Tooltip key={tool.name} delayDuration={100}>
                  <TooltipTrigger asChild>
                    <a
                      href={tool.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative block aspect-square"
                      aria-label={`Link ke ${tool.name}`}
                    >
                      <div className="flex h-full w-full items-center justify-center rounded-xl bg-muted/30 border border-border/40 group-hover:bg-primary/5 group-hover:border-primary/20 group-hover:scale-105 transition-all duration-300">
                        {tool.iconUrl ? (
                          <img
                            src={tool.iconUrl}
                            alt={tool.name}
                            className="h-3/5 w-3/5 object-contain filter group-hover:brightness-110 transition-all"
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <FileText className="h-1/2 w-1/2 text-muted-foreground group-hover:text-primary transition-colors duration-300" />
                        )}
                      </div>
                    </a>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs font-medium">
                    <p>{tool.name}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </TooltipProvider>
        </CardContent>
      </Card>
      
      <Card className="border-none shadow-sm bg-card/80 backdrop-blur-sm hover:shadow-md transition-shadow duration-300">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-yellow-500/10">
              <TrendingUp className="h-4 w-4 text-blue-500" />
            </div>
            Top Creators
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 p-2">
          {users.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground text-sm">Belum ada data</p>
            </div>
          ) : (
            users.map((user, index) => (
              <div
                key={user.id}
                className="group flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => navigate(`/profile/${user.id}`)}
              >
                <div className="flex-shrink-0 w-8 flex justify-center">{getRankIcon(index)}</div>
                
                <Avatar className="h-9 w-9 border border-border group-hover:border-primary/50 transition-colors">
                  <AvatarImage src={user.avatar_url} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                    {getInitials(user.full_name)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-medium text-sm text-foreground truncate group-hover:text-primary transition-colors">
                      {user.full_name}
                    </p>
                    <RankBadge rank={index + 1} type="follower" />
                  </div>
                  <p className="text-xs text-muted-foreground font-medium">
                    {user.follower_count.toLocaleString()} followers
                  </p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm bg-card/80 backdrop-blur-sm hover:shadow-md transition-shadow duration-300">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-red-500/10">
              <Heart className="h-4 w-4 text-red-500" />
            </div>
            Most Liked
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 p-2">
          {likedUsers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground text-sm">Belum ada data</p>
            </div>
          ) : (
            likedUsers.map((user, index) => (
              <div
                key={user.id}
                className="group flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => navigate(`/profile/${user.id}`)}
              >
                <div className="flex-shrink-0 w-8 flex justify-center">{getRankIcon(index)}</div>
                
                <Avatar className="h-9 w-9 border border-border group-hover:border-red-500/50 transition-colors">
                  <AvatarImage src={user.avatar_url} />
                  <AvatarFallback className="bg-red-500/10 text-red-500 text-xs font-bold">
                    {getInitials(user.full_name)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-medium text-sm text-foreground truncate group-hover:text-red-500 transition-colors">
                      {user.full_name}
                    </p>
                    <RankBadge rank={index + 1} type="like" />
                  </div>
                  <p className="text-xs text-muted-foreground font-medium">
                    {user.total_likes.toLocaleString()} likes
                  </p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
      
      <Card className="border-none shadow-sm bg-card/80 backdrop-blur-sm hover:shadow-md transition-shadow duration-300">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-green-500/10">
              <UserPlus className="h-4 w-4 text-green-500" />
            </div>
            Suggested Users
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 p-2">
          {suggestedUsers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground text-sm">Belum ada saran</p>
            </div>
          ) : (
            suggestedUsers.map((user) => (
              <div
                key={user.id}
                className="group flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => navigate(`/profile/${user.id}`)}
              >
                <Avatar className="h-9 w-9 border border-border group-hover:border-green-500/50 transition-colors">
                  <AvatarImage src={user.avatar_url} />
                  <AvatarFallback className="bg-green-500/10 text-green-500 text-xs font-bold">
                    {getInitials(user.full_name)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-medium text-sm text-foreground truncate group-hover:text-green-500 transition-colors">
                      {user.full_name}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground font-medium">
                    {user.follower_count.toLocaleString()} followers
                  </p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Leaderboard;