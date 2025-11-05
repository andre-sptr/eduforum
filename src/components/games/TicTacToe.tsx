import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Users, Trophy, X as XIcon, Circle as OIcon } from "lucide-react";
import { useOpponent } from "@/hooks/useOpponent";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface TicTacToeProps {
  currentUserId: string;
  onScoreSubmit: (score: number) => void;
}

type Json = string | number | boolean | null | { [key: string]: Json } | Json[];
type GameStatus = "waiting" | "active" | "finished";
type Cell = "" | "X" | "O";

interface GameState {
  board: Cell[];
  currentTurn: "X" | "O";
  move: number;
}

interface GameSession {
  id: string;
  game_type: "tictactoe";
  player1_id: string;
  player2_id: string | null;
  status: GameStatus;
  winner_id: string | null;
  created_at?: string;
  updated_at?: string;
  game_state: Json;
}

const emptyBoard: Cell[] = Array(9).fill("");

const initials = (n?: string) => {
  if (!n) return "U";
  const a = n.trim().split(/\s+/);
  return ((a[0]?.[0] ?? "U") + (a[1]?.[0] ?? "")).toUpperCase();
};

const TicTacToe = ({ currentUserId, onScoreSubmit }: TicTacToeProps) => {
  const [isSearching, setIsSearching] = useState(false);
  const [gameSession, setGameSession] = useState<GameSession | null>(null);
  const [mySymbol, setMySymbol] = useState<"X" | "O">("X");
  const [isMyTurn, setIsMyTurn] = useState(false);
  const { opponent, loadingOpponent } = useOpponent(gameSession, currentUserId);
  const mmChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const state = (gameSession?.game_state as unknown as GameState) || {
    board: emptyBoard,
    currentTurn: "X" as const,
    move: 0,
  };

  useEffect(() => {
    if (!gameSession?.id) return;
    const ch = supabase
      .channel(`game:${gameSession.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "game_sessions", filter: `id=eq.${gameSession.id}` },
        (payload) => {
          const updated = payload.new as GameSession;
          setGameSession(updated);
          if (updated.status === "active" && updated.game_state) {
            const s = updated.game_state as unknown as GameState;
            const isP1 = currentUserId === updated.player1_id;
            setMySymbol(isP1 ? "X" : "O");
            setIsMyTurn(s.currentTurn === (isP1 ? "X" : "O"));
            setIsSearching(false);
          }
          if (updated.status === "finished") handleGameEnd(updated);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [gameSession?.id, currentUserId]);

  const findMatch = async () => {
    setIsSearching(true);
    try {
      const { error: qErr } = await supabase
        .from("matchmaking_queue")
        .upsert({ user_id: currentUserId, game_type: "tictactoe" }, { onConflict: "user_id,game_type" });
      if (qErr) throw qErr;

      const { data: waiting } = await supabase
        .from("game_sessions")
        .select("*")
        .eq("game_type", "tictactoe")
        .eq("status", "waiting")
        .is("player2_id", null)
        .neq("player1_id", currentUserId)
        .limit(1)
        .single();

      if (waiting) {
        const init: GameState = { board: emptyBoard, currentTurn: "X", move: 0 };
        const { data: updated, error } = await supabase
          .from("game_sessions")
          .update({
            player2_id: currentUserId,
            status: "active",
            game_state: init as unknown as Json,
          })
          .eq("id", waiting.id)
          .is("player2_id", null)
          .eq("status", "waiting")
          .select()
          .single();
        if (error || !updated) {
          setIsSearching(false);
          toast.message("Sesi baru saja diambil, mencoba lagi...");
          return findMatch();
        }

        await supabase
          .from("matchmaking_queue")
          .delete()
          .eq("game_type", "tictactoe")
          .in("user_id", [currentUserId, waiting.player1_id]);

        setGameSession(updated as GameSession);
        setMySymbol("O");
        setIsSearching(false);
        toast.success("Lawan ditemukan!");
        return;
      }

      const { data: newSession, error: sErr } = await supabase
        .from("game_sessions")
        .insert({ game_type: "tictactoe", player1_id: currentUserId, status: "waiting" })
        .select()
        .single();
      if (sErr) throw sErr;

      setGameSession(newSession as GameSession);
      setMySymbol("X");

      const ch = supabase
        .channel(`matchmaking:tictactoe:${newSession.id}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "game_sessions", filter: `id=eq.${newSession.id}` },
          async (payload) => {
            const updated = payload.new as GameSession;
            if (updated.status === "active") {
              await supabase
                .from("matchmaking_queue")
                .delete()
                .eq("user_id", currentUserId)
                .eq("game_type", "tictactoe");
              setGameSession(updated);
              setIsSearching(false);
              toast.success("Lawan ditemukan!");
              if (mmChannelRef.current) supabase.removeChannel(mmChannelRef.current);
              mmChannelRef.current = null;
            }
          }
        )
        .subscribe();
      mmChannelRef.current = ch;
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal mencari lawan");
      setIsSearching(false);
    }
  };

  const checkWinner = (b: Cell[]): "X" | "O" | null => {
    const lines = [
      [0, 1, 2],[3, 4, 5],[6, 7, 8],
      [0, 3, 6],[1, 4, 7],[2, 5, 8],
      [0, 4, 8],[2, 4, 6],
    ];
    for (const [a, c, d] of lines) {
      if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a] as "X" | "O";
    }
    return null;
  };

  const makeMove = async (index: number) => {
    if (!gameSession || gameSession.status !== "active") return;
    if (!isMyTurn) return;
    const s = state;
    if (s.board[index] !== "") return;

    const symbol = mySymbol;
    const nextBoard = [...s.board] as Cell[];
    nextBoard[index] = symbol;
    const winnerSymbol = checkWinner(nextBoard);
    const isDraw = !winnerSymbol && nextBoard.every((c) => c !== "");
    const next: GameState = {
      board: nextBoard,
      currentTurn: symbol === "X" ? "O" : "X",
      move: s.move + 1,
    };

    const winnerId =
      winnerSymbol === "X" ? gameSession.player1_id :
      winnerSymbol === "O" ? gameSession.player2_id :
      null;

    const { error, data } = await supabase
      .from("game_sessions")
      .update({
        game_state: next as unknown as Json,
        status: winnerSymbol || isDraw ? "finished" : "active",
        winner_id: winnerSymbol ? winnerId : isDraw ? null : undefined,
      })
      .eq("id", gameSession.id)
      .contains("game_state", { move: s.move, currentTurn: symbol } as any)
      .select()
      .single();

    if (error) {
      toast.error("Langkah ditolak, giliran mungkin sudah berubah.");
      return;
    }

    setGameSession(data as GameSession);
    setIsMyTurn(false);
  };

  const handleGameEnd = (session: GameSession) => {
    const isWinner = session.winner_id === currentUserId;
    const isDraw = !session.winner_id;
    if (isWinner) { onScoreSubmit(100); toast.success("🎉 Kamu menang!"); }
    else if (isDraw) { onScoreSubmit(50); toast.info("Seri!"); }
    else { onScoreSubmit(0); toast.error("Kamu kalah!"); }
    setTimeout(() => {
      setGameSession(null);
      setIsSearching(false);
    }, 2500);
  };

  const cancelSearch = async () => {
    try {
      if (gameSession?.status === "waiting" && gameSession.player1_id === currentUserId) {
        await supabase.from("game_sessions").delete().eq("id", gameSession.id);
      }
      await supabase.from("matchmaking_queue").delete().eq("user_id", currentUserId).eq("game_type", "tictactoe");
    } finally {
      if (mmChannelRef.current) supabase.removeChannel(mmChannelRef.current);
      mmChannelRef.current = null;
      setGameSession(null);
      setIsSearching(false);
    }
  };

  if (!gameSession) {
    return (
      <div className="text-center space-y-4">
        <p className="text-sm text-muted-foreground">Main Tic Tac Toe melawan pemain lain!</p>
        <Button onClick={findMatch} disabled={isSearching} className="w-full">
          {isSearching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Users className="mr-2 h-4 w-4" />}
          {isSearching ? "Mencari lawan..." : "Cari Lawan"}
        </Button>
      </div>
    );
  }

  if (gameSession.status === "waiting") {
    return (
      <div className="text-center space-y-4">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Menunggu lawan...</p>
        <Button onClick={cancelSearch} variant="outline" size="sm">Batal</Button>
      </div>
    );
  }

  const board = state.board;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm mb-2">
        <div className="flex items-center gap-2">
          <Avatar className="h-7 w-7">
            <AvatarImage src={opponent?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
              {initials(opponent?.full_name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium leading-none">Lawan</p>
            <p className="text-[11px] text-muted-foreground">
              {loadingOpponent
                ? "Memuat…"
                : opponent?.full_name ?? (!gameSession?.player2_id ? "Menunggu…" : "Tidak diketahui")}
            </p>
          </div>
        </div>

        <span
          className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${
            isMyTurn ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          {isMyTurn ? "Giliran kamu" : "Giliran lawan"}
        </span>
      </div>

      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          {mySymbol === "X"
            ? <XIcon className="h-4 w-4 text-destructive" />
            : <OIcon className="h-4 w-4 text-primary" />
          }
          <span>Kamu: {mySymbol}</span>
        </div>
        <div className="text-xs text-muted-foreground">
          {gameSession.player1_id === currentUserId ? "Kamu = X" : "Kamu = O"}
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
            {cell === "X" ? <XIcon className="h-8 w-8 text-destructive" /> : cell === "O" ? <OIcon className="h-8 w-8 text-primary" /> : null}
          </button>
        ))}
      </div>
      {gameSession.status === "finished" && (
        <div className="text-center p-3 bg-accent/10 rounded-lg">
          <Trophy className="mx-auto h-6 w-6 text-accent mb-2" />
          <p className="font-semibold">
            {gameSession.winner_id === currentUserId ? "Kamu Menang!" : gameSession.winner_id ? "Kamu Kalah" : "Seri!"}
          </p>
        </div>
      )}
    </div>
  );
};

export default TicTacToe;