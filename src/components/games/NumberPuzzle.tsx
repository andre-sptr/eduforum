// NumberPuzzle.tsx
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Play, RotateCcw } from "lucide-react";

interface Props{ onScoreSubmit:(score:number)=>void }

const N=3;
const isSolved=(t:number[])=>t.every((v,i)=>i===N*N-1?v===0:v===i+1);
const inversions=(t:number[])=>{const a=t.filter(v=>v!==0);let inv=0;for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++)if(a[i]>a[j])inv++;return inv};
const fisherYates=(arr:number[])=>{const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const genSolvable=()=>{const base=[...Array(N*N-1)].map((_,i)=>i+1).concat(0);let s=fisherYates(base);while(inversions(s)%2!==0||isSolved(s))s=fisherYates(base);return s};
const isAdj=(a:number,b:number)=>{const r1=Math.floor(a/N),c1=a%N,r2=Math.floor(b/N),c2=b%N;return(Math.abs(r1-r2)===1&&c1===c2)||(Math.abs(c1-c2)===1&&r1===r2)};

export default function NumberPuzzle({onScoreSubmit}:Props){
  const [state,setState]=useState<"idle"|"playing"|"finished">("idle");
  const [tiles,setTiles]=useState<number[]>([]);
  const [moves,setMoves]=useState(0);
  const [time,setTime]=useState(0);

  useEffect(()=>{let i:any;if(state==="playing")i=setInterval(()=>setTime(p=>p+1),1000);return()=>clearInterval(i)},[state]);

  const init=()=>{setTiles(genSolvable());setMoves(0);setTime(0);setState("playing")};
  const click=(idx:number)=>{const empty=tiles.indexOf(0);if(!isAdj(idx,empty))return;const t=[...tiles];[t[idx],t[empty]]=[t[empty],t[idx]];setTiles(t);setMoves(m=>m+1);if(isSolved(t))finish()};
  const finish=()=>{setState("finished");onScoreSubmit(Math.max(1000-moves*10-time,100))};

  if(state==="idle")return(<div className="grid place-items-center gap-4 py-10 text-center"><p className="text-muted-foreground">Susun angka 1–8 berurutan!</p><Button onClick={init} size="lg" className="rounded-2xl bg-accent text-accent-foreground hover:bg-accent/90"><Play className="mr-2 h-4 w-4"/>Mulai Game</Button></div>);

  if(state==="finished"){const s=Math.max(1000-moves*10-time,100);return(<div className="grid place-items-center gap-4 py-10 text-center"><div><div className="mb-1 text-4xl font-extrabold tracking-tight text-accent">{s}</div><p className="text-muted-foreground">Skor Akhir</p></div><p className="text-foreground">Langkah: {moves} • Waktu: {time}s</p><Button onClick={init} size="lg" className="rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90"><RotateCcw className="mr-2 h-4 w-4"/>Main Lagi</Button></div>)}

  const empty=tiles.indexOf(0);

  return(
    <div className="space-y-5">
      <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Langkah: <span className="font-bold">{moves}</span></span><span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">Waktu <span className="ml-1 text-base text-foreground">{time}s</span></span></div>
      <div className="mx-auto max-w-xs rounded-2xl border border-border/60 bg-card/60 p-3 shadow-sm backdrop-blur">
        <div className="grid grid-cols-3 gap-2">
          {tiles.map((v,i)=>{const canMove=v!==0&&isAdj(i,empty);return(<button key={i} onClick={()=>v!==0&&click(i)} className={`aspect-square rounded-xl text-2xl font-bold transition-all ${v===0?"bg-muted/70":"bg-primary text-primary-foreground hover:scale-[1.02]"} ${canMove?"ring-2 ring-accent/60":"ring-0"} shadow-sm`}>{v!==0&&v}</button>)})}
        </div>
      </div>
      <div className="text-center"><Button onClick={init} variant="outline" className="rounded-xl">Reset</Button></div>
    </div>
  )
}
