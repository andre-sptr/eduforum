import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Brain, Zap, Target, ArrowLeft, Medal } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import QuizGame from "@/components/games/QuizGame";
import MemoryGame from "@/components/games/MemoryGame";
import NumberPuzzle from "@/components/games/NumberPuzzle";
import ColorMatch from "@/components/games/ColorMatch";
import GameLeaderboard from "@/components/GameLeaderboard";

const Games = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userStats, setUserStats] = useState({ totalGames: 0, highestScore: 0, averageScore: 0, ranking: 0 });
  const [topUsers, setTopUsers] = useState<any[]>([]);
  const [loadingTop, setLoadingTop] = useState(false);

  useEffect(() => { checkUser(); }, []);
  useEffect(() => { if (currentUser) { fetchUserStats(); fetchTopUsers(); } }, [currentUser]);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/auth"); return; }
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    setCurrentUser(profile); setLoading(false);
  };

  const fetchUserStats = async () => {
    if (!currentUser) return;
    try {
      const { data: scores, error } = await supabase.from("game_scores").select("score").eq("user_id", currentUser.id);
      if (error) throw error;
      if (scores?.length) {
        const totalGames = scores.length;
        const highestScore = Math.max(...scores.map(s => s.score));
        const averageScore = Math.round(scores.reduce((a, b) => a + b.score, 0) / totalGames);
        const { data: allUsers } = await supabase.from("game_scores").select("user_id, score");
        if (allUsers) {
          const map = new Map<string, { total: number; count: number }>();
          allUsers.forEach(s => { const e = map.get(s.user_id) || { total: 0, count: 0 }; map.set(s.user_id, { total: e.total + s.score, count: e.count + 1 }); });
          const ranks = Array.from(map.entries()).map(([userId, d]) => ({ userId, avg: d.total / d.count }))
            .sort((a, b) => b.avg - a.avg);
          const ranking = ranks.findIndex(u => u.userId === currentUser.id) + 1;
          setUserStats({ totalGames, highestScore, averageScore, ranking });
        } else setUserStats({ totalGames, highestScore, averageScore, ranking: 1 });
      }
    } catch {}
  };

  const fetchTopUsers = async () => {
    try {
      setLoadingTop(true);
      const { data: allScores, error } = await supabase.from("game_scores").select("user_id, score");
      if (error) throw error;
      if (allScores?.length) {
        const map = new Map<string, { total: number; count: number }>();
        allScores.forEach(s => { const e = map.get(s.user_id) || { total: 0, count: 0 }; map.set(s.user_id, { total: e.total + s.score, count: e.count + 1 }); });
        const averages = Array.from(map.entries()).map(([userId, d]) => ({ userId, average: Math.round(d.total / d.count), totalGames: d.count }))
          .sort((a, b) => b.average - a.average).slice(0, 5);
        const userIds = averages.map(u => u.userId);
        const { data: profiles } = await supabase.from("profiles").select("id, full_name, avatar_url").in("id", userIds);
        if (profiles) {
          const top = averages.map((u, i) => {
            const p = profiles.find(pp => pp.id === u.userId);
            return { ...u, rank: i + 1, full_name: p?.full_name || "Unknown User", avatar_url: p?.avatar_url };
          });
          setTopUsers(top);
        }
      } else setTopUsers([]);
    } catch {
      setTopUsers([]);
    } finally { setLoadingTop(false); }
  };

  const handleScoreSubmit = async (gameType: string, score: number) => {
    if (!currentUser) return;
    try {
      const { error } = await supabase.from("game_scores").insert({ user_id: currentUser.id, game_type: gameType, score });
      if (error) throw error;
      toast.success("Skor berhasil disimpan!");
      fetchUserStats(); fetchTopUsers();
    } catch (e:any) { toast.error(e.message); }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto" />
          <p className="mt-4 text-muted-foreground">Memuat games...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card border-b border-border shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}><ArrowLeft className="h-5 w-5" /></Button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Trophy className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Mini-Games</h1>
                <p className="text-sm text-muted-foreground">Asah otak sambil bersenang-senang</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Tabs defaultValue="games" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="games" className="gap-2"><Target className="h-4 w-4" />Games</TabsTrigger>
            <TabsTrigger value="leaderboard" className="gap-2"><Trophy className="h-4 w-4" />Leaderboard</TabsTrigger>
          </TabsList>

          <TabsContent value="games" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="bg-card border-border"><CardHeader><CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5 text-primary" />Quiz Pengetahuan</CardTitle><CardDescription>Uji pengetahuan umum Anda</CardDescription></CardHeader><CardContent><QuizGame onScoreSubmit={(s)=>handleScoreSubmit("quiz",s)}/></CardContent></Card>
              <Card className="bg-card border-border"><CardHeader><CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-accent" />Memory Match</CardTitle><CardDescription>Cocokkan kartu dengan cepat</CardDescription></CardHeader><CardContent><MemoryGame onScoreSubmit={(s)=>handleScoreSubmit("memory",s)}/></CardContent></Card>
              <Card className="bg-card border-border"><CardHeader><CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-primary" />Number Puzzle</CardTitle><CardDescription>Susun angka 1-8 berurutan</CardDescription></CardHeader><CardContent><NumberPuzzle onScoreSubmit={(s)=>handleScoreSubmit("puzzle",s)}/></CardContent></Card>
              <Card className="bg-card border-border"><CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-accent" />Color Match</CardTitle><CardDescription>Cocokkan kata dengan warna</CardDescription></CardHeader><CardContent><ColorMatch onScoreSubmit={(s)=>handleScoreSubmit("color",s)}/></CardContent></Card>
            </div>

            <Card className="bg-card border-border">
              <CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-accent" />Statistik Anda</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-muted rounded-lg"><p className="text-2xl font-bold text-accent">{userStats.totalGames||"-"}</p><p className="text-sm text-muted-foreground">Total Games</p></div>
                  <div className="text-center p-4 bg-muted rounded-lg"><p className="text-2xl font-bold text-primary">{userStats.highestScore||"-"}</p><p className="text-sm text-muted-foreground">Skor Tertinggi</p></div>
                  <div className="text-center p-4 bg-muted rounded-lg"><p className="text-2xl font-bold text-foreground">{userStats.averageScore||"-"}</p><p className="text-sm text-muted-foreground">Rata-rata</p></div>
                  <div className="text-center p-4 bg-muted rounded-lg"><p className="text-2xl font-bold text-accent">{userStats.ranking||"-"}</p><p className="text-sm text-muted-foreground">Ranking</p></div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border" aria-busy={loadingTop}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Medal className="h-5 w-5 text-primary" />
                  Top 5 Pemain
                </CardTitle>
                <CardDescription>Pemain dengan rata-rata skor tertinggi</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingTop ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-4 p-3 bg-muted/60 rounded-lg">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10" />
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="flex-1 min-w-0 space-y-2">
                          <Skeleton className="h-4 w-2/3" />
                          <Skeleton className="h-3 w-1/3" />
                        </div>
                        <div className="text-right">
                          <Skeleton className="h-6 w-12 rounded-md" />
                          <Skeleton className="mt-1 h-3 w-10 rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : topUsers.length > 0 ? (
                  <div className="space-y-3">
                    {topUsers.map(user => (
                      <div key={user.userId} className="flex items-center gap-4 p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">{user.rank}</div>
                        <Avatar className="h-10 w-10"><AvatarImage src={user.avatar_url} alt={user.full_name} /><AvatarFallback>{user.full_name?.charAt(0)}</AvatarFallback></Avatar>
                        <div className="flex-1 min-w-0"><p className="font-semibold text-foreground truncate">{user.full_name}</p><p className="text-sm text-muted-foreground">{user.totalGames} game{user.totalGames>1?"s":""}</p></div>
                        <div className="text-right"><p className="text-xl font-bold text-accent">{user.average}</p><p className="text-xs text-muted-foreground">Rata-rata</p></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">Belum ada data leaderboard</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leaderboard">
            <GameLeaderboard />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Games;