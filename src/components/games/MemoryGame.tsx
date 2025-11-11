// MemoryGame.tsx
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Play, RotateCcw } from "lucide-react";

interface Card{ id:number; emoji:string; isFlipped:boolean; isMatched:boolean }
const EMOJIS=["🎓","📚","✏️","🎨","🔬","🌟","🏆","💡"];
const L=EMOJIS.length;
interface Props{ onScoreSubmit:(score:number)=>void }

export default function MemoryGame({onScoreSubmit}:Props){
  const [state,setState]=useState<"idle"|"playing"|"finished">("idle");
  const [cards,setCards]=useState<Card[]>([]);
  const [flipped,setFlipped]=useState<number[]>([]);
  const [moves,setMoves]=useState(0);
  const [pairs,setPairs]=useState(0);
  const [time,setTime]=useState(60);

  useEffect(()=>{let t:any;if(state==="playing"&&time>0)t=setTimeout(()=>setTime(time-1),1000);else if(time===0&&state==="playing")finish();return()=>clearTimeout(t)},[state,time]);

  useEffect(()=>{if(flipped.length!==2)return;const[a,b]=flipped,A=cards[a],B=cards[b];
    if(A.emoji===B.emoji){setTimeout(()=>{setCards(cs=>cs.map((c,i)=>i===a||i===b?{...c,isMatched:true}:c));setPairs(p=>p+1);setFlipped([])},450);if(pairs+1===L)setTimeout(()=>finish(),550)}
    else setTimeout(()=>{setCards(cs=>cs.map((c,i)=>i===a||i===b?{...c,isFlipped:false}:c));setFlipped([])},750);
    setMoves(m=>m+1)
  },[flipped]);

  const start=()=>{const data=[...EMOJIS,...EMOJIS].sort(()=>Math.random()-0.5).map((e,i)=>({id:i,emoji:e,isFlipped:false,isMatched:false}));setCards(data);setFlipped([]);setMoves(0);setPairs(0);setTime(60);setState("playing")};
  const click=(i:number)=>{if(flipped.length===2||cards[i].isFlipped||cards[i].isMatched||state!=="playing")return;setCards(cs=>cs.map((c,idx)=>idx===i?{...c,isFlipped:true}:c));setFlipped(f=>[...f,i])};
  const calc=()=>Math.max(0,100-moves+time*2);
  const finish=()=>{setState("finished");onScoreSubmit(calc())};

  if(state==="idle")return(<div className="grid place-items-center gap-4 py-10 text-center"><p className="text-muted-foreground">Temukan pasangan kartu yang sama!</p><Button onClick={start} size="lg" className="rounded-2xl bg-accent text-accent-foreground hover:bg-accent/90"><Play className="mr-2 h-4 w-4"/>Mulai Game</Button></div>);
  if(state==="finished")return(<div className="grid place-items-center gap-4 py-10 text-center"><div><div className="mb-1 text-4xl font-extrabold tracking-tight text-accent">{calc()}</div><p className="text-muted-foreground">Skor Akhir</p></div><p className="text-foreground">Langkah: {moves} | Pasangan: {pairs}/{L}</p><Button onClick={start} size="lg" className="rounded-2xl bg-accent text-accent-foreground hover:bg-accent/90"><RotateCcw className="mr-2 h-4 w-4"/>Main Lagi</Button></div>);

  return(
    <div className="space-y-5">
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted"><div className="h-full bg-accent transition-[width] duration-1000" style={{width:`${(time/60)*100}%`}}/></div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Langkah: <span className="font-bold">{moves}</span></span>
        <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">Waktu <span className="ml-1 text-base text-foreground">{time}s</span></span>
        <span className="text-muted-foreground">Pasangan: <span className="font-bold text-accent">{pairs}/{L}</span></span>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {cards.map((c,i)=>(
          <button key={c.id} onClick={()=>click(i)} disabled={c.isFlipped||c.isMatched} className={`group relative aspect-square rounded-2xl border border-border/60 bg-card/70 p-0 shadow-sm transition hover:shadow ${c.isMatched?"opacity-60":""}`}>
            <div className={`absolute inset-0 rounded-2xl transition-transform duration-300 [transform-style:preserve-3d] ${c.isFlipped||c.isMatched?"[transform:rotateY(180deg)]":""}`}>
              <div className="absolute inset-0 grid place-items-center rounded-2xl bg-muted text-2xl font-bold [backface-visibility:hidden]">?</div>
              <div className="absolute inset-0 grid place-items-center rounded-2xl bg-accent text-2xl font-bold text-accent-foreground [transform:rotateY(180deg)] [backface-visibility:hidden]">{c.emoji}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
