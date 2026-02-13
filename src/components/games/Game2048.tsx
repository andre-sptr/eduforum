import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Play, RotateCcw, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSwipeable } from "react-swipeable";

interface Props {
  onScoreSubmit: (score: number) => void;
}

type Grid = number[][];

const SIZE = 4;

export default function Game2048({ onScoreSubmit }: Props) {
  const [grid, setGrid] = useState<Grid>([]);
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState<"idle" | "playing" | "gameover">("idle");
  const [highScore, setHighScore] = useState(0);

  // Initialize game
  const initGame = useCallback(() => {
    const newGrid = Array(SIZE).fill(0).map(() => Array(SIZE).fill(0));
    addRandomTile(newGrid);
    addRandomTile(newGrid);
    setGrid(newGrid);
    setScore(0);
    setGameState("playing");
  }, []);

  const addRandomTile = (currentGrid: Grid) => {
    const available = [];
    for (let i = 0; i < SIZE; i++) {
      for (let j = 0; j < SIZE; j++) {
        if (currentGrid[i][j] === 0) available.push({ r: i, c: j });
      }
    }
    if (available.length > 0) {
      const spot = available[Math.floor(Math.random() * available.length)];
      currentGrid[spot.r][spot.c] = Math.random() < 0.9 ? 2 : 4;
    }
  };

  // Check game over
  const checkGameOver = (currentGrid: Grid) => {
    // Check for empty cells
    for (let i = 0; i < SIZE; i++) {
      for (let j = 0; j < SIZE; j++) {
        if (currentGrid[i][j] === 0) return false;
      }
    }
    // Check for possible merges
    for (let i = 0; i < SIZE; i++) {
      for (let j = 0; j < SIZE; j++) {
        if (j < SIZE - 1 && currentGrid[i][j] === currentGrid[i][j + 1]) return false;
        if (i < SIZE - 1 && currentGrid[i][j] === currentGrid[i + 1][j]) return false;
      }
    }
    return true;
  };

  const move = useCallback((direction: "up" | "down" | "left" | "right") => {
    if (gameState !== "playing") return;

    setGrid((prevGrid) => {
      let newGrid = prevGrid.map((row) => [...row]);
      let moved = false;
      let points = 0;

      const rotate = (matrix: Grid) => matrix[0].map((_, i) => matrix.map(row => row[i]).reverse());
      const rotateBack = (matrix: Grid) => matrix[0].map((_, i) => matrix.map(row => row[row.length - 1 - i]));

      // Normalize to "left" movement
      if (direction === "right") newGrid = newGrid.map(row => row.reverse());
      if (direction === "up") newGrid = rotate(rotate(rotate(newGrid)));
      if (direction === "down") newGrid = rotate(newGrid);

      // Process "left" move
      for (let i = 0; i < SIZE; i++) {
        let row = newGrid[i].filter(val => val !== 0);
        for (let j = 0; j < row.length - 1; j++) {
          if (row[j] === row[j + 1]) {
            row[j] *= 2;
            points += row[j];
            row[j + 1] = 0;
          }
        }
        row = row.filter(val => val !== 0);
        while (row.length < SIZE) row.push(0);
        
        if (newGrid[i].join(",") !== row.join(",")) moved = true;
        newGrid[i] = row;
      }

      // Restore orientation
      if (direction === "right") newGrid = newGrid.map(row => row.reverse());
      if (direction === "up") newGrid = rotate(newGrid);
      if (direction === "down") newGrid = rotate(rotate(rotate(newGrid)));

      if (moved) {
        addRandomTile(newGrid);
        setScore(s => s + points);
        if (checkGameOver(newGrid)) {
          setGameState("gameover");
          onScoreSubmit(score + points);
        }
      }
      return newGrid;
    });
  }, [gameState, score, onScoreSubmit]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== "playing") return;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        if (e.key === "ArrowUp") move("up");
        if (e.key === "ArrowDown") move("down");
        if (e.key === "ArrowLeft") move("left");
        if (e.key === "ArrowRight") move("right");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gameState, move]);

  // Swipe handlers
  const handlers = useSwipeable({
    onSwipedLeft: () => move("left"),
    onSwipedRight: () => move("right"),
    onSwipedUp: () => move("up"),
    onSwipedDown: () => move("down"),
    preventScrollOnSwipe: true,
    trackMouse: true
  });

  const getTileColor = (val: number) => {
    const colors: Record<number, string> = {
      2: "bg-slate-200 text-slate-800",
      4: "bg-amber-100 text-amber-800",
      8: "bg-orange-200 text-orange-800",
      16: "bg-orange-300 text-orange-900",
      32: "bg-orange-400 text-white",
      64: "bg-orange-500 text-white",
      128: "bg-yellow-400 text-white shadow-inner",
      256: "bg-yellow-500 text-white shadow-inner",
      512: "bg-yellow-600 text-white shadow-md",
      1024: "bg-yellow-700 text-white shadow-md ring-2 ring-yellow-400/50",
      2048: "bg-yellow-800 text-white shadow-xl ring-4 ring-yellow-500/50",
    };
    return colors[val] || "bg-slate-900 text-white";
  };

  if (gameState === "idle") {
    return (
      <div className="grid place-items-center gap-6 py-10 text-center">
        <div className="space-y-2">
          <h3 className="text-2xl font-bold text-foreground">2048</h3>
          <p className="text-muted-foreground">Gabungkan angka yang sama hingga mencapai 2048!</p>
        </div>
        <div className="grid grid-cols-4 gap-2 opacity-50 pointer-events-none">
            {[2, 4, 8, 16].map(v => (
                <div key={v} className={`h-12 w-12 rounded-lg grid place-items-center font-bold text-lg ${getTileColor(v)}`}>{v}</div>
            ))}
        </div>
        <Button onClick={initGame} size="lg" className="rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90">
          <Play className="mr-2 h-5 w-5" /> Mulai Game
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-sm mx-auto" {...handlers}>
      <div className="flex items-center justify-between">
        <div className="bg-muted/50 px-4 py-2 rounded-xl border border-border/50">
          <p className="text-xs text-muted-foreground uppercase font-bold">Skor</p>
          <p className="text-2xl font-black text-primary">{score}</p>
        </div>
        <Button onClick={initGame} variant="outline" size="icon" className="rounded-xl h-12 w-12">
            <RotateCcw className="h-5 w-5" />
        </Button>
      </div>

      <div className="relative aspect-square bg-muted/30 p-3 rounded-2xl border border-border/50 shadow-inner">
        <div className="grid grid-cols-4 grid-rows-4 gap-2 h-full w-full">
            {grid.map((row, i) => (
                row.map((val, j) => (
                    <div 
                        key={`${i}-${j}`} 
                        className={cn(
                            "rounded-xl flex items-center justify-center font-bold transition-all duration-200 text-xl sm:text-2xl select-none",
                            val === 0 ? "bg-muted/40" : `${getTileColor(val)} animate-in zoom-in-50 duration-200`
                        )}
                    >
                        {val > 0 && val}
                    </div>
                ))
            ))}
        </div>
        
        {gameState === "gameover" && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center gap-4 animate-in fade-in duration-500 z-10">
                <div className="text-center">
                    <p className="text-muted-foreground font-medium">Game Over!</p>
                    <p className="text-4xl font-black text-foreground mb-2">{score}</p>
                </div>
                <Button onClick={initGame} size="lg" className="rounded-xl">
                    <RotateCcw className="mr-2 h-4 w-4" /> Coba Lagi
                </Button>
            </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 max-w-[200px] mx-auto md:hidden">
        <div />
        <Button variant="secondary" size="icon" className="h-12 rounded-xl" onClick={() => move("up")}><ChevronUp /></Button>
        <div />
        <Button variant="secondary" size="icon" className="h-12 rounded-xl" onClick={() => move("left")}><ChevronLeft /></Button>
        <Button variant="secondary" size="icon" className="h-12 rounded-xl" onClick={() => move("down")}><ChevronDown /></Button>
        <Button variant="secondary" size="icon" className="h-12 rounded-xl" onClick={() => move("right")}><ChevronRight /></Button>
      </div>
      
      <p className="text-center text-xs text-muted-foreground hidden md:block">
        Gunakan tombol panah untuk bermain
      </p>
    </div>
  );
}
