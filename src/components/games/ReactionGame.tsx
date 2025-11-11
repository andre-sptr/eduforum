// ReactionGame.tsx
import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Play, RotateCcw, Target } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props{ onScoreSubmit:(score:number)=>void }
const GAME_DURATION_MS=30000,MOLE_TIME_MS=850,SECS=GAME_DURATION_MS/1000;

export default function ReactionGame({onScoreSubmit}:Props){
  const [state,setState]=useState<"idle"|"playing"|"finished">("idle");
  const [score,setScore]=useState(0);
  const [timeLeft,setTimeLeft]=useState(SECS);
  const [activeTile,setActiveTile]=useState<number|null>(null);
  const timerRef=useRef<any>(null),moleTimer=useRef<any>(null),clickable=useRef(false);

  useEffect(()=>()=>{if(timerRef.current)clearTimeout(timerRef.current);if(moleTimer.current)clearTimeout(moleTimer.current)},[]);

  const finish=useCallback(()=>{setState("finished");if(timerRef.current)clearTimeout(timerRef.current);if(moleTimer.current)clearTimeout(moleTimer.current);onScoreSubmit(score)},[score,onScoreSubmit]);

  const nextMole=useCallback(()=>{if(moleTimer.current)clearTimeout(moleTimer.current);let next=Math.floor(Math.random()*9);setActiveTile(a=>next===a?(next+1)%9:next);clickable.current=true;moleTimer.current=setTimeout(()=>{clickable.current=false;setState(s=>{if(s==="playing")nextMole();return s})},MOLE_TIME_MS)},[]);

  useEffect(()=>{if(state==="playing"){if(timeLeft>0){timerRef.current=setTimeout(()=>setTimeLeft(t=>t-1),1000)}else finish()}return()=>{if(timerRef.current)clearTimeout(timerRef.current)}},[state,timeLeft,finish]);

  useEffect(()=>{if(state==="playing")nextMole();else{if(moleTimer.current)clearTimeout(moleTimer.current);setActiveTile(null);clickable.current=false}},[state,nextMole]);

  const start=()=>{setScore(0);setTimeLeft(SECS);setActiveTile(null);setState("playing")};

  const clickTile=useCallback((i:number)=>{if(!clickable.current||i!==activeTile)return;clickable.current=false;setScore(s=>s+10);setActiveTile(null);setState(s=>{if(s==="playing"){if(moleTimer.current)clearTimeout(moleTimer.current);nextMole()}return s})},[activeTile,nextMole]);

  if(state==="idle")return(<div className="grid place-items-center gap-4 py-10 text-center"><p className="text-muted-foreground">Klik target secepatnya!</p><Button onClick={start} size="lg" className="rounded-2xl bg-accent text-accent-foreground hover:bg-accent/90"><Play className="mr-2 h-4 w-4"/>Mulai Game</Button></div>);
  if(state==="finished")return(<div className="grid place-items-center gap-4 py-10 text-center"><div><div className="mb-1 text-4xl font-extrabold tracking-tight text-accent">{score}</div><p className="text-muted-foreground">Skor Akhir</p></div><p className="text-foreground">Kamu mendapatkan {score/10} klik!</p><Button onClick={start} size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90"><RotateCcw className="mr-2 h-4 w-4"/>Main Lagi</Button></div>);

  return(
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Skor: <span className="font-bold text-accent">{score}</span></span><span className="font-mono text-foreground">Waktu: {timeLeft}s</span></div>
      <div className="grid grid-cols-3 gap-3">
        {Array.from({length:9}).map((_,i)=>(
          <button key={i} onClick={()=>clickTile(i)} className={cn("aspect-square rounded-xl border border-border/60 transition-all duration-75 grid place-items-center",i===activeTile?"bg-accent/80 ring-2 ring-accent scale-105":"bg-muted/70 hover:bg-muted")}>
            {i===activeTile&&<Target className="h-7 w-7 text-accent-foreground animate-pulse"/>}
          </button>
        ))}
      </div>
    </div>
  )
}
