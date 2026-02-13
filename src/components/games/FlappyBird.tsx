import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Play, RotateCcw } from "lucide-react";

interface Props {
  onScoreSubmit: (score: number) => void;
}

const GRAVITY = 0.6;
const FLAP_STRENGTH = -8;
const PIPE_SPEED = 3;
const PIPE_SPAWN_RATE = 1500;
const GAP_SIZE = 150;
const GAME_HEIGHT = 500;
const GAME_WIDTH = 400;
const OBSTACLE_SPEED = 2;

export default function FlappyBird({ onScoreSubmit }: Props) {
  const [gameState, setGameState] = useState<"idle" | "playing" | "gameover">("idle");
  const [birdPos, setBirdPos] = useState(GAME_HEIGHT / 2);
  const [birdVelocity, setBirdVelocity] = useState(0);
  const [pipes, setPipes] = useState<{ x: number; topHeight: number; passed: boolean; hasMovingObstacle?: boolean; obstacleY?: number; obstacleDir?: number }[]>([]);
  const [score, setScore] = useState(0);
  
  // Refs for game logic (to avoid stale closures and re-renders restarting intervals)
  const birdPosRef = useRef(GAME_HEIGHT / 2);
  const birdVelocityRef = useRef(0);
  const pipesRef = useRef<{ x: number; topHeight: number; passed: boolean; hasMovingObstacle?: boolean; obstacleY?: number; obstacleDir?: number }[]>([]);
  const scoreRef = useRef(0);
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);
  const pipeSpawnRef = useRef<NodeJS.Timeout | null>(null);

  const startGame = () => {
    birdPosRef.current = GAME_HEIGHT / 2;
    birdVelocityRef.current = 0;
    pipesRef.current = [];
    scoreRef.current = 0;

    setBirdPos(GAME_HEIGHT / 2);
    setBirdVelocity(0);
    setPipes([]);
    setScore(0);
    setGameState("playing");
  };

  const jump = useCallback(() => {
    if (gameState === "playing") {
      birdVelocityRef.current = FLAP_STRENGTH;
      setBirdVelocity(FLAP_STRENGTH); // Sync for visual rotation
    }
  }, [gameState]);

  const endGame = useCallback(() => {
    setGameState("gameover");
    if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    if (pipeSpawnRef.current) clearInterval(pipeSpawnRef.current);
    onScoreSubmit(scoreRef.current);
  }, [onScoreSubmit]);

  useEffect(() => {
    if (gameState === "playing") {
      // Spawn Interval
      pipeSpawnRef.current = setInterval(() => {
        const topHeight = Math.random() * (GAME_HEIGHT - GAP_SIZE - 100) + 50;
        
        const newPipe = {
            x: GAME_WIDTH,
            topHeight,
            passed: false,
        };
        
        pipesRef.current = [...pipesRef.current, newPipe];
        setPipes([...pipesRef.current]);
      }, PIPE_SPAWN_RATE);

      // Game Loop
      gameLoopRef.current = setInterval(() => {
        // Update Physics
        birdVelocityRef.current += GRAVITY;
        birdPosRef.current += birdVelocityRef.current;

        // Update Pipes
        const currentPipes = pipesRef.current;
        const newPipes = currentPipes
            .map(pipe => ({
                ...pipe,
                x: pipe.x - PIPE_SPEED,
            }))
            .filter(pipe => pipe.x > -50);
        
        // Score update
        newPipes.forEach(pipe => {
            if (!pipe.passed && pipe.x < 50) {
                pipe.passed = true;
                scoreRef.current += 1;
                setScore(scoreRef.current);
            }
        });

        pipesRef.current = newPipes;

        // Collision Detection
        const birdY = birdPosRef.current;
        if (birdY < 0 || birdY > GAME_HEIGHT - 20) {
            endGame();
            return;
        }

        let collision = false;
        newPipes.forEach(pipe => {
            // Pipe collision
            if (
                pipe.x < 70 &&
                pipe.x > 30 &&
                (birdY < pipe.topHeight || birdY > pipe.topHeight + GAP_SIZE - 20)
            ) {
                collision = true;
            }
        });

        if (collision) {
            endGame();
            return;
        }

        // Sync state for render
        setBirdPos(birdPosRef.current);
        setBirdVelocity(birdVelocityRef.current);
        setPipes(newPipes);

      }, 20);
    }

    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
      if (pipeSpawnRef.current) clearInterval(pipeSpawnRef.current);
    };
  }, [gameState, endGame]); // Only depends on gameState (and stable endGame)

  // Keyboard control
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        jump();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [jump]);

  if (gameState === "idle") {
    return (
      <div className="grid place-items-center gap-6 py-10 text-center">
        <div className="space-y-2">
          <h3 className="text-2xl font-bold text-foreground">Flappy Bird</h3>
          <p className="text-muted-foreground">Terbang melewati pipa tanpa menabrak!</p>
        </div>
        <Button onClick={startGame} size="lg" className="rounded-2xl bg-yellow-500 text-yellow-950 hover:bg-yellow-400">
          <Play className="mr-2 h-5 w-5" /> Mulai Game
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="text-2xl font-bold">Skor: {score}</div>
      <div 
        className="relative bg-sky-300 overflow-hidden rounded-xl border-4 border-slate-700 shadow-xl cursor-pointer"
        style={{ width: GAME_WIDTH, height: GAME_HEIGHT }}
        onClick={jump}
      >
        {/* Bird */}
        <div
          className="absolute bg-yellow-400 w-8 h-8 rounded-full border-2 border-black z-20"
          style={{ top: birdPos, left: 50, transition: "transform 0.1s", transform: `rotate(${birdVelocity * 3}deg)` }}
        >
            <div className="absolute top-1 right-1 w-2 h-2 bg-white rounded-full border border-black" />
            <div className="absolute top-4 right-[-4px] w-4 h-2 bg-orange-500 rounded-full border border-black" />
        </div>

        {/* Pipes */}
        {pipes.map((pipe, i) => (
          <div key={i}>
            {/* Pipe Cap Top */}
            <div
              className="absolute bg-green-500 border-2 border-black w-14 z-10"
              style={{ top: pipe.topHeight - 20, height: 20, left: pipe.x - 4 }}
            />
            {/* Pipe Body Top */}
            <div
              className="absolute bg-green-500 border-x-2 border-black w-12 z-0"
              style={{ top: 0, height: pipe.topHeight - 20, left: pipe.x }}
            />
            
            {/* Pipe Cap Bottom */}
            <div
              className="absolute bg-green-500 border-2 border-black w-14 z-10"
              style={{ top: pipe.topHeight + GAP_SIZE, height: 20, left: pipe.x - 4 }}
            />
            {/* Pipe Body Bottom */}
            <div
              className="absolute bg-green-500 border-x-2 border-black w-12 z-0"
              style={{ top: pipe.topHeight + GAP_SIZE + 20, bottom: 0, left: pipe.x }}
            />
          </div>
        ))}

        {gameState === "gameover" && (
          <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white z-30">
            <h2 className="text-3xl font-bold mb-4">Game Over!</h2>
            <p className="text-xl mb-6">Skor Akhir: {score}</p>
            <Button onClick={startGame} className="bg-yellow-500 text-yellow-950 hover:bg-yellow-400">
              <RotateCcw className="mr-2 h-4 w-4" /> Main Lagi
            </Button>
          </div>
        )}
      </div>
      <p className="text-muted-foreground text-sm">Tekan Spasi atau Klik layar untuk melompat</p>
    </div>
  );
}
