// ColorMatch.tsx
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Play, RotateCcw } from "lucide-react";

interface ColorMatchProps { onScoreSubmit:(score:number)=>void }
const COLORS=[{name:"Merah",color:"bg-red-500",text:"text-red-500"},{name:"Biru",color:"bg-blue-500",text:"text-blue-500"},{name:"Hijau",color:"bg-green-500",text:"text-green-500"},{name:"Kuning",color:"bg-yellow-500",text:"text-yellow-500"},{name:"Ungu",color:"bg-purple-500",text:"text-purple-500"}];

export default function ColorMatch({onScoreSubmit}:ColorMatchProps){
  const [gameState,setGameState]=useState<"idle"|"playing"|"finished">("idle");
  const [wordColor,setWordColor]=useState(""),[displayColor,setDisplayColor]=useState("");
  const [score,setScore]=useState(0),[timeLeft,setTimeLeft]=useState(30),[streak,setStreak]=useState(0);

  useEffect(()=>{let t:any;if(gameState==="playing"&&timeLeft>0){t=setInterval(()=>setTimeLeft(p=>{if(p<=1){finishGame();return 0}return p-1}),1000)}return()=>clearInterval(t)},[gameState,timeLeft]);

  const nextRound=()=>{const w=COLORS[Math.floor(Math.random()*COLORS.length)],d=COLORS[Math.floor(Math.random()*COLORS.length)];setWordColor(w.name);setDisplayColor(d.text)};
  const initializeGame=()=>{setScore(0);setTimeLeft(30);setStreak(0);setGameState("playing");nextRound()};
  const finishGame=()=>{setGameState("finished");onScoreSubmit(score)};
  const handleAnswer=(isMatch:boolean)=>{const actualMatch=wordColor===COLORS.find(c=>c.text===displayColor)?.name; if((isMatch&&actualMatch)||(!isMatch&&!actualMatch)){const pts=10+streak*2;setScore(v=>v+pts);setStreak(v=>v+1)}else setStreak(0);nextRound()};

  if(gameState==="idle")return(<div className="grid place-items-center gap-4 py-10 text-center"><p className="text-muted-foreground">Cocokkan kata dengan warna dalam 30 detik!</p><Button onClick={initializeGame} size="lg" className="rounded-2xl bg-accent text-accent-foreground hover:bg-accent/90"><Play className="mr-2 h-4 w-4"/>Mulai Game</Button></div>);
  if(gameState==="finished")return(<div className="grid place-items-center gap-4 py-10 text-center"><div><div className="mb-1 text-4xl font-extrabold tracking-tight text-accent">{score}</div><p className="text-muted-foreground">Skor Akhir</p></div><Button onClick={initializeGame} size="lg" className="rounded-2xl bg-accent text-accent-foreground hover:bg-accent/90"><RotateCcw className="mr-2 h-4 w-4"/>Main Lagi</Button></div>);

  return (
    <div className="space-y-5">
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted"><div className="h-full bg-accent transition-[width] duration-1000" style={{width:`${(timeLeft/30)*100}%`}}/></div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Waktu: <span className="font-bold text-foreground">{timeLeft}s</span></span>
        <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">Skor <span className="ml-1 text-base">{score}</span></span>
        <span className="text-muted-foreground">Streak: <span className="font-bold">{streak}</span></span>
      </div>
      <div className="rounded-2xl border border-border bg-card/60 p-8 text-center">
        <p className="mb-3 text-sm text-muted-foreground">Apakah kata dan warna cocok?</p>
        <p className={`mx-auto select-none text-5xl font-extrabold tracking-tight drop-shadow-sm transition-transform duration-200 ${displayColor}`}>{wordColor}</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Button onClick={()=>handleAnswer(true)} className="h-16 rounded-2xl text-lg shadow hover:shadow-md">Cocok ✓</Button>
        <Button onClick={()=>handleAnswer(false)} className="h-16 rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow hover:shadow-md">Tidak ✗</Button>
      </div>
    </div>
  );
}
