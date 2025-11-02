import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, XCircle, Play, RotateCcw } from "lucide-react";

interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
}

const quizQuestions: QuizQuestion[] = [
  {
    question: "Apa ibu kota Indonesia?",
    options: ["Bandung", "Jakarta", "Surabaya", "Medan"],
    correctAnswer: 1,
  },
  {
    question: "Siapa proklamator kemerdekaan Indonesia?",
    options: ["Soekarno dan Hatta", "Sudirman", "Diponegoro", "Kartini"],
    correctAnswer: 0,
  },
  {
    question: "Berapa hasil dari 15 × 8?",
    options: ["100", "110", "120", "130"],
    correctAnswer: 2,
  },
  {
    question: "Planet terbesar di tata surya adalah?",
    options: ["Mars", "Venus", "Jupiter", "Saturnus"],
    correctAnswer: 2,
  },
  {
    question: "Apa warna yang dihasilkan dari campuran merah dan biru?",
    options: ["Ungu", "Hijau", "Orange", "Coklat"],
    correctAnswer: 0,
  },
];

interface QuizGameProps {
  onScoreSubmit: (score: number) => void;
}

const QuizGame = ({ onScoreSubmit }: QuizGameProps) => {
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'finished'>('idle');
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (gameState === 'playing' && timeLeft > 0 && !showResult) {
      timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    } else if (timeLeft === 0 && !showResult) {
      handleNextQuestion();
    }
    return () => clearTimeout(timer);
  }, [gameState, timeLeft, showResult]);

  const startGame = () => {
    setGameState('playing');
    setCurrentQuestion(0);
    setScore(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setTimeLeft(30);
  };

  const handleAnswerSelect = (answerIndex: number) => {
    if (showResult) return;
    
    setSelectedAnswer(answerIndex);
    setShowResult(true);
    
    if (answerIndex === quizQuestions[currentQuestion].correctAnswer) {
      setScore(score + 10);
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestion + 1 < quizQuestions.length) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(null);
      setShowResult(false);
      setTimeLeft(30);
    } else {
      setGameState('finished');
      const finalScore = selectedAnswer === quizQuestions[currentQuestion].correctAnswer ? score + 10 : score;
      onScoreSubmit(finalScore);
    }
  };

  if (gameState === 'idle') {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground mb-4">
          Jawab 5 pertanyaan dengan benar!
        </p>
        <Button
          onClick={startGame}
          size="lg"
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Play className="mr-2 h-4 w-4" />
          Mulai Quiz
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
        <p className="mb-4 text-foreground">
          Anda menjawab {score / 10} dari {quizQuestions.length} pertanyaan dengan benar!
        </p>
        <Button
          onClick={startGame}
          size="lg"
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Main Lagi
        </Button>
      </div>
    );
  }

  const question = quizQuestions[currentQuestion];
  const progress = ((currentQuestion + 1) / quizQuestions.length) * 100;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Pertanyaan {currentQuestion + 1}/{quizQuestions.length}</span>
        <span className="font-mono text-foreground">Waktu: {timeLeft}s</span>
      </div>

      <Progress value={progress} className="h-2" />

      <Card className="p-4 bg-muted border-border">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          {question.question}
        </h3>

        <div className="space-y-2">
          {question.options.map((option, index) => {
            const isSelected = selectedAnswer === index;
            const isCorrect = index === question.correctAnswer;
            const showCorrect = showResult && isCorrect;
            const showIncorrect = showResult && isSelected && !isCorrect;

            return (
              <Button
                key={index}
                onClick={() => handleAnswerSelect(index)}
                disabled={showResult}
                variant={showCorrect ? "default" : showIncorrect ? "destructive" : "outline"}
                className={`w-full justify-start text-left h-auto py-3 px-4 ${
                  showCorrect ? 'bg-primary text-primary-foreground' :
                  showIncorrect ? 'bg-destructive text-destructive-foreground' :
                  'bg-background text-foreground hover:bg-accent/10'
                }`}
              >
                <span className="flex items-center gap-2 w-full">
                  <span className="flex-1">{option}</span>
                  {showCorrect && <CheckCircle className="h-5 w-5" />}
                  {showIncorrect && <XCircle className="h-5 w-5" />}
                </span>
              </Button>
            );
          })}
        </div>
      </Card>

      {showResult && (
        <Button
          onClick={handleNextQuestion}
          size="lg"
          className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
        >
          {currentQuestion + 1 < quizQuestions.length ? 'Pertanyaan Berikutnya' : 'Lihat Hasil'}
        </Button>
      )}

      <div className="text-center">
        <p className="text-sm text-muted-foreground">Skor Saat Ini: <span className="font-bold text-accent">{score}</span></p>
      </div>
    </div>
  );
};

export default QuizGame;
