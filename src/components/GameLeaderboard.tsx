import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Medal, Award } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface LeaderboardEntry { user_id:string; score:number; game_type:string; profiles:{ full_name:string; avatar_url?:string; role:string } }

const GameLeaderboard = () => {
  const navigate=useNavigate();
  const [quizLeaderboard,setQuizLeaderboard]=useState<LeaderboardEntry[]>([]);
  const [memoryLeaderboard,setMemoryLeaderboard]=useState<LeaderboardEntry[]>([]);
  const [puzzleLeaderboard,setPuzzleLeaderboard]=useState<LeaderboardEntry[]>([]);
  const [colorLeaderboard,setColorLeaderboard]=useState<LeaderboardEntry[]>([]);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{ loadLeaderboards(); },[]);
  const loadLeaderboards=async()=>{ try{
    const {data:quiz}=await supabase.from("game_scores").select("user_id, score, game_type").eq("game_type","quiz").order("score",{ascending:false}).limit(50);
    const {data:mem }=await supabase.from("game_scores").select("user_id, score, game_type").eq("game_type","memory").order("score",{ascending:false}).limit(50);
    const {data:puz }=await supabase.from("game_scores").select("user_id, score, game_type").eq("game_type","puzzle").order("score",{ascending:false}).limit(50);
    const {data:col }=await supabase.from("game_scores").select("user_id, score, game_type").eq("game_type","color").order("score",{ascending:false}).limit(50);
    const ids=new Set([...(quiz?.map(s=>s.user_id)||[]),...(mem?.map(s=>s.user_id)||[]),...(puz?.map(s=>s.user_id)||[]),...(col?.map(s=>s.user_id)||[])]);
    const {data:profiles}=await supabase.from("profiles").select("id, full_name, avatar_url, role").in("id",Array.from(ids));
    const pmap=new Map((profiles||[]).map(p=>[p.id,p]));
    const withP=(arr:any[]=[])=>arr.map(s=>({...s,profiles:pmap.get(s.user_id)||{full_name:"Unknown User",avatar_url:undefined,role:"siswa"}}));
    const top=(arr:LeaderboardEntry[])=>{ const m=new Map<string,LeaderboardEntry>(); arr.forEach(e=>{const ex=m.get(e.user_id); if(!ex||e.score>ex.score)m.set(e.user_id,e)}); return Array.from(m.values()).sort((a,b)=>b.score-a.score).slice(0,10); };
    setQuizLeaderboard(top(withP(quiz))); setMemoryLeaderboard(top(withP(mem))); setPuzzleLeaderboard(top(withP(puz))); setColorLeaderboard(top(withP(col)));
  }finally{ setLoading(false); }};

  const initials=(n:string)=>{const a=n.split(" ");return a.length>=2?(a[0][0]+a[1][0]).toUpperCase():n.slice(0,2).toUpperCase();};
  const rankIcon=(i:number)=>i===0?<Trophy className="h-5 w-5 text-accent"/>:i===1?<Medal className="h-5 w-5 text-gray-400"/>:i===2?<Award className="h-5 w-5 text-amber-600"/>:<span className="font-bold text-muted-foreground">#{i+1}</span>;
  const roleChip=(r:string)=>r==="guru"?"bg-emerald-500/10 text-emerald-400":"bg-sky-500/10 text-sky-400";

  const List=({entries}:{entries:LeaderboardEntry[]})=>{
    if(loading) return <div className="py-10 text-center"><div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-accent"/><p className="mt-2 text-sm text-muted-foreground">Memuat...</p></div>;
    if(!entries.length) return <p className="py-10 text-center text-sm text-muted-foreground">Belum ada data leaderboard</p>;
    const max=Math.max(...entries.map(e=>e.score));
    return (
      <div className="space-y-3">
        {entries.map((e,i)=>(
          <button key={e.user_id} onClick={()=>navigate(`/profile/${e.user_id}`)} className="w-full rounded-2xl border border-border/70 bg-gradient-to-r from-card/70 to-card/40 p-3 text-left transition hover:shadow-md hover:from-card/90">
            <div className="flex items-center gap-3">
              <div className="w-6 flex-shrink-0">{rankIcon(i)}</div>
              <Avatar className="h-10 w-10 ring-2 ring-accent/20">
                <AvatarImage src={e.profiles.avatar_url}/>
                <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">{initials(e.profiles.full_name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold">{e.profiles.full_name}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${roleChip(e.profiles.role)}`}>{e.profiles.role}</span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-accent transition-[width]" style={{width:`${(e.score/max)*100}%`}}/>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-accent leading-none">{e.score}</p>
                <p className="text-xs text-muted-foreground">poin</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    );
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-xl">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent/10 text-accent"><Trophy className="h-5 w-5"/></span>
          Leaderboard Games
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="quiz" className="w-full">
          <TabsList className="mb-4 grid w-full grid-cols-4 rounded-xl">
            <TabsTrigger value="quiz">Quiz</TabsTrigger>
            <TabsTrigger value="memory">Memory</TabsTrigger>
            <TabsTrigger value="puzzle">Puzzle</TabsTrigger>
            <TabsTrigger value="color">Color</TabsTrigger>
          </TabsList>
          <TabsContent value="quiz"><List entries={quizLeaderboard}/></TabsContent>
          <TabsContent value="memory"><List entries={memoryLeaderboard}/></TabsContent>
          <TabsContent value="puzzle"><List entries={puzzleLeaderboard}/></TabsContent>
          <TabsContent value="color"><List entries={colorLeaderboard}/></TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default GameLeaderboard;