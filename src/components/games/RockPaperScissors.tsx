import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Users, Trophy, Hand, Scissors, FileText } from "lucide-react";

interface RPSProps {
  currentUserId: string;
  onScoreSubmit: (score: number) => void;
}

type Choice = "rock" | "paper" | "scissors" | null;

const RockPaperScissors = ({ currentUserId, onScoreSubmit }: RPSProps) => {
  const [isSearching, setIsSearching] = useState(false);
  const [gameSession, setGameSession] = useState<any>(null);
  const [myChoice, setMyChoice] = useState<Choice>(null);
  const [opponentChoice, setOpponentChoice] = useState<Choice>(null);
  const [result, setResult] = useState<string>("");
  const [rounds, setRounds] = useState(0);
  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);

  useEffect(() => {
    if (!gameSession) return;

    const channel = supabase
      .channel(`game:${gameSession.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "game_sessions",
          filter: `id=eq.${gameSession.id}`,
        },
        (payload) => {
          const updated = payload.new as any;
          setGameSession(updated);

          if (updated.status === "active" && updated.game_state) {
            const state = updated.game_state;
            const isPlayer1 = currentUserId === updated.player1_id;
            
            if (state.player1Choice && state.player2Choice) {
              const p1Choice = state.player1Choice;
              const p2Choice = state.player2Choice;
              
              setMyChoice(isPlayer1 ? p1Choice : p2Choice);
              setOpponentChoice(isPlayer1 ? p2Choice : p1Choice);
              
              const roundResult = determineWinner(
                isPlayer1 ? p1Choice : p2Choice,
                isPlayer1 ? p2Choice : p1Choice
              );
              
              setResult(roundResult);
              setRounds(state.rounds || 1);
              setMyScore(isPlayer1 ? state.player1Score || 0 : state.player2Score || 0);
              setOpponentScore(isPlayer1 ? state.player2Score || 0 : state.player1Score || 0);
            }
          }

          if (updated.status === "finished") {
            handleGameEnd(updated);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameSession?.id]);

  const findMatch = async () => {
    setIsSearching(true);
    try {
      const { data: queueEntry, error: queueError } = await supabase
        .from("matchmaking_queue")
        .insert({ user_id: currentUserId, game_type: "rps" })
        .select()
        .single();

      if (queueError) throw queueError;

      const { data: waitingSessions } = await supabase
        .from("game_sessions")
        .select("*")
        .eq("game_type", "rps")
        .eq("status", "waiting")
        .is("player2_id", null)
        .neq("player1_id", currentUserId)
        .limit(1)
        .single();

      if (waitingSessions) {
        const { data: updated, error: updateError } = await supabase
          .from("game_sessions")
          .update({
            player2_id: currentUserId,
            status: "active",
            game_state: { rounds: 0, player1Score: 0, player2Score: 0 },
          })
          .eq("id", waitingSessions.id)
          .select()
          .single();

        if (updateError) throw updateError;

        await supabase.from("matchmaking_queue").delete().eq("id", queueEntry.id);
        setGameSession(updated);
        setRounds(0);
        setMyScore(0);
        setOpponentScore(0);
        toast.success("Lawan ditemukan!");
      } else {
        const { data: newSession, error: sessionError } = await supabase
          .from("game_sessions")
          .insert({
            game_type: "rps",
            player1_id: currentUserId,
            status: "waiting",
          })
          .select()
          .single();

        if (sessionError) throw sessionError;
        setGameSession(newSession);

        const channel = supabase
          .channel("matchmaking:rps")
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "game_sessions",
              filter: `id=eq.${newSession.id}`,
            },
            async (payload) => {
              const updated = payload.new as any;
              if (updated.status === "active") {
                await supabase.from("matchmaking_queue").delete().eq("id", queueEntry.id);
                supabase.removeChannel(channel);
                toast.success("Lawan ditemukan!");
              }
            }
          )
          .subscribe();
      }
    } catch (e: any) {
      toast.error(e.message);
      setIsSearching(false);
    }
  };

  const makeChoice = async (choice: Choice) => {
    if (!gameSession || myChoice || !choice) return;

    setMyChoice(choice);
    const isPlayer1 = currentUserId === gameSession.player1_id;
    const state = gameSession.game_state || {};

    const updatedState = {
      ...state,
      [isPlayer1 ? "player1Choice" : "player2Choice"]: choice,
      rounds: state.rounds || 0,
      player1Score: state.player1Score || 0,
      player2Score: state.player2Score || 0,
    };

    if (updatedState.player1Choice && updatedState.player2Choice) {
      const winner = determineWinner(updatedState.player1Choice, updatedState.player2Choice);
      updatedState.rounds = (updatedState.rounds || 0) + 1;

      if (winner === "win") {
        updatedState[isPlayer1 ? "player1Score" : "player2Score"]++;
      } else if (winner === "lose") {
        updatedState[isPlayer1 ? "player2Score" : "player1Score"]++;
      }

      const isGameOver = updatedState.rounds >= 3;
      const finalWinner =
        updatedState.player1Score > updatedState.player2Score
          ? gameSession.player1_id
          : updatedState.player2Score > updatedState.player1Score
          ? gameSession.player2_id
          : null;

      await supabase
        .from("game_sessions")
        .update({
          game_state: isGameOver ? {} : updatedState,
          status: isGameOver ? "finished" : "active",
          winner_id: isGameOver ? finalWinner : null,
        })
        .eq("id", gameSession.id);

      if (!isGameOver) {
        setTimeout(() => {
          setMyChoice(null);
          setOpponentChoice(null);
          setResult("");
        }, 2000);
      }
    } else {
      await supabase
        .from("game_sessions")
        .update({ game_state: updatedState })
        .eq("id", gameSession.id);
    }
  };

  const determineWinner = (my: Choice, opp: Choice): string => {
    if (!my || !opp) return "";
    if (my === opp) return "draw";
    if (
      (my === "rock" && opp === "scissors") ||
      (my === "scissors" && opp === "paper") ||
      (my === "paper" && opp === "rock")
    ) {
      return "win";
    }
    return "lose";
  };

  const handleGameEnd = (session: any) => {
    const isPlayer1 = currentUserId === session.player1_id;
    const isWinner = session.winner_id === currentUserId;

    if (isWinner) {
      onScoreSubmit(100);
      toast.success("🎉 Kamu menang best of 3!");
    } else if (!session.winner_id) {
      onScoreSubmit(50);
      toast.info("Seri!");
    } else {
      toast.error("Kamu kalah!");
    }

    setTimeout(() => {
      setGameSession(null);
      setMyChoice(null);
      setOpponentChoice(null);
      setResult("");
      setRounds(0);
      setMyScore(0);
      setOpponentScore(0);
      setIsSearching(false);
    }, 3000);
  };

  const cancelSearch = async () => {
    if (gameSession) {
      await supabase.from("game_sessions").delete().eq("id", gameSession.id);
      await supabase
        .from("matchmaking_queue")
        .delete()
        .eq("user_id", currentUserId)
        .eq("game_type", "rps");
    }
    setGameSession(null);
    setIsSearching(false);
  };

  if (!gameSession) {
    return (
      <div className="text-center space-y-4">
        <p className="text-sm text-muted-foreground">Best of 3 rounds!</p>
        <Button onClick={findMatch} disabled={isSearching} className="w-full">
          {isSearching ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Mencari lawan...
            </>
          ) : (
            <>
              <Users className="mr-2 h-4 w-4" />
              Cari Lawan
            </>
          )}
        </Button>
      </div>
    );
  }

  if (gameSession.status === "waiting") {
    return (
      <div className="text-center space-y-4">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Menunggu lawan...</p>
        <Button onClick={cancelSearch} variant="outline" size="sm">
          Batal
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between text-sm font-semibold">
        <span>Round {rounds}/3</span>
        <span>
          {myScore} - {opponentScore}
        </span>
      </div>

      {result && (
        <div className="text-center p-3 bg-accent/10 rounded-lg">
          <p className="font-semibold">
            {result === "win" ? "🎉 Kamu Menang!" : result === "lose" ? "😔 Kamu Kalah" : "🤝 Seri"}
          </p>
        </div>
      )}

      {myChoice && opponentChoice ? (
        <div className="flex justify-around items-center p-4">
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-2">Kamu</p>
            {myChoice === "rock" && <Hand className="h-12 w-12 text-primary" />}
            {myChoice === "paper" && <FileText className="h-12 w-12 text-primary" />}
            {myChoice === "scissors" && <Scissors className="h-12 w-12 text-primary" />}
          </div>
          <span className="text-2xl">VS</span>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-2">Lawan</p>
            {opponentChoice === "rock" && <Hand className="h-12 w-12 text-accent" />}
            {opponentChoice === "paper" && <FileText className="h-12 w-12 text-accent" />}
            {opponentChoice === "scissors" && <Scissors className="h-12 w-12 text-accent" />}
          </div>
        </div>
      ) : (
        <>
          <p className="text-center text-sm text-muted-foreground">
            {myChoice ? "Menunggu lawan..." : "Pilih:"}
          </p>
          <div className="grid grid-cols-3 gap-2">
            <Button
              onClick={() => makeChoice("rock")}
              disabled={!!myChoice}
              variant="outline"
              className="h-20 flex flex-col gap-1"
            >
              <Hand className="h-6 w-6" />
              <span className="text-xs">Batu</span>
            </Button>
            <Button
              onClick={() => makeChoice("paper")}
              disabled={!!myChoice}
              variant="outline"
              className="h-20 flex flex-col gap-1"
            >
              <FileText className="h-6 w-6" />
              <span className="text-xs">Kertas</span>
            </Button>
            <Button
              onClick={() => makeChoice("scissors")}
              disabled={!!myChoice}
              variant="outline"
              className="h-20 flex flex-col gap-1"
            >
              <Scissors className="h-6 w-6" />
              <span className="text-xs">Gunting</span>
            </Button>
          </div>
        </>
      )}

      {gameSession.status === "finished" && (
        <div className="text-center p-3 bg-accent/10 rounded-lg">
          <Trophy className="mx-auto h-6 w-6 text-accent mb-2" />
          <p className="font-semibold">
            {gameSession.winner_id === currentUserId
              ? "Kamu Menang Game!"
              : gameSession.winner_id
              ? "Kamu Kalah Game"
              : "Seri!"}
          </p>
        </div>
      )}
    </div>
  );
};

export default RockPaperScissors;