// WordScramble.tsx
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Users, Trophy, Clock } from "lucide-react";
import { pickRandomWord } from "@/data/wordBank";
import { useOpponent } from "@/hooks/useOpponent";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface WordScrambleProps{ currentUserId:string; onScoreSubmit:(score:number)=>void }
type Json=string|number|boolean|null|{[k:string]:Json}|Json[];
interface GameState{ round:number; player1Score:number; player2Score:number; currentWord:string; scrambledWord:string; hint:string }
interface GameSession{ id:string; game_type:string; player1_id:string; player2_id:string|null; status:string; winner_id:string|null; created_at?:string; updated_at?:string; game_state:Json }

const fisherYates=(arr:string[])=>{for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]]}return arr};
const scrambleWord=(word:string)=>{let s=fisherYates(word.split("")).join("");if(s===word)s=scrambleWord(word);return s};
const initials=(n?:string)=>{if(!n)return"U";const a=n.trim().split(/\s+/);return((a[0]?.[0]??"U")+(a[1]?.[0]??"")).toUpperCase()};
const isGameState=(v:unknown):v is GameState=>{const s=v as Partial<GameState>|null;return!!s&&typeof s.round==="number"&&typeof s.player1Score==="number"&&typeof s.player2Score==="number"&&typeof s.currentWord==="string"&&typeof s.scrambledWord==="string"&&typeof s.hint==="string"};

