import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Play, RotateCcw } from "lucide-react";

interface ColorMatchProps {
  onScoreSubmit: (score: number) => void;
}

const COLORS = [
  { name: 'Merah', color: 'bg-red-500', text: 'text-red-500' },
  { name: 'Biru', color: 'bg-blue-500', text: 'text-blue-500' },
  { name: 'Hijau', color: 'bg-green-500', text: 'text-green-500' },
  { name: 'Kuning', color: 'bg-yellow-500', text: 'text-yellow-500' },
  { name: 'Ungu', color: 'bg-purple-500', text: 'text-purple-500' },
];

export default function ColorMatch({ onScoreSubmit }: ColorMatchProps) {
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'finished'>('idle');
  const [wordColor, setWordColor] = useState<string>('');
  const [displayColor, setDisplayColor] = useState<string>('');
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (gameState === 'playing' && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            finishGame();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [gameState, timeLeft]);

  const initializeGame = () => {
    setScore(0);
    setTimeLeft(30);
    setStreak(0);
    setGameState('playing');
    nextRound();
  };

  const nextRound = () => {
    const word = COLORS[Math.floor(Math.random() * COLORS.length)];
    const display = COLORS[Math.floor(Math.random() * COLORS.length)];
    setWordColor(word.name);
    setDisplayColor(display.text);
  };

  const handleAnswer = (isMatch: boolean) => {
    const actualMatch = wordColor === COLORS.find(c => c.text === displayColor)?.name;
    
    if ((isMatch && actualMatch) || (!isMatch && !actualMatch)) {
      const points = 10 + (streak * 2);
      setScore(prev => prev + points);
      setStreak(prev => prev + 1);
    } else {
      setStreak(0);
    }
    
    nextRound();
  };

  const finishGame = () => {
    setGameState('finished');
    onScoreSubmit(score);
  };

  if (gameState === 'idle') {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground mb-4">
          Cocokkan kata dengan warna dalam 30 detik!
        </p>
        <Button onClick={initializeGame} size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Play className="mr-2 h-4 w-4" />
          Mulai Game
        </Button>
      </div>
    );
  }

  if (gameState === 'finished') {
    return (
      <div className="text-center py-8">
        <div className="mb-4">
          <div className="text-4xl font-bold text-accent mb-2">{score}</div>
          <p className="text-muted-foreground">Skor Akhir</p>
        </div>
        <Button onClick={initializeGame} size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
          <RotateCcw className="mr-2 h-4 w-4" />
          Main Lagi
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Waktu: <span className="font-bold text-foreground">{timeLeft}s</span></span>
        <span className="text-muted-foreground">Skor: <span className="font-bold text-accent">{score}</span></span>
        <span className="text-muted-foreground">Streak: <span className="font-bold text-foreground">{streak}</span></span>
      </div>

      <div className="text-center py-8">
        <p className="text-sm text-muted-foreground mb-4">Apakah kata dan warna cocok?</p>
        <p className={`text-4xl font-bold mb-8 ${displayColor}`}>
          {wordColor}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Button 
          onClick={() => handleAnswer(true)}
          className="h-16 text-lg bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Cocok ✓
        </Button>
        <Button 
          onClick={() => handleAnswer(false)}
          className="h-16 text-lg bg-destructive text-destructive-foreground hover:bg-destructive/90"
        >
          Tidak ✗
        </Button>
      </div>
    </div>
  );
}
