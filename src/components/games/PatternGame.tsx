// PatternGame.tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Play, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props { onScoreSubmit:(score:number)=>void }

const K = 4, FLASH_MS = 400, PAUSE_MS = 200, JITTER = 120;
const COLORS = ["bg-red-500","bg-blue-500","bg-green-500","bg-yellow-500"] as const;

const randInt = (n:number) => Math.floor(Math.random()*n);
const sampleWeighted = (w:number[]) => { const s=w.reduce((a,b)=>a+b,0); let r=Math.random()*s; for(let i=0;i<w.length;i++){ r-=w[i]; if(r<=0) return i } return w.length-1 };

const weightedNext = (seq:number[], k:number, maxRun=2) => {
  const freq:number[] = new Array<number>(k).fill(0);
  for (const v of seq) freq[v]++;
  const minF = Math.min(...freq);
  const last = seq[seq.length-1];
  let run = 0; for (let i=seq.length-1; i>=0 && seq[i]===last; i--) run++;
  const ban = new Set<number>(); if (run>=maxRun) ban.add(last);
  const w:number[] = freq.map((f,i)=> ban.has(i) ? 0 : (minF+1)/(f+1));
  const total = w.reduce((a,b)=>a+b,0);
  if (total <= 0) return randInt(k);
  return sampleWeighted(w);
};

const sleep = (ms:number)=>new Promise(r=>setTimeout(r,ms));
const jitter = (ms:number,j:number)=>Math.max(0, ms + (randInt(2*j+1)-j));

export default function PatternGame({ onScoreSubmit }:Props){
  const [state,setState]=useState<"idle"|"playing"|"finished">("idle");
  const [sequence,setSequence]=useState<number[]>([]);
  const [playerInput,setPlayerInput]=useState<number[]>([]);
  const [status,setStatus]=useState<"watching"|"listening">("watching");
  const [level,setLevel]=useState(0);
  const [activeButton,setActiveButton]=useState<number|null>(null);

  const finish=()=>{ setState("finished"); onScoreSubmit(level-1) };

  const nextRound=(cur:number[])=>{ setStatus("watching"); const next=weightedNext(cur,K,2); const ns=[...cur,next]; setSequence(ns); setPlayerInput([]); setLevel(ns.length); showSequence(ns) };

  const showSequence=async(seq:number[])=>{ await sleep(700); for(const i of seq){ setActiveButton(i); await sleep(jitter(FLASH_MS,JITTER)); setActiveButton(null); await sleep(jitter(PAUSE_MS,JITTER/2)) } setStatus("listening") };

  const handlePlayerClick=(i:number)=>{ if(status!=="listening"||state!=="playing")return; const np=[...playerInput,i]; setPlayerInput(np); if(np[np.length-1]!==sequence[np.length-1]){ finish(); return } if(np.length===sequence.length){ setStatus("watching"); setTimeout(()=>nextRound(sequence),600) } };

  const start=()=>{ setState("playing"); setSequence([]); setPlayerInput([]); setLevel(0); setStatus("watching"); nextRound([]) };

  if(state==="idle")return(<div className="grid place-items-center gap-4 py-10 text-center"><p className="text-muted-foreground">Ulangi pola yang muncul!</p><Button onClick={start} size="lg" className="rounded-2xl bg-accent text-accent-foreground hover:bg-accent/90"><Play className="mr-2 h-4 w-4"/>Mulai Game</Button></div>);

  if(state==="finished")return(<div className="grid place-items-center gap-4 py-10 text-center"><div><div className="mb-1 text-4xl font-extrabold tracking-tight text-accent">{level-1}</div><p className="text-muted-foreground">Skor Akhir (Level)</p></div><p className="text-foreground">Kamu berhasil mengingat {level-1} pola!</p><Button onClick={start} size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90"><RotateCcw className="mr-2 h-4 w-4"/>Main Lagi</Button></div>);

  return(
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Level: <span className="font-bold text-accent">{level}</span></span>
        <span className="font-semibold text-foreground">{status==="watching"?"Perhatikan...":"Giliranmu!"}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {Array.from({length:K},(_,i)=>i).map(i=>(
          <button key={i} onClick={()=>handlePlayerClick(i)} disabled={status!=="listening"} className={cn("aspect-square rounded-2xl border-4 border-transparent transition-all",COLORS[i],activeButton===i?"opacity-100 scale-105":"opacity-60 hover:opacity-80",status!=="listening"&&"cursor-not-allowed")}/>
        ))}
      </div>
    </div>
  )
}