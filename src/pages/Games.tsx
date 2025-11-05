import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Brain, Zap, Target, ArrowLeft, Medal, Award, Hash, CaseUpper, Scissors } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import QuizGame from "@/components/games/QuizGame";
import MemoryGame from "@/components/games/MemoryGame";
import NumberPuzzle from "@/components/games/NumberPuzzle";
import GameLeaderboard from "@/components/GameLeaderboard";
import TicTacToe from "@/components/games/TicTacToe";
import WordScramble from "@/components/games/WordScramble";
import RockPaperScissors from "@/components/games/RockPaperScissors";

type Profile={id:string;full_name:string;avatar_url?:string|null};
type ScoreRow={user_id:string;score:number};
type UserStats={totalGames:number;highestScore:number;averageScore:number;ranking:number};
type TopUser={userId:string;average:number;totalGames:number;rank:number;full_name:string;avatar_url?:string|null};

const Games=()=>{
  const navigate=useNavigate();
  const [currentUser,setCurrentUser]=useState<Profile|null>(null);
  const [loading,setLoading]=useState(true);
  const [userStats,setUserStats]=useState<UserStats>({totalGames:0,highestScore:0,averageScore:0,ranking:0});
  const [topUsers,setTopUsers]=useState<TopUser[]>([]);
  const [loadingTop,setLoadingTop]=useState(false);
  const initials=(n:string)=>{const a=n.split(" ");return a.length>=2?(a[0][0]+a[1][0]).toUpperCase():n.slice(0,2).toUpperCase();};

  const rankIcon=(i:number)=>i===0
    ?<Trophy className="h-5 w-5 text-accent"/>
    :i===1
      ?<Medal className="h-5 w-5 text-gray-400"/>
      :i===2
        ?<Award className="h-5 w-5 text-amber-600"/>
        :<span className="font-bold text-muted-foreground">#{i+1}</span>;

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate("/auth");
          return;
        }
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("id,full_name,avatar_url")
          .eq("id", user.id)
          .single();

        if (error || !profile) {
          toast.error("Gagal memuat profil");
          return;
        }
        if (alive) setCurrentUser(profile);
      } catch (e: any) {
        toast.error(e?.message ?? "Terjadi kesalahan saat memuat profil");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [navigate]);

  useEffect(()=>{if(currentUser){fetchUserStats();fetchTopUsers()}},[currentUser?.id]);

  const fetchUserStats=async()=>{
    if(!currentUser) return;
    try{
      const [{data:scoresUser,error:err1},{data:allScores,error:err2}]=await Promise.all([
        supabase.from("game_scores").select("score").eq("user_id",currentUser.id),
        supabase.from("game_scores").select("user_id,score")
      ]);
      if(err1||err2) throw err1||err2;
      const su=(scoresUser||[]) as {score:number}[];
      if(su.length===0){setUserStats({totalGames:0,highestScore:0,averageScore:0,ranking:0});return}
      const totalGames=su.length;
      const highestScore=Math.max(...su.map(s=>s.score));
      const averageScore=Math.round(su.reduce((a,b)=>a+b.score,0)/totalGames);
      const map=new Map<string,{total:number;count:number}>();
      (allScores||[] as ScoreRow[]).forEach(s=>{const e=map.get(s.user_id)||{total:0,count:0};map.set(s.user_id,{total:e.total+s.score,count:e.count+1})});
      const ranks=Array.from(map.entries()).map(([userId,d])=>({userId,avg:d.total/d.count})).sort((a,b)=>b.avg-a.avg);
      const ranking=Math.max(1,ranks.findIndex(u=>u.userId===currentUser.id)+1);
      setUserStats({totalGames,highestScore,averageScore,ranking});
    }catch(e:any){toast.error(e.message||"Gagal memuat statistik")}
  };

  const fetchTopUsers=async()=>{
    try{
      setLoadingTop(true);
      const {data:allScores,error}=await supabase.from("game_scores").select("user_id,score");
      if(error) throw error;
      const map=new Map<string,{total:number;count:number}>();
      (allScores||[] as ScoreRow[]).forEach(s=>{const e=map.get(s.user_id)||{total:0,count:0};map.set(s.user_id,{total:e.total+s.score,count:e.count+1})});
      const averages=Array.from(map.entries()).map(([userId,d])=>({userId,average:Math.round(d.total/d.count),totalGames:d.count}))
        .sort((a,b)=>b.average-a.average).slice(0,5);
      if(averages.length===0){setTopUsers([]);return}
      const userIds=averages.map(u=>u.userId);
      const {data:profiles}=await supabase.from("profiles").select("id,full_name,avatar_url").in("id",userIds);
      const top=averages.map((u,i)=>{const p=(profiles||[] as Profile[]).find(pp=>pp.id===u.userId);return{...u,rank:i+1,full_name:p?.full_name||"Unknown User",avatar_url:p?.avatar_url}}) as TopUser[];
      setTopUsers(top);
    }catch(e:any){toast.error(e.message||"Gagal memuat leaderboard");setTopUsers([])}
    finally{setLoadingTop(false)}
  };

  const handleScoreSubmit=async(gameType:string,score:number)=>{
    if(!currentUser) return;
    try{
      const {error}=await supabase.from("game_scores").insert({user_id:currentUser.id,game_type:gameType,score});
      if(error) throw error;
      toast.success("Skor berhasil disimpan!");
      fetchUserStats();fetchTopUsers();
    }catch(e:any){toast.error(e.message||"Gagal menyimpan skor")}
  };

  if(loading){
    return(<div className="min-h-screen flex items-center justify-center bg-background"><div className="text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto"/><p className="mt-4 text-muted-foreground">Memuat games...</p></div></div>);
  }

  return(
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card border-b border-border shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={()=>navigate("/")}><ArrowLeft className="h-5 w-5"/></Button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center"><Trophy className="w-6 h-6 text-primary-foreground"/></div>
              <div><h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Mini-Games</h1><p className="text-sm text-muted-foreground">Asah otak sambil bersenang-senang</p></div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Tabs defaultValue="games" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6 bg-muted/60 p-1 h-auto rounded-xl">
            <TabsTrigger value="games" className="gap-2 rounded-lg data-[state=active]:bg-card data-[state=active]:text-accent-foreground data-[state=active]:shadow-md"><Target className="h-4 w-4"/>Games</TabsTrigger>
            <TabsTrigger value="leaderboard" className="gap-2 rounded-lg data-[state=active]:bg-card data-[state=active]:text-accent-foreground data-[state=active]:shadow-md"><Trophy className="h-4 w-4"/>Leaderboard</TabsTrigger>
          </TabsList>

          <TabsContent value="games" className="space-y-8">
            
            <h3 className="text-xl font-semibold text-muted-foreground tracking-tight">Single Player</h3>
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="bg-card border-border shadow-sm hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5 text-primary"/>Quiz Pengetahuan</CardTitle>
                  <CardDescription>Uji pengetahuan umum Anda</CardDescription>
                </CardHeader>
                <CardContent><QuizGame onScoreSubmit={s=>handleScoreSubmit("quiz",s)}/></CardContent>
              </Card>
              <Card className="bg-card border-border shadow-sm hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-accent"/>Memory Match</CardTitle>
                  <CardDescription>Cocokkan kartu dengan cepat</CardDescription>
                </CardHeader>
                <CardContent><MemoryGame onScoreSubmit={s=>handleScoreSubmit("memory",s)}/></CardContent>
              </Card>
              <Card className="bg-card border-border shadow-sm hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-primary"/>Number Puzzle</CardTitle>
                  <CardDescription>Susun angka 1-8 berurutan</CardDescription>
                </CardHeader>
                <CardContent><NumberPuzzle onScoreSubmit={s=>handleScoreSubmit("puzzle",s)}/></CardContent>
              </Card>
            </div>

            <h3 className="text-xl font-semibold text-muted-foreground tracking-tight">Multiplayer (vs)</h3>
            {currentUser ? (
              <div className="grid md:grid-cols-3 gap-6">
                {/* Tic Tac Toe */}
                <Card className="relative overflow-hidden bg-card text-foreground ring-1 ring-border shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                  <div className="pointer-events-none absolute inset-0 opacity-50 bg-gradient-to-br from-emerald-500/10 via-transparent to-cyan-500/10" />
                  <CardHeader className="relative">
                    <CardTitle className="flex items-center gap-2">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-500/30">
                        <Hash className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                      </span>
                      Tic Tac Toe
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">Lawan pemain lain</CardDescription>
                  </CardHeader>
                  <CardContent className="relative">
                    <TicTacToe currentUserId={currentUser.id} onScoreSubmit={(s)=>handleScoreSubmit("tictactoe", s)} />
                  </CardContent>
                </Card>

                {/* Word Scramble */}
                <Card className="relative overflow-hidden bg-card text-foreground ring-1 ring-border shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                  <div className="pointer-events-none absolute inset-0 opacity-50 bg-gradient-to-br from-amber-500/10 via-transparent to-rose-500/10" />
                  <CardHeader className="relative">
                    <CardTitle className="flex items-center gap-2">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 ring-1 ring-amber-500/30">
                        <CaseUpper className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                      </span>
                      Word Scramble
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">Tebak kata acak</CardDescription>
                  </CardHeader>
                  <CardContent className="relative">
                    <WordScramble currentUserId={currentUser.id} onScoreSubmit={(s)=>handleScoreSubmit("wordscramble", s)} />
                  </CardContent>
                </Card>

                {/* Rock Paper Scissors */}
                <Card className="relative overflow-hidden bg-card text-foreground ring-1 ring-border shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                  <div className="pointer-events-none absolute inset-0 opacity-50 bg-gradient-to-br from-indigo-500/10 via-transparent to-fuchsia-500/10" />
                  <CardHeader className="relative">
                    <CardTitle className="flex items-center gap-2">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/15 ring-1 ring-indigo-500/30">
                        <Scissors className="h-4 w-4 text-indigo-700 dark:text-indigo-400" />
                      </span>
                      Rock Paper Scissors
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">Best of 3</CardDescription>
                  </CardHeader>
                  <CardContent className="relative">
                    <RockPaperScissors currentUserId={currentUser.id} onScoreSubmit={(s)=>handleScoreSubmit("rps", s)} />
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="grid md:grid-cols-3 gap-6">
                {Array.from({length:3}).map((_,i)=>(
                  <Card key={i} className="bg-muted/50 ring-1 ring-border border-none">
                    <CardHeader>
                      <CardTitle className="h-6 w-40 bg-muted rounded" />
                      <CardDescription className="h-4 w-52 bg-muted rounded mt-2" />
                    </CardHeader>
                    <CardContent>
                      <div className="h-24 w-full bg-muted rounded" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <Card className="bg-card border-border" aria-busy={loadingTop}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Medal className="h-5 w-5 text-primary"/>Top 5 Pemain (Skor Rata-rata)</CardTitle>
                <CardDescription>Pemain dengan rata-rata skor tertinggi di semua game</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingTop?(
                  <div className="space-y-3">
                    {Array.from({length:5}).map((_,i)=>(
                      <div key={i} className="flex items-center gap-4 p-3 bg-muted/60 rounded-lg">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10"/>
                        <Skeleton className="h-10 w-10 rounded-full"/>
                        <div className="flex-1 min-w-0 space-y-2"><Skeleton className="h-4 w-2/3"/><Skeleton className="h-3 w-1/3"/></div>
                        <div className="text-right"><Skeleton className="h-6 w-12 rounded-md"/><Skeleton className="mt-1 h-3 w-10 rounded"/></div>
                      </div>
                    ))}
                  </div>
                ):topUsers.length>0?(
                  <div className="space-y-3">
                    {topUsers.map(u=>(
                      <Link key={u.userId} to={`/profile/${u.userId}`} className="flex items-center gap-4 p-3 bg-muted/60 rounded-lg hover:bg-muted/80 transition-colors">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                          {rankIcon(u.rank-1)}
                        </div>
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={u.avatar_url||undefined} alt={u.full_name}/>
                          <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">{initials(u.full_name)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground truncate">{u.full_name}</p>
                          <p className="text-sm text-muted-foreground">{u.totalGames} game{u.totalGames>1?"s":""}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-accent">{u.average}</p>
                          <p className="text-xs text-muted-foreground">Rata-rata</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                ):(
                  <p className="text-center text-muted-foreground py-8">Belum ada data leaderboard</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leaderboard"><GameLeaderboard/></TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Games;