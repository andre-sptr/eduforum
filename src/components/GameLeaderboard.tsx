import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Medal, Award, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface LeaderboardEntry {
  user_id: string;
  score: number;
  game_type: string;
  profiles: { full_name: string; avatar_url?: string; role: string };
}

const GAME_CONFIG: { value: string; label: string }[] = [
  { value: "quiz", label: "Quiz" },
  { value: "memory", label: "Memory" },
  { value: "puzzle", label: "Puzzle" },
  { value: "reaction", label: "Reaction" },
  { value: "pattern", label: "Pattern" },
  { value: "typing", label: "Typing" },
  { value: "tictactoe", label: "TicTacToe" },
  { value: "wordscramble", label: "Scramble" },
  { value: "rps", label: "RPS" },
];

const SUPPORTED_TYPES = GAME_CONFIG.map((g) => g.value);

const GameLeaderboard = () => {
  const navigate = useNavigate();
  const [leaderboards, setLeaderboards] = useState<Record<string, LeaderboardEntry[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLeaderboards();
  }, []);

  const loadLeaderboards = async () => {
    try {
      const { data: allScores, error } = await supabase
        .from("game_scores")
        .select("user_id,score,game_type")
        .in("game_type", SUPPORTED_TYPES)
        .order("score", { ascending: false })
        .limit(1000);
      if (error) throw error;

      const ids = [...new Set((allScores || []).map((s) => s.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id,full_name,avatar_url,role")
        .in("id", ids);

      const pmap = new Map((profiles || []).map((p) => [p.id, p]));
      const withP = (arr: any[] = []) =>
        arr.map((s) => ({
          ...s,
          profiles: pmap.get(s.user_id) || { full_name: "Unknown User", avatar_url: undefined, role: "siswa" },
        }));
      const top = (arr: LeaderboardEntry[]) => {
        const m = new Map<string, LeaderboardEntry>();
        arr.forEach((e) => {
          const ex = m.get(e.user_id);
          if (!ex || e.score > ex.score) m.set(e.user_id, e);
        });
        return [...m.values()].sort((a, b) => b.score - a.score).slice(0, 10);
      };
      const filterByType = (t: string) => (allScores || []).filter((s) => s.game_type === t);

      const next: Record<string, LeaderboardEntry[]> = SUPPORTED_TYPES.reduce((acc, t) => {
        acc[t] = top(withP(filterByType(t)));
        return acc;
      }, {} as Record<string, LeaderboardEntry[]>);
      setLeaderboards(next);
    } catch (e: any) {
      toast.error("Gagal memuat leaderboard: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const initials = (n: string) => {
    const a = n.split(" ");
    return (a[0]?.[0] || "") + (a[1]?.[0] || "").toUpperCase() || "U";
  };
  
  const rankIcon = (i: number) =>
    i === 0 ? (
      <Trophy className="h-4 w-4 text-accent" />
    ) : i === 1 ? (
      <Medal className="h-4 w-4 text-gray-400" />
    ) : i === 2 ? (
      <Award className="h-4 w-4 text-amber-600" />
    ) : (
      <span className="font-bold text-muted-foreground text-xs">#{i + 1}</span>
    );
    
  const roleChip = (r: string) =>
    r === "guru" ? "bg-emerald-500/10 text-emerald-400" : "bg-sky-500/10 text-sky-400";

  const List = ({ entries }: { entries: LeaderboardEntry[] }) => {
    if (loading)
      return (
        <div className="py-12 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">Sedang memuat data juara...</p>
        </div>
      );
    if (!entries.length)
      return (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Trophy className="h-10 w-10 opacity-20 mb-3" />
          <p className="text-sm">Belum ada data leaderboard untuk game ini.</p>
        </div>
      );
    return (
      <div className="space-y-3">
        {entries.map((e, i) => {
          const rankStyle = cn(
            "w-full flex items-center gap-4 p-4 text-left transition-all duration-300 rounded-2xl border",
            i === 0
              ? "border-yellow-500/30 bg-yellow-500/10 hover:bg-yellow-500/20 shadow-lg shadow-yellow-500/5"
              : i === 1
              ? "border-slate-400/30 bg-slate-500/10 hover:bg-slate-500/20"
              : i === 2
              ? "border-amber-700/30 bg-amber-700/10 hover:bg-amber-700/20"
              : "border-transparent bg-white/5 hover:bg-white/10 hover:border-white/10"
          );

          return (
            <button
              key={e.user_id}
              onClick={() => navigate(`/profile/${e.user_id}`)}
              className={rankStyle}
            >
              <div
                className={`w-8 h-8 flex-shrink-0 flex justify-center items-center rounded-full font-bold text-sm ${
                  i === 0
                    ? "bg-yellow-500 text-yellow-950"
                    : i === 1
                    ? "bg-slate-400 text-slate-900"
                    : i === 2
                    ? "bg-amber-700 text-amber-100"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {i < 3 ? i + 1 : <span className="text-xs">#{i + 1}</span>}
              </div>

              <Avatar className="h-10 w-10 ring-2 ring-white/10 shadow-sm">
                <AvatarImage src={e.profiles.avatar_url ?? undefined} className="object-cover" />
                <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60 text-primary-foreground text-xs font-bold">
                  {initials(e.profiles.full_name)}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold text-sm md:text-base">{e.profiles.full_name}</p>
                  {e.profiles.role === "guru" && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-500 font-medium">
                      Guru
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">High Score</p>
              </div>

              <div className="text-right">
                <p className="text-lg md:text-xl font-black text-primary leading-none tabular-nums tracking-tight">
                  {e.score}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mt-0.5">
                  pts
                </p>
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <Card className="border-white/10 bg-card/40 backdrop-blur-md shadow-xl rounded-3xl overflow-hidden">
      <CardHeader className="pb-6 border-b border-white/5 bg-white/5">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3 text-xl">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg shadow-primary/20">
              <Trophy className="h-5 w-5" />
            </span>
            Leaderboard Global
          </CardTitle>
          <div className="px-3 py-1 rounded-full bg-primary/10 text-xs font-medium text-primary border border-primary/20">
            Live Updates
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <Tabs defaultValue="quiz" className="w-full">
          <ScrollArea className="w-full whitespace-nowrap rounded-2xl bg-muted/30 border border-white/5 p-1.5 mb-6">
            <TabsList className="flex w-max space-x-1 bg-transparent p-0">
              {GAME_CONFIG.map((g) => (
                <TabsTrigger
                  key={g.value}
                  value={g.value}
                  className="rounded-xl px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all"
                >
                  {g.label}
                </TabsTrigger>
              ))}
            </TabsList>
            <ScrollBar orientation="horizontal" className="h-2" />
          </ScrollArea>
          {GAME_CONFIG.map((g) => (
            <TabsContent
              key={g.value}
              value={g.value}
              className="animate-in fade-in-50 slide-in-from-bottom-2 duration-500"
            >
              <List entries={leaderboards[g.value] ?? []} />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default GameLeaderboard;
