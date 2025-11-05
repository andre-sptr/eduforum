import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Medal, Award } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface LeaderboardEntry { 
  user_id: string; 
  score: number; 
  game_type: string; 
  profiles: { 
    full_name: string; 
    avatar_url?: string; 
    role: string 
  } 
}

const GameLeaderboard = () => {
  const navigate = useNavigate();
  const [quizLeaderboard, setQuizLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [memoryLeaderboard, setMemoryLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [puzzleLeaderboard, setPuzzleLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [tictactoeLeaderboard, setTictactoeLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [wordScrambleLeaderboard, setWordScrambleLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [rpsLeaderboard, setRpsLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadLeaderboards(); }, []);

  const loadLeaderboards = async () => {
    try {
      const gameTypes = ["quiz", "memory", "puzzle", "tictactoe", "wordscramble", "rps"];
      
      const { data: allScores, error } = await supabase
        .from("game_scores")
        .select("user_id, score, game_type")
        .in("game_type", gameTypes)
        .order("score", { ascending: false })
        .limit(500);

      if (error) throw error;

      const ids = new Set((allScores || []).map(s => s.user_id));
      
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, role")
        .in("id", Array.from(ids));

      const pmap = new Map((profiles || []).map(p => [p.id, p]));
      
      const withP = (arr: any[] = []) => arr.map(s => ({ ...s, profiles: pmap.get(s.user_id) || { full_name: "Unknown User", avatar_url: undefined, role: "siswa" } }));
      const top = (arr: LeaderboardEntry[]) => { const m = new Map<string, LeaderboardEntry>(); arr.forEach(e => { const ex = m.get(e.user_id); if (!ex || e.score > ex.score) m.set(e.user_id, e) }); return Array.from(m.values()).sort((a, b) => b.score - a.score).slice(0, 10); };
      
      const filterByType = (type: string) => (allScores || []).filter(s => s.game_type === type);

      setQuizLeaderboard(top(withP(filterByType("quiz"))));
      setMemoryLeaderboard(top(withP(filterByType("memory"))));
      setPuzzleLeaderboard(top(withP(filterByType("puzzle"))));
      setTictactoeLeaderboard(top(withP(filterByType("tictactoe"))));
      setWordScrambleLeaderboard(top(withP(filterByType("wordscramble"))));
      setRpsLeaderboard(top(withP(filterByType("rps"))));

    } catch (e: any) {
      toast.error("Gagal memuat leaderboard: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const initials = (n: string) => { const a = n.split(" "); return (a[0]?.[0] || "") + (a[1]?.[0] || "").toUpperCase() || "U"; };
  
  const rankIcon = (i: number) => {
    if (i === 0) return <Trophy className="h-4 w-4 text-accent" />;
    if (i === 1) return <Medal className="h-4 w-4 text-gray-400" />;
    if (i === 2) return <Award className="h-4 w-4 text-amber-600" />;
    return <span className="font-bold text-muted-foreground text-xs">#{i + 1}</span>;
  };
  
  const roleChip = (r: string) => r === "guru" ? "bg-emerald-500/10 text-emerald-400" : "bg-sky-500/10 text-sky-400";

  const List = ({ entries }: { entries: LeaderboardEntry[] }) => {
    if (loading) return <div className="py-10 text-center"><div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-accent" /><p className="mt-2 text-sm text-muted-foreground">Memuat...</p></div>;
    if (!entries.length) return <p className="py-10 text-center text-sm text-muted-foreground">Belum ada data leaderboard</p>;
    
    return (
      <div className="space-y-2">
        {entries.map((e, i) => {
          const rankStyle = cn(
            "w-full flex items-center gap-4 p-3 text-left transition-all duration-150 rounded-xl border-2",
            i === 0 ? "border-accent/30 bg-accent/5 hover:bg-accent/10 hover:shadow-lg" :
            i === 1 ? "border-gray-400/30 bg-gray-500/5 hover:bg-gray-500/10" :
            i === 2 ? "border-amber-600/30 bg-amber-600/5 hover:bg-amber-600/10" :
            "border-transparent hover:bg-muted/50"
          );

          return (
            <button key={e.user_id} onClick={() => navigate(`/profile/${e.user_id}`)} className={rankStyle}>
              <div className="w-6 flex-shrink-0 flex justify-center items-center">{rankIcon(i)}</div>
              <Avatar className="h-10 w-10 ring-2 ring-accent/20">
                <AvatarImage src={e.profiles.avatar_url ?? undefined} />
                <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">{initials(e.profiles.full_name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold">{e.profiles.full_name}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${roleChip(e.profiles.role)}`}>{e.profiles.role}</span>
                </div>
                <p className="text-xs text-muted-foreground">Skor Tertinggi</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-accent leading-none">{e.score}</p>
                <p className="text-xs text-muted-foreground">poin</p>
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <Card className="border-border bg-card/80 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-3 text-xl">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 text-accent ring-1 ring-border">
            <Trophy className="h-5 w-5" />
          </span>
          Leaderboard per Game
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="quiz" className="w-full">
          <TabsList className="mb-4 grid w-full grid-cols-3 md:grid-cols-6 rounded-xl bg-muted/60 p-1 h-auto">
            <TabsTrigger value="quiz" className="rounded-lg data-[state=active]:bg-card data-[state=active]:text-accent-foreground data-[state=active]:shadow-md">Quiz</TabsTrigger>
            <TabsTrigger value="memory" className="rounded-lg data-[state=active]:bg-card data-[state=active]:text-accent-foreground data-[state=active]:shadow-md">Memory</TabsTrigger>
            <TabsTrigger value="puzzle" className="rounded-lg data-[state=active]:bg-card data-[state=active]:text-accent-foreground data-[state=active]:shadow-md">Puzzle</TabsTrigger>
            <TabsTrigger value="tictactoe" className="rounded-lg data-[state=active]:bg-card data-[state=active]:text-accent-foreground data-[state=active]:shadow-md">TicTacToe</TabsTrigger>
            <TabsTrigger value="wordscramble" className="rounded-lg data-[state=active]:bg-card data-[state=active]:text-accent-foreground data-[state=active]:shadow-md">Scramble</TabsTrigger>
            <TabsTrigger value="rps" className="rounded-lg data-[state=active]:bg-card data-[state=active]:text-accent-foreground data-[state=active]:shadow-md">RPS</TabsTrigger>
          </TabsList>
          <TabsContent value="quiz"><List entries={quizLeaderboard} /></TabsContent>
          <TabsContent value="memory"><List entries={memoryLeaderboard} /></TabsContent>
          <TabsContent value="puzzle"><List entries={puzzleLeaderboard} /></TabsContent>
          <TabsContent value="tictactoe"><List entries={tictactoeLeaderboard} /></TabsContent>
          <TabsContent value="wordscramble"><List entries={wordScrambleLeaderboard} /></TabsContent>
          <TabsContent value="rps"><List entries={rpsLeaderboard} /></TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default GameLeaderboard;