export default function WordScramble({currentUserId,onScoreSubmit}:WordScrambleProps){
  const [isSearching,setIsSearching]=useState(false);
  const [gameSession,setGameSession]=useState<GameSession|null>(null);
  const [scrambledWordState,setScrambledWord]=useState(""),[hint,setHint]=useState(""),[answer,setAnswer]=useState("");
  const [timeLeft,setTimeLeft]=useState(30),[myScore,setMyScore]=useState(0),[opponentScore,setOpponentScore]=useState(0),[round,setRound]=useState(1),[submitting,setSubmitting]=useState(false);
  const {opponent,loadingOpponent}=useOpponent(gameSession,currentUserId);
  const mmChannelRef=useRef<any>(null); const timerRef=useRef<ReturnType<typeof setInterval>|null>(null);

  useEffect(()=>{if(!gameSession?.id)return;const channel=supabase.channel(`game:${gameSession.id}`).on("postgres_changes",{event:"UPDATE",schema:"public",table:"game_sessions",filter:`id=eq.${gameSession.id}`},payload=>{const updated=payload.new as GameSession;setGameSession(updated);
      if(updated.status==="active"&&isGameState(updated.game_state)){const state=updated.game_state,isP1=currentUserId===updated.player1_id;setMyScore(isP1?state.player1Score:state.player2Score);setOpponentScore(isP1?state.player2Score:state.player1Score);setRound(state.round);setScrambledWord(state.scrambledWord);setHint(state.hint);setAnswer("")}
      if(updated.status==="finished")handleGameEnd(updated);
    }).subscribe();return()=>{supabase.removeChannel(channel)}},[gameSession?.id,currentUserId]);

  useEffect(()=>{if(gameSession?.status!=="active"||!isGameState(gameSession?.game_state))return;const s=gameSession.game_state,isP1=currentUserId===gameSession.player1_id;setMyScore(isP1?s.player1Score:s.player2Score);setOpponentScore(isP1?s.player2Score:s.player1Score);setRound(s.round);setScrambledWord(s.scrambledWord);setHint(s.hint);setAnswer("")},[gameSession,currentUserId]);

  const scrambledFromState=isGameState(gameSession?.game_state)?gameSession!.game_state.scrambledWord:"";

  useEffect(()=>{const trigger=scrambledFromState||scrambledWordState;if(gameSession?.status!=="active"||!trigger)return;if(timerRef.current)clearInterval(timerRef.current);const endAt=Date.now()+30000;setTimeLeft(30);
    timerRef.current=setInterval(()=>{const left=Math.max(0,Math.ceil((endAt-Date.now())/1000));setTimeLeft(left);if(left===0){if(timerRef.current)clearInterval(timerRef.current);if(gameSession?.player1_id===currentUserId)handleTimeUp()}},250);
    return()=>{if(timerRef.current)clearInterval(timerRef.current)}
  },[gameSession?.id,gameSession?.status,scrambledFromState,scrambledWordState,currentUserId]);

  const findMatch=async()=>{setIsSearching(true);try{
      const{error:queueError}=await supabase.from("matchmaking_queue").upsert({user_id:currentUserId,game_type:"wordscramble"},{onConflict:"user_id,game_type"});if(queueError)throw queueError;
      const{data:waitingSessions}=await supabase.from("game_sessions").select("*").eq("game_type","wordscramble").eq("status","waiting").is("player2_id",null).neq("player1_id",currentUserId).limit(1).single();
      if(waitingSessions){
        const wordObj=pickRandomWord();const nextState:GameState={round:1,player1Score:0,player2Score:0,currentWord:wordObj.word,scrambledWord:scrambleWord(wordObj.word),hint:wordObj.hint};
        const{data:updated,error:updateError}=await supabase.from("game_sessions").update({player2_id:currentUserId,status:"active",game_state:nextState as unknown as Json}).eq("id",waitingSessions.id).is("player2_id",null).eq("status","waiting").select().single();
        if(updateError||!updated){setIsSearching(false);toast.message("Sesi sudah diambil, mencoba lagi...");return findMatch()}
        await supabase.from("matchmaking_queue").delete().eq("game_type","wordscramble").in("user_id",[currentUserId,waitingSessions.player1_id]);
        setGameSession(updated as GameSession);setIsSearching(false);toast.success("Lawan ditemukan!");return;
      }else{
        const{data:newSession,error:sessionError}=await supabase.from("game_sessions").insert({game_type:"wordscramble",player1_id:currentUserId,status:"waiting"}).select().single();if(sessionError)throw sessionError;
        setGameSession(newSession as GameSession);
        const ch=supabase.channel(`matchmaking:wordscramble:${newSession.id}`).on("postgres_changes",{event:"UPDATE",schema:"public",table:"game_sessions",filter:`id=eq.${newSession.id}`},async payload=>{if((payload.new as any).status==="active"){await supabase.from("matchmaking_queue").delete().eq("user_id",currentUserId).eq("game_type","wordscramble");setGameSession(payload.new as GameSession);toast.success("Lawan ditemukan!");if(mmChannelRef.current)supabase.removeChannel(mmChannelRef.current);mmChannelRef.current=null;setIsSearching(false)}}).subscribe();mmChannelRef.current=ch;
      }
    }catch(e:any){toast.error(e.message??"Gagal mencari lawan");setIsSearching(false)}};

  const advanceRound=async(currentState:GameState)=>{if(!gameSession)return;if(currentState.round>=3){const finalWinner=currentState.player1Score>currentState.player2Score?gameSession.player1_id:currentState.player2Score>currentState.player1Score?gameSession.player2_id:null;await supabase.from("game_sessions").update({status:"finished",winner_id:finalWinner,game_state:currentState as unknown as Json}).eq("id",gameSession.id)}else{const nextWord=pickRandomWord();const nextState:GameState={...currentState,round:currentState.round+1,currentWord:nextWord.word,scrambledWord:scrambleWord(nextWord.word),hint:nextWord.hint};await supabase.from("game_sessions").update({game_state:nextState as unknown as Json}).eq("id",gameSession.id)}};

  const submitAnswer=async()=>{if(!answer.trim()||!gameSession||submitting)return;const state=isGameState(gameSession.game_state)?gameSession.game_state:null;if(!state)return;if(answer.trim().toUpperCase()!==state.currentWord){toast.error("Salah! Coba lagi");setAnswer("");return}
    setSubmitting(true);try{toast.success("Benar! Kata berikutnya...");const isP1=currentUserId===gameSession.player1_id;const key:'player1Score'|'player2Score'=isP1?'player1Score':'player2Score';const base=state as GameState;const updatedState:GameState={...base,[key]:base[key]+10};await advanceRound(updatedState)}finally{setSubmitting(false);setAnswer("")}
  };

  const handleTimeUp=async()=>{if(!gameSession)return;const state=isGameState(gameSession.game_state)?gameSession.game_state:null;if(!state)return;toast.info(`Waktu habis! Jawaban: ${state.currentWord}`);await advanceRound(state)};

  const handleGameEnd=(session:GameSession)=>{const isWinner=session.winner_id===currentUserId;if(isWinner){onScoreSubmit(100);toast.success("Kamu menang!")}else if(!session.winner_id){onScoreSubmit(50);toast.info("Seri!")}else{onScoreSubmit(0);toast.error("Kamu kalah!")}
    setTimeout(()=>{setGameSession(null);setScrambledWord("");setHint("");setAnswer("");setTimeLeft(30);setRound(1);setMyScore(0);setOpponentScore(0);setIsSearching(false)},3000)
  };

  const cancelSearch=async()=>{try{if(gameSession?.status==="waiting"&&gameSession.player1_id===currentUserId){await supabase.from("game_sessions").delete().eq("id",gameSession.id)}await supabase.from("matchmaking_queue").delete().eq("user_id",currentUserId).eq("game_type","wordscramble")}finally{if(mmChannelRef.current)supabase.removeChannel(mmChannelRef.current);mmChannelRef.current=null;setGameSession(null);setIsSearching(false)}};

  if(!gameSession)return(<div className="text-center space-y-4"><p className="text-sm text-muted-foreground">Tebak kata yang diacak! 3 ronde</p><Button onClick={findMatch} disabled={isSearching} className="w-full">{isSearching?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Users className="mr-2 h-4 w-4"/>}{isSearching?"Mencari lawan...":"Cari Lawan"}</Button></div>);

  if(gameSession.status==="waiting")return(<div className="text-center space-y-4"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary"/><p className="text-sm text-muted-foreground">Menunggu lawan...</p><Button onClick={cancelSearch} variant="outline" size="sm">Batal</Button></div>);

  const stateForView=isGameState(gameSession.game_state)?gameSession.game_state:undefined;

  return(
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm mb-2">
        <div className="flex items-center gap-2">
          <Avatar className="h-7 w-7"><AvatarImage src={opponent?.avatar_url??undefined}/><AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">{initials(opponent?.full_name)}</AvatarFallback></Avatar>
          <div><p className="font-medium leading-none">Lawan</p><p className="text-[11px] text-muted-foreground">{loadingOpponent?"Memuat…":opponent?.full_name??(!gameSession?.player2_id?"Menunggu…":"Tidak diketahui")}</p></div>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <span className="text-sm font-semibold">Round {round}/3</span>
        <div className="flex items-center gap-2 text-sm font-semibold"><Clock className="h-4 w-4"/><span className={timeLeft<=10?"text-destructive":""}>{timeLeft}s</span></div>
        <span className="text-sm font-semibold">{myScore} - {opponentScore}</span>
      </div>

      <div className="p-4 bg-muted rounded-lg space-y-2">
        <p className="text-xs text-muted-foreground">Hint: {stateForView?.hint??hint}</p>
        <p className="text-2xl font-bold text-center tracking-widest">{stateForView?.scrambledWord??scrambledWordState}</p>
        {timeLeft===0&&(<p className="text-xs text-destructive text-center font-semibold">Jawaban: {stateForView?.currentWord}</p>)}
      </div>

      <div className="flex gap-2">
        <Input value={answer} onChange={e=>setAnswer(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submitAnswer()} placeholder="Ketik jawabanmu..." className="flex-1" maxLength={20}/>
        <Button onClick={submitAnswer} disabled={!answer.trim()||submitting}>Kirim</Button>
      </div>

      {gameSession.status==="finished"&&(<div className="text-center p-3 bg-accent/10 rounded-lg"><Trophy className="mx-auto h-6 w-6 text-accent mb-2"/><p className="font-semibold">{gameSession.winner_id===currentUserId?"Kamu Menang!":gameSession.winner_id?"Kamu Kalah":"Seri!"}</p></div>)}
    </div>
  )
}
