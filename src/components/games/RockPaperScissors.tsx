// RockPaperScissors.tsx
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Users, Trophy, Hand, Scissors as ScissorsIcon, FileText, Play, RotateCcw } from "lucide-react";
import { useOpponent } from "@/hooks/useOpponent";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface RPSProps{ currentUserId:string; onScoreSubmit:(score:number)=>void }
type Choice="rock"|"paper"|"scissors"|null;
type Json=string|number|boolean|null|{[key:string]:Json}|Json[];
type GameStatus="waiting"|"active"|"finished";
interface GameState{ rounds:number; player1Score:number; player2Score:number; player1Choice:Choice; player2Choice:Choice }
interface GameSession{ id:string; game_type:"rps"; player1_id:string; player2_id:string|null; status:GameStatus; winner_id:string|null; created_at?:string; updated_at?:string; game_state:Json }

const initials=(n?:string)=>{if(!n)return"U";const a=n.trim().split(/\s+/);return((a[0]?.[0]??"U")+(a[1]?.[0]??"")).toUpperCase()};

const RockPaperScissors=({currentUserId,onScoreSubmit}:RPSProps)=>{
  const [isSearching,setIsSearching]=useState(false);
  const [gameSession,setGameSession]=useState<GameSession|null>(null);
  const [myChoice,setMyChoice]=useState<Choice>(null),[opponentChoice,setOpponentChoice]=useState<Choice>(null);
  const [result,setResult]=useState(""),[rounds,setRounds]=useState(0),[myScore,setMyScore]=useState(0),[opponentScore,setOpponentScore]=useState(0);
  const {opponent,loadingOpponent}=useOpponent(gameSession,currentUserId);
  const mmChannelRef=useRef<ReturnType<typeof supabase.channel>|null>(null);

  const determineWinner=(my:Choice,opp:Choice):"win"|"lose"|"draw"=>{if(!my||!opp||my===opp)return"draw";if((my==="rock"&&opp==="scissors")||(my==="scissors"&&opp==="paper")||(my==="paper"&&opp==="rock"))return"win";return"lose"};

  useEffect(()=>{if(!gameSession?.id)return;const channel=supabase.channel(`game:${gameSession.id}`).on("postgres_changes",{event:"UPDATE",schema:"public",table:"game_sessions",filter:`id=eq.${gameSession.id}`},async payload=>{const updated=payload.new as GameSession;setGameSession(updated);
      if(updated.status==="active"&&updated.game_state){
        const state=updated.game_state as unknown as GameState,isPlayer1=currentUserId===updated.player1_id,p1c=state.player1Choice,p2c=state.player2Choice;
        setRounds(state.rounds||0);setMyScore(isPlayer1?state.player1Score||0:state.player2Score||0);setOpponentScore(isPlayer1?state.player2Score||0:state.player1Score||0);
        if(p1c&&p2c){
          setMyChoice(isPlayer1?p1c:p2c);setOpponentChoice(isPlayer1?p2c:p1c);const r=determineWinner(isPlayer1?p1c:p2c,isPlayer1?p2c:p1c);setResult(r);
          if(isPlayer1){
            const oldRounds=state.rounds;const next:{[K in keyof GameState]:GameState[K]}={...state};const winnerRel=determineWinner(p1c,p2c);
            if(winnerRel==="win")next.player1Score+=1;else if(winnerRel==="lose")next.player2Score+=1;
            next.rounds=oldRounds+1;next.player1Choice=null;next.player2Choice=null;
            const {error}=await supabase.from("game_sessions").update({game_state:next as unknown as Json,status:next.rounds>=3?"finished":"active",winner_id:next.rounds>=3?(next.player1Score>next.player2Score?updated.player1_id:next.player2Score>next.player1Score?updated.player2_id:null):null}).eq("id",updated.id).contains("game_state",{player1Choice:p1c,player2Choice:p2c,rounds:oldRounds} as any);
            if(error){}
          }
          setTimeout(()=>{setMyChoice(null);setOpponentChoice(null);setResult("")},1800);
        }
      }
      if(updated.status==="finished")handleGameEnd(updated);
    }).subscribe();return()=>{supabase.removeChannel(channel)}},[gameSession?.id,currentUserId]);

  const findMatch=async()=>{setIsSearching(true);try{
      const {error:queueError}=await supabase.from("matchmaking_queue").upsert({user_id:currentUserId,game_type:"rps"},{onConflict:"user_id,game_type"});if(queueError)throw queueError;
      const {data:waiting}=await supabase.from("game_sessions").select("*").eq("game_type","rps").eq("status","waiting").is("player2_id",null).neq("player1_id",currentUserId).limit(1).single();
      if(waiting){
        const initState:GameState={rounds:0,player1Score:0,player2Score:0,player1Choice:null,player2Choice:null};
        const {data:updated,error}=await supabase.from("game_sessions").update({player2_id:currentUserId,status:"active",game_state:initState as unknown as Json}).eq("id",waiting.id).is("player2_id",null).eq("status","waiting").select().single();
        if(error||!updated){setIsSearching(false);toast.message("Sesi barusan sudah diambil, mencoba lagi...");return findMatch()}
        await supabase.from("matchmaking_queue").delete().eq("game_type","rps").in("user_id",[currentUserId,waiting.player1_id]);
        setGameSession(updated as GameSession);setRounds(0);setMyScore(0);setOpponentScore(0);setIsSearching(false);toast.success("Lawan ditemukan!");return;
      }
      const {data:newSession,error:sessionError}=await supabase.from("game_sessions").insert({game_type:"rps",player1_id:currentUserId,status:"waiting"}).select().single();if(sessionError)throw sessionError;
      setGameSession(newSession as GameSession);
      const ch=supabase.channel(`matchmaking:rps:${newSession.id}`).on("postgres_changes",{event:"UPDATE",schema:"public",table:"game_sessions",filter:`id=eq.${newSession.id}`},async payload=>{const updated=payload.new as GameSession;if(updated.status==="active"){await supabase.from("matchmaking_queue").delete().eq("user_id",currentUserId).eq("game_type","rps");setGameSession(updated);setIsSearching(false);toast.success("Lawan ditemukan!");if(mmChannelRef.current)supabase.removeChannel(mmChannelRef.current);mmChannelRef.current=null}}).subscribe();mmChannelRef.current=ch;
    }catch(e:any){toast.error(e?.message??"Gagal mencari lawan");setIsSearching(false)}};

  const makeChoice=async(choice:Choice)=>{if(!gameSession||myChoice||!choice)return;setMyChoice(choice);
    const isPlayer1=currentUserId===gameSession.player1_id;const state=(gameSession.game_state as unknown as GameState)||{rounds:0,player1Score:0,player2Score:0,player1Choice:null,player2Choice:null};
    const next:GameState={...state,player1Choice:isPlayer1?choice:state.player1Choice,player2Choice:!isPlayer1?choice:state.player2Choice};
    const {error}=await supabase.from("game_sessions").update({game_state:next as unknown as Json}).eq("id",gameSession.id);if(error)toast.error(error.message)
  };

  const handleGameEnd=(session:GameSession)=>{const isWinner=session.winner_id===currentUserId,isDraw=!session.winner_id;
    if(isWinner){onScoreSubmit(100);toast.success("🎉 Kamu menang best of 3!")}else if(isDraw){onScoreSubmit(50);toast.info("Seri!")}else{onScoreSubmit(0);toast.error("Kamu kalah!")}
    setTimeout(()=>{setGameSession(null);setMyChoice(null);setOpponentChoice(null);setResult("");setRounds(0);setMyScore(0);setOpponentScore(0);setIsSearching(false)},3000)
  };

  const cancelSearch=async()=>{try{if(gameSession?.status==="waiting"&&gameSession.player1_id===currentUserId){await supabase.from("game_sessions").delete().eq("id",gameSession.id)}await supabase.from("matchmaking_queue").delete().eq("user_id",currentUserId).eq("game_type","rps")}finally{if(mmChannelRef.current)supabase.removeChannel(mmChannelRef.current);mmChannelRef.current=null;setGameSession(null);setIsSearching(false)}};

  if(!gameSession)return(<div className="text-center space-y-4"><p className="text-sm text-muted-foreground">Best of 3 rounds!</p><Button onClick={findMatch} disabled={isSearching} className="w-full">{isSearching?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Users className="mr-2 h-4 w-4"/>}{isSearching?"Mencari lawan...":"Cari Lawan"}</Button></div>);

  if(gameSession.status==="waiting")return(<div className="text-center space-y-4"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary"/><p className="text-sm text-muted-foreground">Menunggu lawan...</p><Button onClick={cancelSearch} variant="outline" size="sm">Batal</Button></div>);

  return(
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Avatar className="h-7 w-7"><AvatarImage src={opponent?.avatar_url??undefined}/><AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">{initials(opponent?.full_name)}</AvatarFallback></Avatar>
          <div><p className="font-medium leading-none">Lawan</p><p className="text-[11px] text-muted-foreground">{loadingOpponent?"Memuat…":opponent?.full_name??"Tidak diketahui"}</p></div>
        </div>
        <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${myChoice?(opponentChoice?"bg-muted text-muted-foreground":"bg-accent text-accent-foreground"):"bg-card text-muted-foreground ring-1 ring-border"}`}>{myChoice?(opponentChoice?"Menentukan hasil…":"Menunggu lawan…"):"Pilih tangan"}</span>
      </div>

      <div className="flex justify-between text-sm font-semibold"><span>Round {rounds}/3</span><span>{myScore} - {opponentScore}</span></div>

      {result&&(<div className="text-center p-3 bg-accent/10 rounded-lg"><p className="font-semibold">{result==="win"?"🎉 Kamu Menang!":result==="lose"?"😔 Kamu Kalah":"🤝 Seri"}</p></div>)}

      {myChoice&&opponentChoice?(
        <div className="flex justify-around items-center p-4">
          <div className="text-center"><p className="text-xs text-muted-foreground mb-2">Kamu</p>{myChoice==="rock"&&<Hand className="h-12 w-12 text-primary"/>}{myChoice==="paper"&&<FileText className="h-12 w-12 text-primary"/>}{myChoice==="scissors"&&<ScissorsIcon className="h-12 w-12 text-primary"/>}</div>
          <span className="text-2xl">VS</span>
          <div className="text-center"><p className="text-xs text-muted-foreground mb-0.5">Lawan</p><p className="text-[11px] text-muted-foreground">{loadingOpponent?"Memuat…":opponent?.full_name??"Tidak diketahui"}</p>{opponentChoice==="rock"&&<Hand className="h-12 w-12 text-accent"/>}{opponentChoice==="paper"&&<FileText className="h-12 w-12 text-accent"/>}{opponentChoice==="scissors"&&<ScissorsIcon className="h-12 w-12 text-accent"/>}</div>
        </div>
      ):(
        <>
          <p className="text-center text-sm text-muted-foreground">{myChoice?"Menunggu lawan...":"Pilih:"}</p>
          <div className="grid grid-cols-3 gap-2">
            <Button onClick={()=>makeChoice("rock")} disabled={!!myChoice} variant="outline" className="h-20 flex flex-col gap-1"><Hand className="h-6 w-6"/><span className="text-xs">Batu</span></Button>
            <Button onClick={()=>makeChoice("paper")} disabled={!!myChoice} variant="outline" className="h-20 flex flex-col gap-1"><FileText className="h-6 w-6"/><span className="text-xs">Kertas</span></Button>
            <Button onClick={()=>makeChoice("scissors")} disabled={!!myChoice} variant="outline" className="h-20 flex flex-col gap-1"><ScissorsIcon className="h-6 w-6"/><span className="text-xs">Gunting</span></Button>
          </div>
        </>
      )}

      {gameSession.status==="finished"&&(<div className="text-center p-3 bg-accent/10 rounded-lg"><Trophy className="mx-auto h-6 w-6 text-accent mb-2"/><p className="font-semibold">{gameSession.winner_id===currentUserId?"Kamu Menang Game!":gameSession.winner_id?"Kamu Kalah Game":"Seri!"}</p></div>)}
    </div>
  )
};

export default RockPaperScissors;
