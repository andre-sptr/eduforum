import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Users, Trophy, X, Circle } from "lucide-react";

interface TicTacToeProps {
  currentUserId: string;
  onScoreSubmit: (score: number) => void;
}

const TicTacToe = ({ currentUserId, onScoreSubmit }: TicTacToeProps) => {
  const [isSearching, setIsSearching] = useState(false);
  const [gameSession, setGameSession] = useState<any>(null);
  const [board, setBoard] = useState<string[]>(Array(9).fill(""));
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [mySymbol, setMySymbol] = useState<"X" | "O">("X");

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
          
          if (updated.game_state?.board) {
            setBoard(updated.game_state.board);
          }
          
          if (updated.status === "active") {
            const isPlayer1 = currentUserId === updated.player1_id;
            setMySymbol(isPlayer1 ? "X" : "O");
            setIsMyTurn(
              updated.game_state?.currentTurn === (isPlayer1 ? "X" : "O")
            );
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
      // Join matchmaking queue
      const { data: queueEntry, error: queueError } = await supabase
        .from("matchmaking_queue")
        .insert({ user_id: currentUserId, game_type: "tictactoe" })
        .select()
        .single();

      if (queueError) throw queueError;

      // Look for waiting opponent
      const { data: waitingSessions } = await supabase
        .from("game_sessions")
        .select("*")
        .eq("game_type", "tictactoe")
        .eq("status", "waiting")
        .is("player2_id", null)
        .neq("player1_id", currentUserId)
        .limit(1)
        .single();

      if (waitingSessions) {
        // Join existing session
        const { data: updated, error: updateError } = await supabase
          .from("game_sessions")
          .update({
            player2_id: currentUserId,
            status: "active",
            game_state: { board: Array(9).fill(""), currentTurn: "X" },
          })
          .eq("id", waitingSessions.id)
          .select()
          .single();

        if (updateError) throw updateError;

        await supabase
          .from("matchmaking_queue")
          .delete()
          .eq("id", queueEntry.id);

        setGameSession(updated);
        setBoard(Array(9).fill(""));
        setMySymbol("O");
        setIsMyTurn(false);
        toast.success("Lawan ditemukan!");
      } else {
        // Create new session
        const { data: newSession, error: sessionError } = await supabase
          .from("game_sessions")
          .insert({
            game_type: "tictactoe",
            player1_id: currentUserId,
            status: "waiting",
          })
          .select()
          .single();

        if (sessionError) throw sessionError;

        setGameSession(newSession);
        setMySymbol("X");

        // Wait for opponent
        const channel = supabase
          .channel("matchmaking:tictactoe")
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
                await supabase
                  .from("matchmaking_queue")
                  .delete()
                  .eq("id", queueEntry.id);
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

  const makeMove = async (index: number) => {
    if (!isMyTurn || board[index] || !gameSession) return;

    const newBoard = [...board];
    newBoard[index] = mySymbol;
    setBoard(newBoard);

    const winner = checkWinner(newBoard);
    const isDraw = !winner && newBoard.every((cell) => cell !== "");

    const { error } = await supabase
      .from("game_sessions")
      .update({
        game_state: {
          board: newBoard,
          currentTurn: mySymbol === "X" ? "O" : "X",
        },
        status: winner || isDraw ? "finished" : "active",
        winner_id: winner ? currentUserId : null,
      })
      .eq("id", gameSession.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    setIsMyTurn(false);
  };

  const checkWinner = (board: string[]): boolean => {
    const lines = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8],
      [2, 4, 6],
    ];

    for (const [a, b, c] of lines) {
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return true;
      }
    }
    return false;
  };

  const handleGameEnd = (session: any) => {
    const isWinner = session.winner_id === currentUserId;
    const isDraw = !session.winner_id;

    if (isWinner) {
      onScoreSubmit(100);
      toast.success("🎉 Kamu menang!");
    } else if (isDraw) {
      onScoreSubmit(50);
      toast.info("Seri!");
    } else {
      toast.error("Kamu kalah!");
    }

    setTimeout(() => {
      setGameSession(null);
      setBoard(Array(9).fill(""));
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
        .eq("game_type", "tictactoe");
    }
    setGameSession(null);
    setIsSearching(false);
  };

  if (!gameSession) {
    return (
      <div className="text-center space-y-4">
        <p className="text-sm text-muted-foreground">
          Main Tic Tac Toe melawan pemain lain!
        </p>
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
        <p className="text-sm text-muted-foreground">
          Menunggu lawan...
        </p>
        <Button onClick={cancelSearch} variant="outline" size="sm">
          Batal
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Circle className="h-4 w-4 text-primary" />
          <span>Kamu: {mySymbol}</span>
        </div>
        <div className={`font-semibold ${isMyTurn ? "text-accent" : "text-muted-foreground"}`}>
          {isMyTurn ? "Giliran kamu" : "Giliran lawan"}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {board.map((cell, i) => (
          <button
            key={i}
            onClick={() => makeMove(i)}
            disabled={!isMyTurn || cell !== "" || gameSession.status !== "active"}
            className="aspect-square flex items-center justify-center text-3xl font-bold bg-muted hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            {cell === "X" ? (
              <X className="h-8 w-8 text-destructive" />
            ) : cell === "O" ? (
              <Circle className="h-8 w-8 text-primary" />
            ) : null}
          </button>
        ))}
      </div>

      {gameSession.status === "finished" && (
        <div className="text-center p-3 bg-accent/10 rounded-lg">
          <Trophy className="mx-auto h-6 w-6 text-accent mb-2" />
          <p className="font-semibold">
            {gameSession.winner_id === currentUserId
              ? "Kamu Menang!"
              : gameSession.winner_id
              ? "Kamu Kalah"
              : "Seri!"}
          </p>
        </div>
      )}
    </div>
  );
};

export default TicTacToe;