import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Play, RotateCcw } from "lucide-react";

interface Props {
  onScoreSubmit: (score: number) => void;
}

const BALL_SIZE = 15;
const PADDLE_HEIGHT = 100;
const PADDLE_WIDTH = 15;
const GAME_WIDTH = 600;
const GAME_HEIGHT = 400;

export default function PongGame({ onScoreSubmit }: Props) {
  const [gameState, setGameState] = useState<"idle" | "playing" | "gameover">("idle");
  const [ball, setBall] = useState({ x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2, dx: 4, dy: 4 });
  const [paddleLeft, setPaddleLeft] = useState(GAME_HEIGHT / 2 - PADDLE_HEIGHT / 2);
  const [paddleRight, setPaddleRight] = useState(GAME_HEIGHT / 2 - PADDLE_HEIGHT / 2);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  
  // Use refs for game logic to avoid closure staleness and strict mode double-invocation issues
  const ballRef = useRef({ x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2, dx: 4, dy: 4 });
  const livesRef = useRef(3);
  const scoreRef = useRef(0);
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);

  const startGame = () => {
    ballRef.current = { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2, dx: 4, dy: 4 };
    livesRef.current = 3;
    scoreRef.current = 0;
    
    setBall(ballRef.current);
    setScore(0);
    setLives(3);
    setGameState("playing");
  };

  const endGame = useCallback(() => {
    setGameState("gameover");
    if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    onScoreSubmit(scoreRef.current);
  }, [onScoreSubmit]);

  useEffect(() => {
    if (gameState === "playing") {
      gameLoopRef.current = setInterval(() => {
        const ball = ballRef.current;
        let newX = ball.x + ball.dx;
        let newY = ball.y + ball.dy;
        let newDx = ball.dx;
        let newDy = ball.dy;

        // Wall collision (top/bottom)
        if (newY <= 0 || newY >= GAME_HEIGHT - BALL_SIZE) {
          newDy = -newDy;
        }

        // Paddle Left Collision
        if (
          newX <= PADDLE_WIDTH + 10 &&
          newY + BALL_SIZE >= paddleLeft &&
          newY <= paddleLeft + PADDLE_HEIGHT
        ) {
          newDx = Math.abs(newDx) + 0.5; // Speed up
          scoreRef.current += 10;
          setScore(scoreRef.current);
        }

        // Paddle Right (AI) Collision
        if (
          newX >= GAME_WIDTH - PADDLE_WIDTH - 25 &&
          newY + BALL_SIZE >= paddleRight &&
          newY <= paddleRight + PADDLE_HEIGHT
        ) {
          newDx = -Math.abs(newDx) - 0.5;
        }

        // Out of bounds (Player loses life)
        if (newX < 0) {
           livesRef.current -= 1;
           setLives(livesRef.current);
           
           if (livesRef.current <= 0) {
               endGame();
               return; // Stop updating
           } else {
               // Reset ball
               newX = GAME_WIDTH / 2;
               newY = GAME_HEIGHT / 2;
               newDx = 4;
               newDy = 4;
           }
        }

        // Bounce from right wall (Single player mode)
        if (newX > GAME_WIDTH) {
           newDx = -newDx;
        }

        // Update refs
        ballRef.current = { x: newX, y: newY, dx: newDx, dy: newDy };
        
        // Update state for rendering
        setBall({ x: newX, y: newY, dx: newDx, dy: newDy });

      }, 16);
    }
    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, [gameState, paddleLeft, paddleRight, endGame]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (gameState !== "playing") return;
        
        if (e.key === "ArrowUp") {
            e.preventDefault();
            setPaddleLeft(prev => Math.max(0, prev - 20));
        } else if (e.key === "ArrowDown") {
            e.preventDefault();
            setPaddleLeft(prev => Math.min(GAME_HEIGHT - PADDLE_HEIGHT, prev + 20));
        }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gameState]);

  if (gameState === "idle") {
    return (
      <div className="grid place-items-center gap-6 py-10 text-center">
        <div className="space-y-2">
          <h3 className="text-2xl font-bold text-foreground">Pong Single Player</h3>
          <p className="text-muted-foreground">Pantulkan bola dan jangan biarkan jatuh!</p>
        </div>
        <Button onClick={startGame} size="lg" className="rounded-2xl bg-white text-black hover:bg-gray-200 border border-gray-300">
          <Play className="mr-2 h-5 w-5" /> Mulai Game
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="flex justify-between w-[600px] text-xl font-bold font-mono">
        <span>Score: {score}</span>
        <span>Lives: {lives}</span>
      </div>
      <div 
        className="relative bg-black rounded-xl border-4 border-slate-700 shadow-xl overflow-hidden"
        style={{ width: GAME_WIDTH, height: GAME_HEIGHT }}
      >
        {/* Center Line */}
        <div className="absolute top-0 bottom-0 left-1/2 w-1 border-l-2 border-dashed border-gray-600 opacity-50" />

        {/* Paddle Left */}
        <div 
            className="absolute bg-white rounded-sm shadow-[0_0_10px_white]"
            style={{ top: paddleLeft, left: 10, width: PADDLE_WIDTH, height: PADDLE_HEIGHT }}
        />

        {/* Ball */}
        <div 
            className="absolute bg-white rounded-full shadow-[0_0_10px_white]"
            style={{ top: ball.y, left: ball.x, width: BALL_SIZE, height: BALL_SIZE }}
        />

        {gameState === "gameover" && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white">
            <h2 className="text-3xl font-bold mb-4">Game Over!</h2>
            <p className="text-xl mb-6">Skor Akhir: {score}</p>
            <Button onClick={startGame} className="bg-white text-black hover:bg-gray-200">
              <RotateCcw className="mr-2 h-4 w-4" /> Main Lagi
            </Button>
          </div>
        )}
      </div>
      <p className="text-muted-foreground text-sm">Gunakan Panah Atas/Bawah untuk mengontrol paddle kiri</p>
    </div>
  );
}
