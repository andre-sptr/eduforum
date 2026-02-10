import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Brain, Zap, Target, ArrowLeft, Medal, Award, Hash, CaseUpper, Scissors, Keyboard, MousePointerClick, Sparkles, Loader2, Gamepad2, Search } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import QuizGame from "@/components/games/QuizGame";
import MemoryGame from "@/components/games/MemoryGame";
import NumberPuzzle from "@/components/games/NumberPuzzle";
import GameLeaderboard from "@/components/GameLeaderboard";
import TicTacToe from "@/components/games/TicTacToe";
import WordScramble from "@/components/games/WordScramble";
import RockPaperScissors from "@/components/games/RockPaperScissors";
import ReactionGame from "@/components/games/ReactionGame";
import PatternGame from "@/components/games/PatternGame";
import TypingTest from "@/components/games/TypingTest";
import { useGames, Game } from "@/hooks/useGames";
import { GameCard } from "@/components/GameCard";

type Profile = { id: string; full_name: string; avatar_url?: string | null };
type ScoreRow = { user_id: string; score: number };
type UserStats = { totalGames: number; highestScore: number; averageScore: number; ranking: number };
type TopUser = { userId: string; average: number; totalGames: number; rank: number; full_name: string; avatar_url?: string | null };

const Games = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [userStats, setUserStats] = useState<UserStats>({ totalGames: 0, highestScore: 0, averageScore: 0, ranking: 0 });
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [loadingTop, setLoadingTop] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const initials = (n: string) => { const a = n.split(" "); return a.length >= 2 ? (a[0][0] + a[1][0]).toUpperCase() : n.slice(0, 2).toUpperCase(); };
  const rankIcon = (i: number) => i === 0 ? <Trophy className="h-5 w-5 text-accent" /> : i === 1 ? <Medal className="h-5 w-5 text-gray-400" /> : i === 2 ? <Award className="h-5 w-5 text-amber-600" /> : <span className="font-bold text-muted-foreground">#{i + 1}</span>;

  const handleScoreSubmit = async (gameType: string, score: number) => {
    if (!currentUser) return;
    try {
      const { error } = await supabase.from("game_scores").insert({ user_id: currentUser.id, game_type: gameType, score });
      if (error) throw error;
      toast.success("Skor berhasil disimpan!");
      fetchUserStats(); fetchTopUsers();
    } catch (e: any) { toast.error(e.message || "Gagal menyimpan skor"); }
  };

  const allGameData: Game[] = [
    { id: "quiz", title: "Quiz Pengetahuan", description: "Uji pengetahuan umum Anda dengan berbagai pertanyaan menantang.", category: "single", icon: <Brain className="h-6 w-6" />, component: <QuizGame onScoreSubmit={s => handleScoreSubmit("quiz", s)} /> },
    { id: "memory", title: "Memory Match", description: "Latih daya ingat Anda dengan mencocokkan kartu secepat mungkin.", category: "single", icon: <Zap className="h-6 w-6" />, component: <MemoryGame onScoreSubmit={s => handleScoreSubmit("memory", s)} /> },
    { id: "puzzle", title: "Number Puzzle", description: "Urutkan angka 1-8 dengan langkah sesedikit mungkin.", category: "single", icon: <Target className="h-6 w-6" />, component: <NumberPuzzle onScoreSubmit={s => handleScoreSubmit("puzzle", s)} /> },
    { id: "reaction", title: "Reaction Game", description: "Uji refleks Anda! Klik target yang muncul secepat kilat.", category: "single", icon: <MousePointerClick className="h-6 w-6" />, component: <ReactionGame onScoreSubmit={s => handleScoreSubmit("reaction", s)} /> },
    { id: "pattern", title: "Pattern Memory", description: "Ingat urutan pola warna dan ulangi dengan benar.", category: "single", icon: <Sparkles className="h-6 w-6" />, component: <PatternGame onScoreSubmit={s => handleScoreSubmit("pattern", s)} /> },
    { id: "typing", title: "Typing Test", description: "Seberapa cepat Anda mengetik? Ukur WPM Anda sekarang!", category: "single", icon: <Keyboard className="h-6 w-6" />, component: <TypingTest onScoreSubmit={s => handleScoreSubmit("typing", s)} /> },
    {
      id: "tictactoe", title: "Tic Tac Toe", description: "Permainan klasik X dan O. Tantang teman atau AI.", category: "multi",
      badge: { cls: "bg-emerald-500/15 ring-emerald-500/30 text-emerald-600", icon: <Hash className="h-5 w-5" /> },
      wrapColor: "from-emerald-500/20 via-transparent to-cyan-500/20",
      component: currentUser && <TicTacToe currentUserId={currentUser.id} onScoreSubmit={s => handleScoreSubmit("tictactoe", s)} />
    },
    {
      id: "wordscramble", title: "Word Scramble", description: "Susun kembali huruf-huruf acak menjadi kata yang benar.", category: "multi",
      badge: { cls: "bg-amber-500/15 ring-amber-500/30 text-amber-600", icon: <CaseUpper className="h-5 w-5" /> },
      wrapColor: "from-amber-500/20 via-transparent to-rose-500/20",
      component: currentUser && <WordScramble currentUserId={currentUser.id} onScoreSubmit={s => handleScoreSubmit("wordscramble", s)} />
    },
    {
      id: "rps", title: "Rock Paper Scissors", description: "Batu, Gunting, Kertas! Menangkan pertandingan Best of 3.", category: "multi",
      badge: { cls: "bg-indigo-500/15 ring-indigo-500/30 text-indigo-600", icon: <Scissors className="h-5 w-5" /> },
      wrapColor: "from-indigo-500/20 via-transparent to-fuchsia-500/20",
      component: currentUser && <RockPaperScissors currentUserId={currentUser.id} onScoreSubmit={s => handleScoreSubmit("rps", s)} />
    },
  ];

  const filteredGames = allGameData.filter(g => 
    g.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    g.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const { games, loading: loadingGames, hasMore, favorites, toggleFavorite, loadMore } = useGames(filteredGames);
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { navigate("/auth"); return; }
        const { data: profile, error } = await supabase.from("profiles").select("id,full_name,avatar_url").eq("id", user.id).single();
        if (error || !profile) { toast.error("Gagal memuat profil"); return; }
        if (alive) setCurrentUser(profile);
      } catch (e: any) {
        toast.error(e?.message ?? "Terjadi kesalahan saat memuat profil");
      } finally {
        if (alive) setLoadingUser(false);
      }
    })();
    return () => { alive = false; };
  }, [navigate]);

  useEffect(() => { if (currentUser) { fetchUserStats(); fetchTopUsers(); } }, [currentUser?.id]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loadingGames) {
          loadMore();
        }
      },
      { threshold: 1.0 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loadingGames, loadMore]);

  const fetchUserStats = async () => {
    if (!currentUser) return;
    try {
      const [{ data: scoresUser, error: err1 }, { data: allScores, error: err2 }] = await Promise.all([
        supabase.from("game_scores").select("score").eq("user_id", currentUser.id),
        supabase.from("game_scores").select("user_id,score")
      ]);
      if (err1 || err2) throw err1 || err2;
      const su = (scoresUser || []) as { score: number }[];
      if (su.length === 0) { setUserStats({ totalGames: 0, highestScore: 0, averageScore: 0, ranking: 0 }); return; }
      const totalGames = su.length;
      const highestScore = Math.max(...su.map(s => s.score));
      const averageScore = Math.round(su.reduce((a, b) => a + b.score, 0) / totalGames);
      const map = new Map<string, { total: number; count: number }>();
      (allScores || [] as ScoreRow[]).forEach(s => { const e = map.get(s.user_id) || { total: 0, count: 0 }; map.set(s.user_id, { total: e.total + s.score, count: e.count + 1 }); });
      const ranks = Array.from(map.entries()).map(([userId, d]) => ({ userId, avg: d.total / d.count })).sort((a, b) => b.avg - a.avg);
      const ranking = Math.max(1, ranks.findIndex(u => u.userId === currentUser.id) + 1);
      setUserStats({ totalGames, highestScore, averageScore, ranking });
    } catch (e: any) { toast.error(e.message || "Gagal memuat statistik"); }
  };

  const fetchTopUsers = async () => {
    try {
      setLoadingTop(true);
      const { data: allScores, error } = await supabase.from("game_scores").select("user_id,score");
      if (error) throw error;
      const map = new Map<string, { total: number; count: number }>();
      (allScores || [] as ScoreRow[]).forEach(s => { const e = map.get(s.user_id) || { total: 0, count: 0 }; map.set(s.user_id, { total: e.total + s.score, count: e.count + 1 }); });
      const averages = Array.from(map.entries()).map(([userId, d]) => ({ userId, average: Math.round(d.total / d.count), totalGames: d.count })).sort((a, b) => b.average - a.average).slice(0, 5);
      if (averages.length === 0) { setTopUsers([]); return; }
      const userIds = averages.map(u => u.userId);
      const { data: profiles } = await supabase.from("profiles").select("id,full_name,avatar_url").in("id", userIds);
      const top = averages.map((u, i) => { const p = (profiles || [] as Profile[]).find(pp => pp.id === u.userId); return { ...u, rank: i + 1, full_name: p?.full_name || "Unknown User", avatar_url: p?.avatar_url }; }) as TopUser[];
      setTopUsers(top);
    } catch (e: any) { toast.error(e.message || "Gagal memuat leaderboard"); setTopUsers([]); }
    finally { setLoadingTop(false); }
  };

  if (loadingUser) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
        <p className="mt-4 text-muted-foreground">Memuat profil...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="rounded-xl"><ArrowLeft className="h-5 w-5" /></Button>
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
                    <Gamepad2 className="w-6 h-6 text-primary-foreground" />
                </div>
                <div>
                    <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Arcade Zone</h1>
                    <p className="text-xs text-muted-foreground">Mainkan, Bersaing, dan Menangkan!</p>
                </div>
            </div>
          </div>
          
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
                placeholder="Cari game..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 rounded-xl bg-card/50 border-border focus:ring-primary/20"
            />
          </div>
      </div>

      <div className="space-y-6">
        <Tabs defaultValue="games" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6 bg-muted/60 p-1 h-auto rounded-xl">
            <TabsTrigger value="games" className="gap-2 rounded-lg py-2 data-[state=active]:bg-card data-[state=active]:text-accent-foreground data-[state=active]:shadow-md transition-all"><Target className="h-4 w-4" />Games Library</TabsTrigger>
            <TabsTrigger value="leaderboard" className="gap-2 rounded-lg py-2 data-[state=active]:bg-card data-[state=active]:text-accent-foreground data-[state=active]:shadow-md transition-all"><Trophy className="h-4 w-4" />Leaderboard</TabsTrigger>
          </TabsList>

          <TabsContent value="games" className="space-y-8 animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
            {games.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {games.map((game) => (
                    <GameCard 
                        key={game.id} 
                        game={game} 
                        isFavorite={favorites.includes(game.id)}
                        onToggleFavorite={toggleFavorite}
                    />
                ))}
                </div>
            ) : (
                <div className="text-center py-12 text-muted-foreground bg-card/30 rounded-2xl border border-dashed border-border">
                    <p>Tidak ada game yang ditemukan.</p>
                </div>
            )}

            { }
            <div ref={observerTarget} className="h-10 flex items-center justify-center">
                {loadingGames && <Loader2 className="h-6 w-6 animate-spin text-primary" />}
            </div>

            { }
            <Card className="bg-card border-border shadow-sm overflow-hidden" aria-busy={loadingTop}>
              <CardHeader className="bg-muted/30 pb-4">
                <CardTitle className="flex items-center gap-2 text-lg"><Medal className="h-5 w-5 text-primary" />Hall of Fame</CardTitle>
                <CardDescription>Top 5 pemain dengan rata-rata skor tertinggi</CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                {loadingTop ? (
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-4 p-3 bg-muted/60 rounded-xl animate-pulse">
                        <div className="w-8 h-8 rounded-full bg-muted" />
                        <div className="flex-1 space-y-2"><div className="h-4 w-1/3 bg-muted rounded" /><div className="h-3 w-1/4 bg-muted rounded" /></div>
                      </div>
                    ))}
                  </div>
                ) : topUsers.length > 0 ? (
                  <div className="space-y-3">
                    {topUsers.map(u => (
                      <Link key={u.userId} to={`/profile/${u.userId}`} className="flex items-center gap-4 p-3 bg-card hover:bg-accent/5 border border-transparent hover:border-accent/20 rounded-xl transition-all group">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">{rankIcon(u.rank - 1)}</div>
                        <Avatar className="h-10 w-10 ring-2 ring-transparent group-hover:ring-primary/30 transition-all">
                          <AvatarImage src={u.avatar_url || undefined} alt={u.full_name} />
                          <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">{initials(u.full_name)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">{u.full_name}</p>
                          <p className="text-xs text-muted-foreground">{u.totalGames} games played</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-accent">{u.average}</p>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Avg Score</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">Belum ada data leaderboard</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leaderboard"><GameLeaderboard /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Games;
