import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Play, RotateCcw } from "lucide-react";

interface Card {
  id: number;
  emoji: string;
  isFlipped: boolean;
  isMatched: boolean;
}

const emojis = ["🎓", "📚", "✏️", "🎨", "🔬", "🌟", "🏆", "💡"];

interface MemoryGameProps {
  onScoreSubmit: (score: number) => void;
}

const MemoryGame = ({ onScoreSubmit }: MemoryGameProps) => {
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'finished'>('idle');
  const [cards, setCards] = useState<Card[]>([]);
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [matches, setMatches] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (gameState === 'playing' && timeLeft > 0) {
      timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    } else if (timeLeft === 0 && gameState === 'playing') {
      finishGame();
    }
    return () => clearTimeout(timer);
  }, [gameState, timeLeft]);

  useEffect(() => {
    if (flippedCards.length === 2) {
      const [first, second] = flippedCards;
      const firstCard = cards[first];
      const secondCard = cards[second];

      if (firstCard.emoji === secondCard.emoji) {
        setTimeout(() => {
          setCards(cards.map((card, index) => 
            index === first || index === second 
              ? { ...card, isMatched: true }
              : card
          ));
          setMatches(matches + 1);
          setFlippedCards([]);
          
          if (matches + 1 === emojis.length) {
            setTimeout(() => finishGame(), 500);
          }
        }, 500);
      } else {
        setTimeout(() => {
          setCards(cards.map((card, index) => 
            index === first || index === second 
              ? { ...card, isFlipped: false }
              : card
          ));
          setFlippedCards([]);
        }, 1000);
      }
      setMoves(moves + 1);
    }
  }, [flippedCards]);

  const initializeGame = () => {
    const shuffledEmojis = [...emojis, ...emojis]
      .sort(() => Math.random() - 0.5)
      .map((emoji, index) => ({
        id: index,
        emoji,
        isFlipped: false,
        isMatched: false,
      }));
    
    setCards(shuffledEmojis);
    setFlippedCards([]);
    setMoves(0);
    setMatches(0);
    setTimeLeft(60);
    setGameState('playing');
  };

  const handleCardClick = (index: number) => {
    if (
      flippedCards.length === 2 ||
      cards[index].isFlipped ||
      cards[index].isMatched ||
      gameState !== 'playing'
    ) {
      return;
    }

    setCards(cards.map((card, i) => 
      i === index ? { ...card, isFlipped: true } : card
    ));
    setFlippedCards([...flippedCards, index]);
  };

  const finishGame = () => {
    setGameState('finished');
    const score = Math.max(0, 100 - moves + (timeLeft * 2));
    onScoreSubmit(score);
  };

  if (gameState === 'idle') {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground mb-4">
          Temukan pasangan kartu yang sama!
        </p>
        <Button
          onClick={initializeGame}
          size="lg"
          className="bg-accent text-accent-foreground hover:bg-accent/90"
        >
          <Play className="mr-2 h-4 w-4" />
          Mulai Game
        </Button>
      </div>
    );
  }

  if (gameState === 'finished') {
    const finalScore = Math.max(0, 100 - moves + (timeLeft * 2));
    return (
      <div className="text-center py-8">
        <div className="mb-4">
          <div className="text-4xl font-bold text-accent mb-2">{finalScore}</div>
          <p className="text-muted-foreground">Skor Akhir</p>
        </div>
        <p className="mb-4 text-foreground">
          Langkah: {moves} | Pasangan: {matches}/{emojis.length}
        </p>
        <Button
          onClick={initializeGame}
          size="lg"
          className="bg-accent text-accent-foreground hover:bg-accent/90"
        >
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
        <span className="text-muted-foreground">Waktu: <span className="font-bold text-foreground">{timeLeft}s</span></span>
        <span className="text-muted-foreground">Pasangan: <span className="font-bold text-accent">{matches}/{emojis.length}</span></span>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {cards.map((card, index) => (
          <button
            key={card.id}
            onClick={() => handleCardClick(index)}
            className={`aspect-square rounded-lg text-2xl font-bold transition-all transform hover:scale-105 ${
              card.isFlipped || card.isMatched
                ? 'bg-accent text-accent-foreground'
                : 'bg-muted hover:bg-muted/80'
            } ${card.isMatched ? 'opacity-50' : ''}`}
            disabled={card.isFlipped || card.isMatched}
          >
            {card.isFlipped || card.isMatched ? card.emoji : '?'}
          </button>
        ))}
      </div>
    </div>
  );
};

export default MemoryGame;
