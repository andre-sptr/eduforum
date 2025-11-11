// src/components/GameLeaderboard.tsx
import {useEffect,useState} from "react";
import {useNavigate} from "react-router-dom";
import {supabase} from "@/integrations/supabase/client";
import {Card,CardContent,CardHeader,CardTitle} from "@/components/ui/card";
import {Avatar,AvatarFallback,AvatarImage} from "@/components/ui/avatar";
import {Trophy,Medal,Award} from "lucide-react";
import {Tabs,TabsContent,TabsList,TabsTrigger} from "@/components/ui/tabs";
import {toast} from "sonner";
import {cn} from "@/lib/utils";
import {ScrollArea,ScrollBar} from "@/components/ui/scroll-area";

interface LeaderboardEntry{
  user_id:string;
  score:number;
  game_type:string;
  profiles:{full_name:string;avatar_url?:string;role:string};
}

const GAME_CONFIG:{value:string;label:string}[]=[
  {value:"quiz",label:"Quiz"},
  {value:"memory",label:"Memory"},
  {value:"puzzle",label:"Puzzle"},
  {value:"reaction",label:"Reaction"},
  {value:"pattern",label:"Pattern"},
  {value:"typing",label:"Typing"},
  {value:"tictactoe",label:"TicTacToe"},
  {value:"wordscramble",label:"Scramble"},
  {value:"rps",label:"RPS"},
];

const SUPPORTED_TYPES=GAME_CONFIG.map(g=>g.value);

const GameLeaderboard=()=>{
  const navigate=useNavigate();
  const [leaderboards,setLeaderboards]=useState<Record<string,LeaderboardEntry[]>>({});
  const [loading,setLoading]=useState(true);

  useEffect(()=>{loadLeaderboards();},[]);

  const loadLeaderboards=async()=>{
    try{
      const {data:allScores,error}=await supabase
        .from("game_scores")
        .select("user_id,score,game_type")
        .in("game_type",SUPPORTED_TYPES)
        .order("score",{ascending:false})
        .limit(1000);
      if(error)throw error;

      const ids=[...(new Set((allScores||[]).map(s=>s.user_id)))];
      const {data:profiles}=await supabase
        .from("profiles")
        .select("id,full_name,avatar_url,role")
        .in("id",ids);

      const pmap=new Map((profiles||[]).map(p=>[p.id,p]));
      const withP=(arr:any[]=[])=>arr.map(s=>({...s,profiles:pmap.get(s.user_id)||{full_name:"Unknown User",avatar_url:undefined,role:"siswa"}}));
      const top=(arr:LeaderboardEntry[])=>{const m=new Map<string,LeaderboardEntry>();arr.forEach(e=>{const ex=m.get(e.user_id);if(!ex||e.score>ex.score)m.set(e.user_id,e)});return [...m.values()].sort((a,b)=>b.score-a.score).slice(0,10);};
      const filterByType=(t:string)=>(allScores||[]).filter(s=>s.game_type===t);

      const next:Record<string,LeaderboardEntry[]>=SUPPORTED_TYPES.reduce((acc,t)=>{acc[t]=top(withP(filterByType(t)));return acc;},{} as Record<string,LeaderboardEntry[]>);
      setLeaderboards(next);
    }catch(e:any){
      toast.error("Gagal memuat leaderboard: "+e.message);
    }finally{
      setLoading(false);
    }
  };

  const initials=(n:string)=>{const a=n.split(" ");return((a[0]?.[0]||"")+(a[1]?.[0]||"").toUpperCase())||"U";};
  const rankIcon=(i:number)=>i===0?<Trophy className="h-4 w-4 text-accent"/>:i===1?<Medal className="h-4 w-4 text-gray-400"/>:i===2?<Award className="h-4 w-4 text-amber-600"/>:<span className="font-bold text-muted-foreground text-xs">#{i+1}</span>;
  const roleChip=(r:string)=>r==="guru"?"bg-emerald-500/10 text-emerald-400":"bg-sky-500/10 text-sky-400";

  const List=({entries}:{entries:LeaderboardEntry[]})=>{
    if(loading)return(<div className="py-10 text-center"><div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-accent"/><p className="mt-2 text-sm text-muted-foreground">Memuat...</p></div>);
    if(!entries.length)return(<p className="py-10 text-center text-sm text-muted-foreground">Belum ada data leaderboard</p>);
    return(
      <div className="space-y-2">
        {entries.map((e,i)=>{
          const rankStyle=cn("w-full flex items-center gap-4 p-3 text-left transition-all duration-150 rounded-xl border-2",i===0?"border-accent/30 bg-accent/5 hover:bg-accent/10 hover:shadow-lg":i===1?"border-gray-400/30 bg-gray-500/5 hover:bg-gray-500/10":i===2?"border-amber-600/30 bg-amber-600/5 hover:bg-amber-600/10":"border-transparent hover:bg-muted/50");
          return(
            <button key={e.user_id} onClick={()=>navigate(`/profile/${e.user_id}`)} className={rankStyle}>
              <div className="w-6 flex-shrink-0 flex justify-center items-center">{rankIcon(i)}</div>
              <Avatar className="h-10 w-10 ring-2 ring-accent/20">
                <AvatarImage src={e.profiles.avatar_url??undefined}/>
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

  return(
    <Card className="border-border bg-card/80 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-3 text-xl">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 text-accent ring-1 ring-border"><Trophy className="h-5 w-5"/></span>
          Leaderboard per Game
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="quiz" className="w-full">
          <ScrollArea className="w-full whitespace-nowrap rounded-xl bg-muted/60 p-1 mb-4">
            <TabsList className="flex w-max space-x-1 bg-transparent p-0">
              {GAME_CONFIG.map(g=>(
                <TabsTrigger key={g.value} value={g.value} className="rounded-lg data-[state=active]:bg-card data-[state=active]:text-accent-foreground data-[state=active]:shadow-md">{g.label}</TabsTrigger>
              ))}
            </TabsList>
            <ScrollBar orientation="horizontal" className="h-2"/>
          </ScrollArea>
          {GAME_CONFIG.map(g=>(
            <TabsContent key={g.value} value={g.value}><List entries={leaderboards[g.value]??[]}/></TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default GameLeaderboard;
