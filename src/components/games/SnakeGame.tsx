import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Play, RotateCcw, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  onScoreSubmit: (score: number) => void;
}

type Point = { x: number; y: number };
type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";

const GRID_SIZE = 20;
const SPEED = 150;

export default function SnakeGame({ onScoreSubmit }: Props) {
  const [snake, setSnake] = useState<Point[]>([{ x: 10, y: 10 }]);
  const [food, setFood] = useState<Point>({ x: 15, y: 10 });
  const [direction, setDirection] = useState<Direction>("RIGHT");
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState<"idle" | "playing" | "gameover">("idle");
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);
  const directionRef = useRef<Direction>("RIGHT");

  const generateFood = useCallback((currentSnake: Point[]) => {
    let newFood;
    while (true) {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
      // Check if food spawns on snake
      const onSnake = currentSnake.some(segment => segment.x === newFood.x && segment.y === newFood.y);
      if (!onSnake) break;
    }
    return newFood;
  }, []);

  const startGame = () => {
    setSnake([{ x: 10, y: 10 }]);
    setFood(generateFood([{ x: 10, y: 10 }]));
    setDirection("RIGHT");
    directionRef.current = "RIGHT";
    setScore(0);
    setGameState("playing");
  };

  const endGame = useCallback(() => {
    if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    setGameState("gameover");
    onScoreSubmit(score);
  }, [score, onScoreSubmit]);

  useEffect(() => {
    if (gameState === "playing") {
      gameLoopRef.current = setInterval(() => {
        setSnake((prevSnake) => {
          const head = { ...prevSnake[0] };

          switch (directionRef.current) {
            case "UP": head.y -= 1; break;
            case "DOWN": head.y += 1; break;
            case "LEFT": head.x -= 1; break;
            case "RIGHT": head.x += 1; break;
          }

          // Check collisions
          if (
            head.x < 0 || head.x >= GRID_SIZE ||
            head.y < 0 || head.y >= GRID_SIZE ||
            prevSnake.some(segment => segment.x === head.x && segment.y === head.y)
          ) {
            endGame();
            return prevSnake;
          }

          const newSnake = [head, ...prevSnake];

          // Check food
          if (head.x === food.x && head.y === food.y) {
            setScore(s => s + 10);
            setFood(generateFood(newSnake));
            // Don't pop tail (grow)
          } else {
            newSnake.pop();
          }

          return newSnake;
        });
      }, SPEED);
    }

    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, [gameState, food, endGame, generateFood]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== "playing") return;
      
      const currentDir = directionRef.current;
      
      if (e.key === "ArrowUp" && currentDir !== "DOWN") {
        e.preventDefault();
        directionRef.current = "UP";
        setDirection("UP");
      } else if (e.key === "ArrowDown" && currentDir !== "UP") {
        e.preventDefault();
        directionRef.current = "DOWN";
        setDirection("DOWN");
      } else if (e.key === "ArrowLeft" && currentDir !== "RIGHT") {
        e.preventDefault();
        directionRef.current = "LEFT";
        setDirection("LEFT");
      } else if (e.key === "ArrowRight" && currentDir !== "LEFT") {
        e.preventDefault();
        directionRef.current = "RIGHT";
        setDirection("RIGHT");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gameState]);

  const handleControl = (dir: Direction) => {
      const currentDir = directionRef.current;
      if (dir === "UP" && currentDir !== "DOWN") { directionRef.current = "UP"; setDirection("UP"); }
      if (dir === "DOWN" && currentDir !== "UP") { directionRef.current = "DOWN"; setDirection("DOWN"); }
      if (dir === "LEFT" && currentDir !== "RIGHT") { directionRef.current = "LEFT"; setDirection("LEFT"); }
      if (dir === "RIGHT" && currentDir !== "LEFT") { directionRef.current = "RIGHT"; setDirection("RIGHT"); }
  };

  if (gameState === "idle") {
    return (
      <div className="grid place-items-center gap-6 py-10 text-center">
        <div className="space-y-2">
          <h3 className="text-2xl font-bold text-foreground">Snake Classic</h3>
          <p className="text-muted-foreground">Makan apel sebanyak mungkin tanpa menabrak!</p>
        </div>
        <div className="relative w-32 h-32 bg-muted/30 rounded-xl border border-border overflow-hidden opacity-70">
            <div className="absolute top-10 left-10 w-4 h-4 bg-emerald-500 rounded-sm" />
            <div className="absolute top-10 left-14 w-4 h-4 bg-emerald-500/60 rounded-sm" />
            <div className="absolute top-10 left-18 w-4 h-4 bg-emerald-500/40 rounded-sm" />
            <div className="absolute top-20 left-20 w-4 h-4 bg-red-500 rounded-full animate-pulse" />
        </div>
        <Button onClick={startGame} size="lg" className="rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700">
          <Play className="mr-2 h-5 w-5" /> Mulai Game
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-sm mx-auto">
      <div className="flex items-center justify-between">
        <div className="bg-muted/50 px-4 py-2 rounded-xl border border-border/50 flex items-center gap-2">
          <Trophy className="h-4 w-4 text-emerald-500" />
          <span className="font-mono font-bold text-xl">{score}</span>
        </div>
        <Button onClick={startGame} variant="ghost" size="icon" className="rounded-xl h-10 w-10 text-muted-foreground hover:text-foreground">
            <RotateCcw className="h-5 w-5" />
        </Button>
      </div>

      <div className="relative w-full aspect-square bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden ring-4 ring-slate-900/50">
        {/* Grid Background */}
        <div className="absolute inset-0 opacity-10" style={{ 
            backgroundImage: "linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)", 
            backgroundSize: `${100/GRID_SIZE}% ${100/GRID_SIZE}%` 
        }} />

        {/* Snake */}
        {snake.map((segment, i) => (
          <div
            key={`${segment.x}-${segment.y}-${i}`}
            className={cn(
                "absolute rounded-sm transition-all duration-75",
                i === 0 ? "bg-emerald-400 z-10" : "bg-emerald-600 z-0"
            )}
            style={{
              left: `${(segment.x / GRID_SIZE) * 100}%`,
              top: `${(segment.y / GRID_SIZE) * 100}%`,
              width: `${100 / GRID_SIZE}%`,
              height: `${100 / GRID_SIZE}%`,
            }}
          >
              {i === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center gap-[2px]">
                      <div className="w-[2px] h-[2px] bg-black rounded-full" />
                      <div className="w-[2px] h-[2px] bg-black rounded-full" />
                  </div>
              )}
          </div>
        ))}

        {/* Food */}
        <div
          className="absolute bg-red-500 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.6)] animate-pulse"
          style={{
            left: `${(food.x / GRID_SIZE) * 100}%`,
            top: `${(food.y / GRID_SIZE) * 100}%`,
            width: `${100 / GRID_SIZE}%`,
            height: `${100 / GRID_SIZE}%`,
            transform: "scale(0.8)"
          }}
        />

        {gameState === "gameover" && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-20 animate-in fade-in duration-300">
                <p className="text-red-500 font-bold text-lg mb-2">Game Over!</p>
                <p className="text-4xl font-mono font-black text-white mb-6">{score}</p>
                <Button onClick={startGame} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-8">
                    Main Lagi
                </Button>
            </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 max-w-[200px] mx-auto md:hidden">
        <div />
        <Button variant="secondary" size="icon" className="h-14 rounded-2xl bg-muted/80" onPointerDown={(e) => { e.preventDefault(); handleControl("UP"); }}><ChevronUp className="h-6 w-6" /></Button>
        <div />
        <Button variant="secondary" size="icon" className="h-14 rounded-2xl bg-muted/80" onPointerDown={(e) => { e.preventDefault(); handleControl("LEFT"); }}><ChevronLeft className="h-6 w-6" /></Button>
        <Button variant="secondary" size="icon" className="h-14 rounded-2xl bg-muted/80" onPointerDown={(e) => { e.preventDefault(); handleControl("DOWN"); }}><ChevronDown className="h-6 w-6" /></Button>
        <Button variant="secondary" size="icon" className="h-14 rounded-2xl bg-muted/80" onPointerDown={(e) => { e.preventDefault(); handleControl("RIGHT"); }}><ChevronRight className="h-6 w-6" /></Button>
      </div>

      <p className="text-center text-xs text-muted-foreground hidden md:block">
        Gunakan tombol panah untuk mengarahkan ular
      </p>
    </div>
  );
}
