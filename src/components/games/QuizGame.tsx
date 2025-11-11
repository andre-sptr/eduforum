// QuizGame.tsx
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, XCircle, Play, RotateCcw } from "lucide-react";
import { quizBank, QuizQuestion } from "@/data/quizBank";

interface Props{ onScoreSubmit:(score:number)=>void }

const pickRandomQuestions=(n:number)=>{const a=[...quizBank];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a.slice(0,n)};

export default function QuizGame({onScoreSubmit}:Props){
  const [state,setState]=useState<"idle"|"playing"|"finished">("idle");
  const [questions,setQuestions]=useState<QuizQuestion[]>([]);
  const [idx,setIdx]=useState(0);
  const [score,setScore]=useState(0);
  const [sel,setSel]=useState<number|null>(null);
  const [show,setShow]=useState(false);
  const [time,setTime]=useState(20);

  useEffect(()=>{let t:any;if(state==="playing"&&time>0&&!show)t=setTimeout(()=>setTime(s=>s-1),1000);else if(time===0&&!show)next();return()=>clearTimeout(t)},[state,time,show]);

  const start=()=>{setQuestions(pickRandomQuestions(10));setState("playing");setIdx(0);setScore(0);setSel(null);setShow(false);setTime(30)};
  const answer=(i:number)=>{if(show)return;setSel(i);setShow(true);if(i===questions[idx].correctAnswer)setScore(s=>s+10)};
  const next=()=>{if(idx+1<questions.length){setIdx(i=>i+1);setSel(null);setShow(false);setTime(30)}else{setState("finished");onScoreSubmit(sel===questions[idx].correctAnswer?score+10:score)}};

  if(state==="idle")return(<div className="grid place-items-center gap-4 py-10 text-center"><p className="text-muted-foreground">Jawab 10 pertanyaan dengan benar!</p><Button onClick={start} size="lg" className="rounded-2xl bg-accent text-accent-foreground hover:bg-accent/90"><Play className="mr-2 h-4 w-4"/>Mulai Quiz</Button></div>);

  if(state==="finished")return(<div className="py-8 text-center"><div className="mb-4"><div className="mb-2 text-4xl font-bold text-accent">{score}</div><p className="text-muted-foreground">Skor Akhir</p></div><p className="mb-4 text-foreground">Anda menjawab {score/10} dari {questions.length} pertanyaan dengan benar!</p><Button onClick={start} size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90"><RotateCcw className="mr-2 h-4 w-4"/>Main Lagi</Button></div>);

  const q=questions[idx],progress=((idx+1)/questions.length)*100;

  return(
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-muted-foreground"><span>Pertanyaan {idx+1}/{questions.length}</span><span className="font-mono text-foreground">Waktu: {time}s</span></div>
      <Progress value={progress} className="h-2"/>
      <Card className="border-border bg-muted p-4">
        <h3 className="mb-4 text-lg font-semibold text-foreground">{q.question}</h3>
        <div className="space-y-2">
          {q.options.map((opt,i)=>{const isSel=sel===i,isCorrect=i===q.correctAnswer,showC=show&&isCorrect,showW=show&&isSel&&!isCorrect;return(
            <Button key={i} onClick={()=>answer(i)} disabled={show} variant={showC?"default":showW?"destructive":"outline"} className={`w-full justify-start gap-2 py-3 text-left ${showC?"bg-primary text-primary-foreground":showW?"bg-destructive text-destructive-foreground":"bg-background text-foreground hover:bg-accent/10"}`}>
              <span className="flex w-full items-center gap-2"><span className="flex-1">{opt}</span>{showC&&<CheckCircle className="h-5 w-5"/>}{showW&&<XCircle className="h-5 w-5"/>}</span>
            </Button>
          )})}
        </div>
      </Card>
      {show&&(<Button onClick={next} size="lg" className="w-full bg-accent text-accent-foreground hover:bg-accent/90">{idx+1<questions.length?"Pertanyaan Berikutnya":"Lihat Hasil"}</Button>)}
      <p className="text-center text-sm text-muted-foreground">Skor Saat Ini: <span className="font-bold text-accent">{score}</span></p>
    </div>
  )
}
