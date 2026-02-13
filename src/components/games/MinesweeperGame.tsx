import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Play, RotateCcw, Flag, Bomb, Timer } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  onScoreSubmit: (score: number) => void;
}

type Cell = {
  x: number;
  y: number;
  isMine: boolean;
  isRevealed: boolean;
  isFlagged: boolean;
  neighborMines: number;
};

const ROWS = 9;
const COLS = 9;
const MINES = 10;

export default function MinesweeperGame({ onScoreSubmit }: Props) {
  const [grid, setGrid] = useState<Cell[][]>([]);
  const [gameState, setGameState] = useState<"idle" | "playing" | "won" | "lost">("idle");
  const [time, setTime] = useState(0);
  const [flagsLeft, setFlagsLeft] = useState(MINES);
  const [firstClick, setFirstClick] = useState(true);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (gameState === "playing") {
      interval = setInterval(() => setTime((t) => t + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [gameState]);

  const initGame = useCallback(() => {
    const newGrid: Cell[][] = [];
    for (let i = 0; i < ROWS; i++) {
      const row: Cell[] = [];
      for (let j = 0; j < COLS; j++) {
        row.push({
          x: i,
          y: j,
          isMine: false,
          isRevealed: false,
          isFlagged: false,
          neighborMines: 0,
        });
      }
      newGrid.push(row);
    }
    setGrid(newGrid);
    setGameState("playing");
    setTime(0);
    setFlagsLeft(MINES);
    setFirstClick(true);
  }, []);

  const placeMines = (clickedX: number, clickedY: number, currentGrid: Cell[][]) => {
    let minesPlaced = 0;
    while (minesPlaced < MINES) {
      const x = Math.floor(Math.random() * ROWS);
      const y = Math.floor(Math.random() * COLS);
      // Avoid placing mine on first click or existing mine
      if ((x !== clickedX || y !== clickedY) && !currentGrid[x][y].isMine) {
        currentGrid[x][y].isMine = true;
        minesPlaced++;
      }
    }
    // Calculate numbers
    for (let i = 0; i < ROWS; i++) {
      for (let j = 0; j < COLS; j++) {
        if (!currentGrid[i][j].isMine) {
          let count = 0;
          for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
              const ni = i + dx;
              const nj = j + dy;
              if (ni >= 0 && ni < ROWS && nj >= 0 && nj < COLS && currentGrid[ni][nj].isMine) {
                count++;
              }
            }
          }
          currentGrid[i][j].neighborMines = count;
        }
      }
    }
    return currentGrid;
  };

  const reveal = (x: number, y: number) => {
    if (gameState !== "playing" && gameState !== "idle") return;
    
    let currentGrid = [...grid.map(row => [...row.map(cell => ({ ...cell }))])];
    
    if (gameState === "idle" || firstClick) {
        currentGrid = placeMines(x, y, currentGrid);
        setFirstClick(false);
        setGameState("playing");
    }

    const cell = currentGrid[x][y];
    if (cell.isRevealed || cell.isFlagged) return;

    if (cell.isMine) {
      // Game Over
      cell.isRevealed = true;
      revealAllMines(currentGrid);
      setGameState("lost");
      setGrid(currentGrid);
      return;
    }

    // Flood fill
    const stack = [{ x, y }];
    while (stack.length > 0) {
      const { x: cx, y: cy } = stack.pop()!;
      const current = currentGrid[cx][cy];
      
      if (!current.isRevealed && !current.isFlagged) {
        current.isRevealed = true;
        if (current.neighborMines === 0) {
          for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
              const nx = cx + dx;
              const ny = cy + dy;
              if (nx >= 0 && nx < ROWS && ny >= 0 && ny < COLS && !currentGrid[nx][ny].isRevealed) {
                stack.push({ x: nx, y: ny });
              }
            }
          }
        }
      }
    }

    setGrid(currentGrid);
    checkWin(currentGrid);
  };

  const toggleFlag = (x: number, y: number, e: React.MouseEvent) => {
    e.preventDefault();
    if (gameState !== "playing") return;

    const currentGrid = [...grid.map(row => [...row])];
    const cell = currentGrid[x][y];

    if (cell.isRevealed) return;

    if (cell.isFlagged) {
      cell.isFlagged = false;
      setFlagsLeft(f => f + 1);
    } else {
      if (flagsLeft > 0) {
        cell.isFlagged = true;
        setFlagsLeft(f => f - 1);
      }
    }
    setGrid(currentGrid);
  };

  const revealAllMines = (g: Cell[][]) => {
    g.forEach(row => row.forEach(cell => {
      if (cell.isMine) cell.isRevealed = true;
    }));
  };

  const checkWin = (g: Cell[][]) => {
    let revealedCount = 0;
    g.forEach(row => row.forEach(cell => {
      if (cell.isRevealed) revealedCount++;
    }));

    if (revealedCount === ROWS * COLS - MINES) {
      setGameState("won");
      const finalScore = Math.max(0, 1000 - time * 2); // Score based on time
      onScoreSubmit(finalScore);
    }
  };

  const getCellColor = (cell: Cell) => {
    if (!cell.isRevealed) return "bg-slate-300 hover:bg-slate-200 border-b-4 border-r-4 border-slate-400 active:border-0 active:translate-y-[2px] active:translate-x-[2px]";
    if (cell.isMine) return "bg-red-500 border border-red-600";
    return "bg-slate-100 border border-slate-200";
  };

  const getNumberColor = (n: number) => {
    const colors = ["", "text-blue-600", "text-green-600", "text-red-600", "text-purple-800", "text-amber-800", "text-cyan-600", "text-black", "text-gray-600"];
    return colors[n] || "text-black";
  };

  if (gameState === "idle") {
    return (
      <div className="grid place-items-center gap-6 py-10 text-center">
        <div className="space-y-2">
          <h3 className="text-2xl font-bold text-foreground">Minesweeper</h3>
          <p className="text-muted-foreground">Temukan semua ranjau tanpa meledak!</p>
        </div>
        <div className="flex gap-2 opacity-60">
            <div className="h-8 w-8 bg-slate-300 rounded border border-slate-400" />
            <div className="h-8 w-8 bg-slate-300 rounded border border-slate-400 flex items-center justify-center"><Flag className="h-4 w-4 text-red-500" /></div>
            <div className="h-8 w-8 bg-slate-100 rounded border border-slate-200 flex items-center justify-center font-bold text-blue-600">1</div>
        </div>
        <Button onClick={initGame} size="lg" className="rounded-2xl bg-blue-600 text-white hover:bg-blue-700">
          <Play className="mr-2 h-5 w-5" /> Mulai Game
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-sm mx-auto">
      <div className="flex items-center justify-between bg-slate-100 p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
            <div className="bg-red-100 text-red-600 p-1.5 rounded-lg">
                <Flag className="h-5 w-5" />
            </div>
            <span className="font-mono text-xl font-bold text-slate-700">{flagsLeft}</span>
        </div>
        
        <Button onClick={initGame} variant="ghost" size="icon" className="h-10 w-10">
           {gameState === "playing" ? "🙂" : gameState === "won" ? "😎" : "😵"}
        </Button>

        <div className="flex items-center gap-2">
            <div className="bg-blue-100 text-blue-600 p-1.5 rounded-lg">
                <Timer className="h-5 w-5" />
            </div>
            <span className="font-mono text-xl font-bold text-slate-700">{time}</span>
        </div>
      </div>

      <div 
        className="grid gap-1 p-3 bg-slate-200 rounded-xl border-4 border-slate-300 shadow-inner mx-auto w-fit select-none"
        style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {grid.map((row, i) => (
          row.map((cell, j) => (
            <div
              key={`${i}-${j}`}
              onClick={() => reveal(i, j)}
              onContextMenu={(e) => toggleFlag(i, j, e)}
              className={cn(
                "w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-lg font-bold rounded-sm transition-colors cursor-pointer",
                getCellColor(cell)
              )}
            >
              {cell.isRevealed ? (
                cell.isMine ? <Bomb className="h-5 w-5 text-white fill-white animate-pulse" /> : (cell.neighborMines > 0 && cell.neighborMines)
              ) : (
                cell.isFlagged && <Flag className="h-4 w-4 text-red-600 fill-red-600" />
              )}
              {cell.isRevealed && !cell.isMine && cell.neighborMines > 0 && (
                 <span className={getNumberColor(cell.neighborMines)}>{cell.neighborMines}</span>
              )}
            </div>
          ))
        ))}
      </div>

      {gameState !== "playing" && (
          <div className="text-center animate-in slide-in-from-bottom-2">
              <p className={cn("text-lg font-bold mb-2", gameState === "won" ? "text-green-600" : "text-red-500")}>
                  {gameState === "won" ? "Menang! Selamat!" : "Game Over! Coba lagi."}
              </p>
              <Button onClick={initGame} className="rounded-xl">Main Lagi</Button>
          </div>
      )}
      
      <p className="text-center text-xs text-muted-foreground hidden md:block">
        Klik Kiri: Buka • Klik Kanan: Bendera
      </p>
      <p className="text-center text-xs text-muted-foreground md:hidden">
        Tap: Buka • Tahan: Bendera
      </p>
    </div>
  );
}
