import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Users, Trophy, Clock } from "lucide-react";

interface WordScrambleProps {
  currentUserId: string;
  onScoreSubmit: (score: number) => void;
}

const words = [
  { word: "JAVASCRIPT", hint: "Bahasa pemrograman web" },
  { word: "COMPUTER", hint: "Alat elektronik" },
  { word: "INTERNET", hint: "Jaringan global" },
  { word: "DATABASE", hint: "Penyimpanan data" },
  { word: "EDUCATION", hint: "Pendidikan" },
  { word: "PROGRAMMING", hint: "Menulis kode" },
  { word: "ALGORITHM", hint: "Langkah penyelesaian" },
  { word: "DEVELOPER", hint: "Pembuat aplikasi" },
];

const WordScramble = ({ currentUserId, onScoreSubmit }: WordScrambleProps) => {
  const [isSearching, setIsSearching] = useState(false);
  const [gameSession, setGameSession] = useState<any>(null);
  const [scrambledWord, setScrambledWord] = useState("");
  const [hint, setHint] = useState("");
  const [answer, setAnswer] = useState("");
  const [timeLeft, setTimeLeft] = useState(30);
  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [round, setRound] = useState(1);

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

            if (state.currentWord && !scrambledWord) {
              setScrambledWord(state.scrambledWord);
              setHint(state.hint);
              setTimeLeft(30);
            }

            setMyScore(isPlayer1 ? state.player1Score || 0 : state.player2Score || 0);
            setOpponentScore(isPlayer1 ? state.player2Score || 0 : state.player1Score || 0);
            setRound(state.round || 1);
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

  useEffect(() => {
    if (gameSession?.status !== "active" || !scrambledWord) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameSession?.status, scrambledWord]);

  const findMatch = async () => {
    setIsSearching(true);
    try {
      const { data: queueEntry, error: queueError } = await supabase
        .from("matchmaking_queue")
        .insert({ user_id: currentUserId, game_type: "wordscramble" })
        .select()
        .single();

      if (queueError) throw queueError;

      const { data: waitingSessions } = await supabase
        .from("game_sessions")
        .select("*")
        .eq("game_type", "wordscramble")
        .eq("status", "waiting")
        .is("player2_id", null)
        .neq("player1_id", currentUserId)
        .limit(1)
        .single();

      if (waitingSessions) {
        const wordObj = words[Math.floor(Math.random() * words.length)];
        const scrambled = wordObj.word
          .split("")
          .sort(() => Math.random() - 0.5)
          .join("");

        const { data: updated, error: updateError } = await supabase
          .from("game_sessions")
          .update({
            player2_id: currentUserId,
            status: "active",
            game_state: {
              round: 1,
              player1Score: 0,
              player2Score: 0,
              currentWord: wordObj.word,
              scrambledWord: scrambled,
              hint: wordObj.hint,
            },
          })
          .eq("id", waitingSessions.id)
          .select()
          .single();

        if (updateError) throw updateError;

        await supabase.from("matchmaking_queue").delete().eq("id", queueEntry.id);
        setGameSession(updated);
        setScrambledWord(scrambled);
        setHint(wordObj.hint);
        setRound(1);
        setMyScore(0);
        setOpponentScore(0);
        setTimeLeft(30);
        toast.success("Lawan ditemukan!");
      } else {
        const { data: newSession, error: sessionError } = await supabase
          .from("game_sessions")
          .insert({
            game_type: "wordscramble",
            player1_id: currentUserId,
            status: "waiting",
          })
          .select()
          .single();

        if (sessionError) throw sessionError;
        setGameSession(newSession);

        const channel = supabase
          .channel("matchmaking:wordscramble")
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

  const submitAnswer = async () => {
    if (!answer.trim() || !gameSession) return;

    const state = gameSession.game_state;
    const isCorrect = answer.trim().toUpperCase() === state.currentWord;
    const isPlayer1 = currentUserId === gameSession.player1_id;

    if (isCorrect) {
      const updatedState = {
        ...state,
        [isPlayer1 ? "player1Score" : "player2Score"]: (state[isPlayer1 ? "player1Score" : "player2Score"] || 0) + 10,
      };

      if (state.round >= 3) {
        const finalWinner =
          updatedState.player1Score > updatedState.player2Score
            ? gameSession.player1_id
            : updatedState.player2Score > updatedState.player1Score
            ? gameSession.player2_id
            : null;

        await supabase
          .from("game_sessions")
          .update({
            status: "finished",
            winner_id: finalWinner,
          })
          .eq("id", gameSession.id);

        toast.success("Benar! Game selesai!");
      } else {
        const nextWord = words[Math.floor(Math.random() * words.length)];
        const scrambled = nextWord.word
          .split("")
          .sort(() => Math.random() - 0.5)
          .join("");

        await supabase
          .from("game_sessions")
          .update({
            game_state: {
              ...updatedState,
              round: state.round + 1,
              currentWord: nextWord.word,
              scrambledWord: scrambled,
              hint: nextWord.hint,
            },
          })
          .eq("id", gameSession.id);

        setAnswer("");
        toast.success("Benar! Kata berikutnya...");
      }
    } else {
      toast.error("Salah! Coba lagi");
      setAnswer("");
    }
  };

  const handleTimeUp = async () => {
    if (!gameSession) return;
    const state = gameSession.game_state;

    if (state.round >= 3) {
      const finalWinner =
        state.player1Score > state.player2Score
          ? gameSession.player1_id
          : state.player2Score > state.player1Score
          ? gameSession.player2_id
          : null;

      await supabase
        .from("game_sessions")
        .update({
          status: "finished",
          winner_id: finalWinner,
        })
        .eq("id", gameSession.id);
    } else {
      const nextWord = words[Math.floor(Math.random() * words.length)];
      const scrambled = nextWord.word
        .split("")
        .sort(() => Math.random() - 0.5)
        .join("");

      await supabase
        .from("game_sessions")
        .update({
          game_state: {
            ...state,
            round: state.round + 1,
            currentWord: nextWord.word,
            scrambledWord: scrambled,
            hint: nextWord.hint,
          },
        })
        .eq("id", gameSession.id);

      setAnswer("");
    }
  };

  const handleGameEnd = (session: any) => {
    const isWinner = session.winner_id === currentUserId;

    if (isWinner) {
      onScoreSubmit(100);
      toast.success("🎉 Kamu menang!");
    } else if (!session.winner_id) {
      onScoreSubmit(50);
      toast.info("Seri!");
    } else {
      toast.error("Kamu kalah!");
    }

    setTimeout(() => {
      setGameSession(null);
      setScrambledWord("");
      setHint("");
      setAnswer("");
      setTimeLeft(30);
      setRound(1);
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
        .eq("game_type", "wordscramble");
    }
    setGameSession(null);
    setIsSearching(false);
  };

  if (!gameSession) {
    return (
      <div className="text-center space-y-4">
        <p className="text-sm text-muted-foreground">Tebak kata yang diacak! 3 ronde</p>
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
      <div className="flex justify-between items-center">
        <span className="text-sm font-semibold">Round {round}/3</span>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Clock className="h-4 w-4" />
          <span className={timeLeft <= 10 ? "text-destructive" : ""}>{timeLeft}s</span>
        </div>
        <span className="text-sm font-semibold">
          {myScore} - {opponentScore}
        </span>
      </div>

      <div className="p-4 bg-muted rounded-lg space-y-2">
        <p className="text-xs text-muted-foreground">Hint: {hint}</p>
        <p className="text-2xl font-bold text-center tracking-widest">{scrambledWord}</p>
      </div>

      <div className="flex gap-2">
        <Input
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && submitAnswer()}
          placeholder="Ketik jawabanmu..."
          className="flex-1"
          maxLength={20}
        />
        <Button onClick={submitAnswer} disabled={!answer.trim()}>
          Kirim
        </Button>
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

export default WordScramble;
