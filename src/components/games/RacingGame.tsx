import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Play, RotateCcw } from "lucide-react";

interface Props {
  onScoreSubmit: (score: number) => void;
}

const GAME_WIDTH = 400;
const GAME_HEIGHT = 600;
const CAR_WIDTH = 40;
const CAR_HEIGHT = 70;
const LANE_WIDTH = GAME_WIDTH / 3;

export default function RacingGame({ onScoreSubmit }: Props) {
  const [gameState, setGameState] = useState<"idle" | "playing" | "gameover">("idle");
  const [lane, setLane] = useState(1); // 0, 1, 2
  const [score, setScore] = useState(0);
  const [obstacles, setObstacles] = useState<{ x: number; y: number; type: "car" | "rock" }[]>([]);
  const [speed, setSpeed] = useState(5);
  
  // Refs for game loop stability
  const laneRef = useRef(1);
  const scoreRef = useRef(0);
  const speedRef = useRef(5);
  const obstaclesRef = useRef<{ x: number; y: number; type: "car" | "rock" }[]>([]);
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);

  const startGame = () => {
    laneRef.current = 1;
    scoreRef.current = 0;
    speedRef.current = 5;
    obstaclesRef.current = [];

    setLane(1);
    setScore(0);
    setObstacles([]);
    setSpeed(5);
    setGameState("playing");
  };

  const endGame = useCallback(() => {
    setGameState("gameover");
    if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    onScoreSubmit(scoreRef.current);
  }, [onScoreSubmit]);

  const moveLeft = () => {
    if (gameState !== "playing") return;
    setLane(l => {
        const newLane = Math.max(0, l - 1);
        laneRef.current = newLane;
        return newLane;
    });
  };
  
  const moveRight = () => {
    if (gameState !== "playing") return;
    setLane(l => {
        const newLane = Math.min(2, l + 1);
        laneRef.current = newLane;
        return newLane;
    });
  };

  useEffect(() => {
    if (gameState === "playing") {
      gameLoopRef.current = setInterval(() => {
        const currentSpeed = speedRef.current;
        const currentLane = laneRef.current;
        
        const difficultyMultiplier = Math.min(2.5, 1 + scoreRef.current / 1000);
        const spawnChance = 0.05 * difficultyMultiplier;

        const minDistance = Math.max(120, 150 - (currentSpeed - 5) * 2);

        const lastObstacle = obstaclesRef.current[obstaclesRef.current.length - 1];
        const canSpawn = !lastObstacle || lastObstacle.y > minDistance;

        if (canSpawn && Math.random() < spawnChance) {
            const laneOptions = [0, 1, 2];
            
            // Check recently spawned obstacles to prevent 3-lane blockage
            const recentObstacles = obstaclesRef.current.filter(o => o.y < 200); // Check larger area for safety
            const blockedLanes = new Set(recentObstacles.map(o => o.x));
            
            // If 2 lanes are already blocked within close proximity, FORCE the 3rd lane to be open
            let availableLanes = laneOptions;
            if (blockedLanes.size >= 2) {
                // Do not spawn anything to guarantee a gap
                availableLanes = []; 
            } else {
                 // Avoid spawning on top of another obstacle (same lane, very close)
                 availableLanes = laneOptions.filter(l => !blockedLanes.has(l));
            }

            if (availableLanes.length > 0) {
                 const randomLane = availableLanes[Math.floor(Math.random() * availableLanes.length)];
                 
                 obstaclesRef.current.push({ 
                    x: randomLane, 
                    y: -100, 
                    type: Math.random() > 0.5 ? "car" : "rock" 
                });
            }
        }

        // Update obstacles position
        const newObstacles = obstaclesRef.current
            .map(obs => ({ ...obs, y: obs.y + currentSpeed }))
            .filter(obs => obs.y < GAME_HEIGHT + 100);
        
        obstaclesRef.current = newObstacles;

        // Collision Check
        let collision = false;
        newObstacles.forEach(obs => {
            // Simple AABB Collision
            // Player car rect: x = currentLane * LANE_WIDTH + margin, y = GAME_HEIGHT - CAR_HEIGHT - 20, w = CAR_WIDTH, h = CAR_HEIGHT
            // Obs rect: x = obs.x * LANE_WIDTH + margin, y = obs.y, w = CAR_WIDTH, h = (car?70:40)
            
            const playerX = currentLane * LANE_WIDTH + (LANE_WIDTH - CAR_WIDTH) / 2;
            const playerY = GAME_HEIGHT - CAR_HEIGHT - 20;
            
            const obsX = obs.x * LANE_WIDTH + (LANE_WIDTH - CAR_WIDTH) / 2;
            const obsY = obs.y;
            const obsH = obs.type === "car" ? CAR_HEIGHT : CAR_WIDTH;

            if (
                playerX < obsX + CAR_WIDTH &&
                playerX + CAR_WIDTH > obsX &&
                playerY < obsY + obsH &&
                playerY + CAR_HEIGHT > obsY
            ) {
                collision = true;
            }
        });

        if (collision) {
            endGame();
            return;
        }

        // Increase score and speed
        scoreRef.current += 1;
        // Cap max speed
        speedRef.current = Math.min(20, 5 + Math.floor(scoreRef.current / 500));
        
        // Sync State for Render
        setScore(scoreRef.current);
        setSpeed(speedRef.current);
        setObstacles(newObstacles);

      }, 20); // 50 FPS
    }
    return () => {
        if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, [gameState, endGame]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "ArrowLeft") moveLeft();
        if (e.key === "ArrowRight") moveRight();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gameState]); // Re-bind when gameState changes to capture correct laneRef closure if needed, though we use refs now

  if (gameState === "idle") {
    return (
      <div className="grid place-items-center gap-6 py-10 text-center">
        <div className="space-y-2">
          <h3 className="text-2xl font-bold text-foreground">Speed Racer</h3>
          <p className="text-muted-foreground">Hindari rintangan dan capai skor tertinggi!</p>
        </div>
        <Button onClick={startGame} size="lg" className="rounded-2xl bg-red-600 text-white hover:bg-red-700">
          <Play className="mr-2 h-5 w-5" /> Mulai Balapan
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="text-2xl font-bold font-mono">Score: {score}</div>
      <div 
        className="relative bg-gray-800 overflow-hidden rounded-xl border-4 border-slate-600 shadow-xl"
        style={{ width: GAME_WIDTH, height: GAME_HEIGHT }}
      >
        {/* Moving Road Effect */}
        <div className="absolute inset-0 flex justify-between px-[33%] pointer-events-none">
            {/* Left Line */}
            <div className="w-2 h-full bg-dashed-line relative overflow-hidden">
                <div 
                    className="absolute inset-0 w-full h-[200%] border-l-2 border-dashed border-white opacity-30"
                    style={{ 
                        top: `-${(score % 20) * 10}%`, 
                        transition: 'none' // Disable transition for smooth loop
                    }} 
                />
            </div>
            {/* Right Line */}
            <div className="w-2 h-full bg-dashed-line relative overflow-hidden">
                 <div 
                    className="absolute inset-0 w-full h-[200%] border-l-2 border-dashed border-white opacity-30"
                    style={{ 
                        top: `-${(score % 20) * 10}%`,
                        transition: 'none'
                    }} 
                />
            </div>
        </div>

        {/* Player Car */}
        <div 
            className="absolute bg-red-500 rounded-lg shadow-lg transition-all duration-100 ease-out"
            style={{ 
                bottom: 20, 
                left: lane * LANE_WIDTH + (LANE_WIDTH - CAR_WIDTH) / 2, 
                width: CAR_WIDTH, 
                height: CAR_HEIGHT,
                transform: `translateX(${lane === 0 ? -5 : lane === 2 ? 5 : 0}px) rotate(${lane === 0 ? -5 : lane === 2 ? 5 : 0}deg)` // Tilt effect
            }}
        >
            <div className="absolute top-2 left-1 right-1 h-4 bg-red-900 rounded-sm" /> {/* Windshield */}
            <div className="absolute bottom-2 left-1 right-1 h-2 bg-yellow-400 rounded-sm" /> {/* Lights */}
            <div className="absolute top-0 left-0 bottom-0 w-1 bg-black/20 rounded-l-lg" /> {/* Side detail */}
            <div className="absolute top-0 right-0 bottom-0 w-1 bg-black/20 rounded-r-lg" /> {/* Side detail */}
        </div>

        {/* Obstacles */}
        {obstacles.map((obs, i) => (
            <div
                key={i}
                className={`absolute rounded-lg shadow-lg ${obs.type === "car" ? "bg-blue-500" : "bg-stone-600 rounded-full"}`}
                style={{
                    top: obs.y,
                    left: obs.x * LANE_WIDTH + (LANE_WIDTH - CAR_WIDTH) / 2,
                    width: CAR_WIDTH,
                    height: obs.type === "car" ? CAR_HEIGHT : CAR_WIDTH
                }}
            >
                {obs.type === "car" && (
                    <>
                        <div className="absolute bottom-2 left-1 right-1 h-4 bg-blue-900 rounded-sm" />
                        <div className="absolute top-2 left-1 right-1 h-2 bg-red-500 rounded-sm" />
                    </>
                )}
                {obs.type === "rock" && (
                    <div className="absolute inset-2 bg-stone-500 rounded-full" />
                )}
            </div>
        ))}

        {gameState === "gameover" && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white z-20">
            <h2 className="text-3xl font-bold mb-4 text-red-500">CRASHED!</h2>
            <p className="text-xl mb-6">Skor Akhir: {score}</p>
            <Button onClick={startGame} className="bg-red-600 text-white hover:bg-red-700">
              <RotateCcw className="mr-2 h-4 w-4" /> Balap Lagi
            </Button>
          </div>
        )}
      </div>
      <div className="flex gap-4">
          <Button variant="outline" size="lg" onClick={moveLeft} disabled={gameState !== "playing"}>&larr; Kiri</Button>
          <Button variant="outline" size="lg" onClick={moveRight} disabled={gameState !== "playing"}>Kanan &rarr;</Button>
      </div>
      <p className="text-muted-foreground text-sm">Gunakan Panah Kiri/Kanan atau Tombol di layar</p>
    </div>
  );
}
