import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Users, Lock, Globe, LogOut, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { RankBadge } from "./RankBadge";

interface GroupCardProps {
  group: any;
  isMember: boolean;
  onJoin: (id: string) => void;
  onLeave: (id: string) => void;
  followerRankMap: Map<string, number>;
  likerRankMap: Map<string, number>;
}

export const GroupCard = ({ 
  group, 
  isMember, 
  onJoin, 
  onLeave,
  followerRankMap,
  likerRankMap
}: GroupCardProps) => {
  const navigate = useNavigate();
  
  const initials = (s: string) => s?.split(" ").map(x => x[0]).slice(0, 2).join("").toUpperCase() || "U";

  return (
    <Card 
      className={cn(
        "group relative flex flex-col overflow-hidden border-white/10 bg-card/40 backdrop-blur-md transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:bg-card/60",
        isMember ? "ring-1 ring-primary/20 bg-primary/5" : "hover:ring-1 hover:ring-white/20"
      )}
    >
      {}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-gradient-to-br from-transparent via-primary/5 to-transparent pointer-events-none" />

      <CardHeader className="pb-3 relative z-10">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2 min-w-0 flex-1">
            <div className="flex items-center justify-between">
                <Badge variant={group.is_private ? "secondary" : "outline"} className={cn("w-fit text-[10px] px-2 py-0.5 h-auto gap-1.5 font-medium border-white/10", group.is_private ? "bg-muted/50 text-muted-foreground" : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20")}>
                    {group.is_private ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                    {group.is_private ? "Privat" : "Publik"}
                </Badge>
                {isMember && <Badge className="bg-primary/20 text-primary hover:bg-primary/30 border-none text-[10px] px-2 py-0.5">Joined</Badge>}
            </div>
            
            <CardTitle className="line-clamp-1 text-lg font-bold group-hover:text-primary transition-colors duration-300">
              {group.name}
            </CardTitle>
            <CardDescription className="line-clamp-2 text-xs min-h-[2.5em] leading-relaxed text-muted-foreground/80">
              {group.description || "Tidak ada deskripsi"}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col justify-end pt-0 relative z-10">
        <div className="mt-4 flex items-center gap-3 border-t border-white/10 pt-4">
          <Avatar className="h-9 w-9 ring-2 ring-white/10 shadow-sm">
            <AvatarImage src={group.profiles?.avatar_url || ""} />
            <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60 text-primary-foreground text-xs font-bold">
              {initials(group.profiles?.full_name || "")}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0 flex-1 gap-0.5">
            <span className="text-sm font-semibold truncate text-foreground/90">
              {group.profiles?.full_name || "Unknown"}
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
               <span className="text-[10px] font-medium text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">Admin</span>
               <RankBadge rank={followerRankMap.get(group.profiles?.id) || null} type="follower" />
               <RankBadge rank={likerRankMap.get(group.profiles?.id) || null} type="like" />
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted/40 px-2.5 py-1.5 rounded-lg border border-white/5">
            <Users className="h-3.5 w-3.5" />
            <span>{group.group_members?.[0]?.count || 0} Member</span>
          </div>
          
          <div className="flex gap-2">
            {isMember ? (
              <>
                <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors"
                    onClick={(e) => {
                        e.stopPropagation();
                        onLeave(group.id);
                    }}
                    title="Keluar Grup"
                >
                    <LogOut className="h-4 w-4" />
                </Button>
                <Button 
                    size="sm" 
                    className="h-9 text-xs font-medium rounded-xl gap-1.5 bg-primary/10 text-primary hover:bg-primary/20 border-none shadow-none transition-all hover:pr-4 group/btn"
                    onClick={() => navigate(`/groups/${group.id}`)}
                >
                    Buka <ArrowRight className="h-3 w-3 transition-transform group-hover/btn:translate-x-1" />
                </Button>
              </>
            ) : (
              <Button 
                size="sm" 
                className="h-9 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all px-4"
                onClick={() => onJoin(group.id)}
              >
                Gabung
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
