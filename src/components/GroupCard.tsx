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
        "group relative flex flex-col overflow-hidden border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:shadow-lg",
        isMember ? "border-primary/20 bg-primary/5" : ""
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5 min-w-0 flex-1">
            <div className="flex items-center justify-between">
                <Badge variant={group.is_private ? "secondary" : "outline"} className="w-fit text-[10px] px-2 py-0 h-5 gap-1">
                    {group.is_private ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                    {group.is_private ? "Privat" : "Publik"}
                </Badge>
                {isMember && <Badge className="bg-primary/20 text-primary hover:bg-primary/30 border-none text-[10px]">Joined</Badge>}
            </div>
            
            <CardTitle className="line-clamp-1 text-lg group-hover:text-primary transition-colors">
              {group.name}
            </CardTitle>
            <CardDescription className="line-clamp-2 text-xs min-h-[2.5em]">
              {group.description || "Tidak ada deskripsi"}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col justify-end pt-0">
        <div className="mt-4 flex items-center gap-3 border-t border-border/50 pt-3">
          <Avatar className="h-8 w-8 ring-2 ring-background">
            <AvatarImage src={group.profiles?.avatar_url || ""} />
            <AvatarFallback className="bg-accent text-accent-foreground text-xs font-bold">
              {initials(group.profiles?.full_name || "")}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-xs font-medium truncate">
              {group.profiles?.full_name || "Unknown"}
            </span>
            <div className="flex items-center gap-1">
               <span className="text-[10px] text-muted-foreground">Admin</span>
               <RankBadge rank={followerRankMap.get(group.profiles?.id) || null} type="follower" />
               <RankBadge rank={likerRankMap.get(group.profiles?.id) || null} type="like" />
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">
            <Users className="h-3.5 w-3.5" />
            <span>{group.group_members?.[0]?.count || 0}</span>
          </div>
          
          <div className="flex gap-2">
            {isMember ? (
              <>
                <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-full"
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
                    className="h-8 text-xs rounded-lg gap-1 bg-primary/10 text-primary hover:bg-primary/20 border-none shadow-none"
                    onClick={() => navigate(`/groups/${group.id}`)}
                >
                    Buka <ArrowRight className="h-3 w-3" />
                </Button>
              </>
            ) : (
              <Button 
                size="sm" 
                className="h-8 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
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
