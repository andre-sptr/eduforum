// TypingTest.tsx
import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Play, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props{ onScoreSubmit:(score:number)=>void }

const GAME_TIME=60;
const WORDS=["aku","kamu","dia","kita","mereka","makan","minum","tidur","belajar","sekolah","rumah","buku","guru","siswa","dan","atau","tapi","karena","jika","maka","itu","ini","ada","adalah","punya","untuk","dari","ke","di","pergi","pulang","lihat","dengar","bicara","pikir","kerja","main","suka","cinta","sayang","benci","senang","sedih","marah","takut","bahagia","hari","minggu","bulan","tahun","pagi","siang","sore","malam","selalu","air","matahari","langit","bumi","tangan","kaki","mata","telinga","mulut","hati","kepala","mobil","motor","jalan","kota","desa","uang","toko","pasar","nasi","roti","susu","telur","daging","sayur","buah","ayah","ibu","anak","teman","pacar","keluarga","pekerjaan","nama","hal","datang","berdiri","duduk","berjalan","lari","naik","turun","membaca","menulis","mendengarkan","mencari","menemukan","membeli","menjual","memberi","menerima","memasak","membersihkan","membuka","menutup","memakai","meletakkan","mengambil","memulai","berhenti","besar","kecil","panjang","pendek","tinggi","rendah","baru","lama","bagus","jelek","sulit","mudah","mahal","murah","panas","dingin","bersih","kotor","lezat","manis","apa","siapa","mana","kapan","kenapa","sudah","belum","sekarang","nanti","kemarin","besok","sering","jarang","kadang","pernah"];
const gen=(n:number)=>Array.from({length:n},()=>WORDS[Math.floor(Math.random()*WORDS.length)]);

export default function TypingTest({onScoreSubmit}:Props){
  const [state,setState]=useState<"idle"|"playing"|"finished">("idle");
  const [words,setWords]=useState<string[]>([]);
  const [currentWordIndex,setCurrentWordIndex]=useState(0);
  const [inputValue,setInputValue]=useState("");
  const [timeLeft,setTimeLeft]=useState(GAME_TIME);
  const [correctWords,setCorrectWords]=useState(0);
  const [isWrong,setIsWrong]=useState(false);
  const timerRef=useRef<any>(null);
  const inputRef=useRef<HTMLInputElement>(null);

  useEffect(()=>()=>{if(timerRef.current)clearInterval(timerRef.current)},[]);

  const finish=useCallback(()=>{setState("finished");if(timerRef.current)clearInterval(timerRef.current);onScoreSubmit(correctWords)},[correctWords,onScoreSubmit]);

  useEffect(()=>{if(state==="playing"&&timeLeft>0){timerRef.current=setInterval(()=>setTimeLeft(t=>{if(t<=1){finish();return 0}return t-1}),1000)}else if(state!=="playing"){if(timerRef.current)clearInterval(timerRef.current)}return()=>{if(timerRef.current)clearInterval(timerRef.current)}},[state,timeLeft,finish]);

  const start=()=>{setWords(gen(100));setCurrentWordIndex(0);setInputValue("");setCorrectWords(0);setTimeLeft(GAME_TIME);setIsWrong(false);setState("playing");setTimeout(()=>inputRef.current?.focus(),0)};

  const handleInput=(e:React.ChangeEvent<HTMLInputElement>)=>{const v=e.target.value;if(v.endsWith(" ")){if(!v.trim()){setInputValue("");return}const cur=words[currentWordIndex];if(v.trim()===cur)setCorrectWords(c=>c+1);setCurrentWordIndex(i=>i+1);setInputValue("");setIsWrong(false)}else{setInputValue(v);const cur=words[currentWordIndex];setIsWrong(!cur.startsWith(v))}};

  const currentWord=words[currentWordIndex]||"";

  if(state==="idle")return(<div className="grid place-items-center gap-4 py-10 text-center"><p className="text-muted-foreground">Ketik kata-kata secepatnya (60 detik)!</p><Button onClick={start} size="lg" className="rounded-2xl bg-accent text-accent-foreground hover:bg-accent/90"><Play className="mr-2 h-4 w-4"/>Mulai Game</Button></div>);

  if(state==="finished")return(<div className="grid place-items-center gap-4 py-10 text-center"><div><div className="mb-1 text-4l font-extrabold tracking-tight text-accent">{correctWords}</div><p className="text-muted-foreground">WPM (Words Per Minute)</p></div><p className="text-foreground">Kamu mengetik {correctWords} kata dengan benar!</p><Button onClick={start} size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90"><RotateCcw className="mr-2 h-4 w-4"/>Main Lagi</Button></div>);

  return(
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">WPM: <span className="font-bold text-accent">{correctWords}</span></span><span className="font-mono text-foreground">Waktu: {timeLeft}s</span></div>
      <div className="flex h-14 items-center gap-2 overflow-hidden rounded-lg border bg-muted/60 px-3 text-xl font-mono">
        <span className="text-muted-foreground">{words[currentWordIndex-1]}</span>
        <span className={cn("rounded p-1",isWrong?"bg-destructive/30 text-destructive-foreground":"bg-accent/30 text-accent-foreground")}>{currentWord}</span>
        <span>{words[currentWordIndex+1]}</span>
        <span>{words[currentWordIndex+2]}</span>
      </div>
      <Input ref={inputRef} value={inputValue} onChange={handleInput} disabled={state!=="playing"} className={cn("h-12 text-lg font-mono",isWrong?"ring-2 ring-destructive ring-offset-2":"focus-visible:ring-accent")} autoCapitalize="none" autoComplete="off" autoCorrect="off"/>
    </div>
  )
}
