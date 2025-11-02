import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Play, RotateCcw } from "lucide-react";

interface NumberPuzzleProps {
  onScoreSubmit: (score: number) => void;
}

export default function NumberPuzzle({ onScoreSubmit }: NumberPuzzleProps) {
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'finished'>('idle');
  const [tiles, setTiles] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [time, setTime] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (gameState === 'playing') {
      interval = setInterval(() => {
        setTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [gameState]);

  const initializeGame = () => {
    const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 0];
    const shuffled = [...numbers].sort(() => Math.random() - 0.5);
    setTiles(shuffled);
    setMoves(0);
    setTime(0);
    setGameState('playing');
  };

  const isAdjacent = (index1: number, index2: number): boolean => {
    const row1 = Math.floor(index1 / 3);
    const col1 = index1 % 3;
    const row2 = Math.floor(index2 / 3);
    const col2 = index2 % 3;
    
    return (Math.abs(row1 - row2) === 1 && col1 === col2) || 
           (Math.abs(col1 - col2) === 1 && row1 === row2);
  };

  const handleTileClick = (index: number) => {
    const emptyIndex = tiles.indexOf(0);
    if (isAdjacent(index, emptyIndex)) {
      const newTiles = [...tiles];
      [newTiles[index], newTiles[emptyIndex]] = [newTiles[emptyIndex], newTiles[index]];
      setTiles(newTiles);
      setMoves(prev => prev + 1);

      const isSolved = newTiles.every((tile, idx) => idx === 8 ? tile === 0 : tile === idx + 1);
      if (isSolved) {
        finishGame();
      }
    }
  };

  const finishGame = () => {
    setGameState('finished');
    const score = Math.max(1000 - (moves * 10) - time, 100);
    onScoreSubmit(score);
  };

  if (gameState === 'idle') {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground mb-4">
          Susun angka 1-8 berurutan!
        </p>
        <Button onClick={initializeGame} size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90">
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
          <div className="text-4xl font-bold text-accent mb-2">{Math.max(1000 - (moves * 10) - time, 100)}</div>
          <p className="text-muted-foreground">Skor Akhir</p>
        </div>
        <p className="mb-4 text-foreground">
          Langkah: {moves} | Waktu: {time}s
        </p>
        <Button onClick={initializeGame} size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90">
          <RotateCcw className="mr-2 h-4 w-4" />
          Main Lagi
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Langkah: <span className="font-bold text-foreground">{moves}</span></span>
        <span className="text-muted-foreground">Waktu: <span className="font-bold text-foreground">{time}s</span></span>
      </div>

      <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
        {tiles.map((tile, index) => (
          <button
            key={index}
            onClick={() => tile !== 0 && handleTileClick(index)}
            className={`aspect-square flex items-center justify-center text-2xl font-bold rounded-lg transition-all transform hover:scale-105
              ${tile === 0 
                ? 'bg-muted cursor-default' 
                : 'bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer'
              }`}
          >
            {tile !== 0 && tile}
          </button>
        ))}
      </div>
    </div>
  );
}
