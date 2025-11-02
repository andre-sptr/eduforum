import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Medal, Award } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface LeaderboardEntry {
  user_id: string;
  score: number;
  game_type: string;
  profiles: {
    full_name: string;
    avatar_url?: string;
    role: string;
  };
}

const GameLeaderboard = () => {
  const navigate = useNavigate();
  const [quizLeaderboard, setQuizLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [memoryLeaderboard, setMemoryLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [puzzleLeaderboard, setPuzzleLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [colorLeaderboard, setColorLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLeaderboards();
  }, []);

  const loadLeaderboards = async () => {
    try {
      // Load all game scores
      const { data: quizData } = await supabase
        .from('game_scores')
        .select('user_id, score, game_type')
        .eq('game_type', 'quiz')
        .order('score', { ascending: false })
        .limit(50);

      const { data: memoryData } = await supabase
        .from('game_scores')
        .select('user_id, score, game_type')
        .eq('game_type', 'memory')
        .order('score', { ascending: false })
        .limit(50);

      const { data: puzzleData } = await supabase
        .from('game_scores')
        .select('user_id, score, game_type')
        .eq('game_type', 'puzzle')
        .order('score', { ascending: false })
        .limit(50);

      const { data: colorData } = await supabase
        .from('game_scores')
        .select('user_id, score, game_type')
        .eq('game_type', 'color')
        .order('score', { ascending: false })
        .limit(50);

      // Get unique user IDs
      const allUserIds = new Set([
        ...(quizData?.map(s => s.user_id) || []),
        ...(memoryData?.map(s => s.user_id) || []),
        ...(puzzleData?.map(s => s.user_id) || []),
        ...(colorData?.map(s => s.user_id) || [])
      ]);

      // Fetch profiles for these users
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, role')
        .in('id', Array.from(allUserIds));

      // Create profiles map
      const profilesMap = new Map(
        (profilesData || []).map(p => [p.id, p])
      );

      // Merge scores with profiles
      const quizWithProfiles = (quizData || []).map(score => ({
        ...score,
        profiles: profilesMap.get(score.user_id) || {
          full_name: 'Unknown User',
          avatar_url: undefined,
          role: 'siswa'
        }
      }));

      const memoryWithProfiles = (memoryData || []).map(score => ({
        ...score,
        profiles: profilesMap.get(score.user_id) || {
          full_name: 'Unknown User',
          avatar_url: undefined,
          role: 'siswa'
        }
      }));

      const puzzleWithProfiles = (puzzleData || []).map(score => ({
        ...score,
        profiles: profilesMap.get(score.user_id) || {
          full_name: 'Unknown User',
          avatar_url: undefined,
          role: 'siswa'
        }
      }));

      const colorWithProfiles = (colorData || []).map(score => ({
        ...score,
        profiles: profilesMap.get(score.user_id) || {
          full_name: 'Unknown User',
          avatar_url: undefined,
          role: 'siswa'
        }
      }));

      // Group by user and get best score
      const groupedQuiz = groupByUser(quizWithProfiles);
      const groupedMemory = groupByUser(memoryWithProfiles);
      const groupedPuzzle = groupByUser(puzzleWithProfiles);
      const groupedColor = groupByUser(colorWithProfiles);

      setQuizLeaderboard(groupedQuiz);
      setMemoryLeaderboard(groupedMemory);
      setPuzzleLeaderboard(groupedPuzzle);
      setColorLeaderboard(groupedColor);
    } catch (error) {
      console.error('Error loading leaderboards:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupByUser = (data: LeaderboardEntry[]) => {
    const userMap = new Map<string, LeaderboardEntry>();
    
    data.forEach(entry => {
      const existing = userMap.get(entry.user_id);
      if (!existing || entry.score > existing.score) {
        userMap.set(entry.user_id, entry);
      }
    });

    return Array.from(userMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  };

  const getInitials = (name: string) => {
    const names = name.split(" ");
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Trophy className="h-5 w-5 text-accent" />;
      case 1:
        return <Medal className="h-5 w-5 text-gray-400" />;
      case 2:
        return <Award className="h-5 w-5 text-amber-600" />;
      default:
        return <span className="text-muted-foreground font-bold">#{index + 1}</span>;
    }
  };

  const renderLeaderboard = (entries: LeaderboardEntry[]) => {
    if (loading) {
      return (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Memuat...</p>
        </div>
      );
    }

    if (entries.length === 0) {
      return (
        <p className="text-muted-foreground text-sm text-center py-8">
          Belum ada data leaderboard
        </p>
      );
    }

    return (
      <div className="space-y-3">
        {entries.map((entry, index) => (
          <div
            key={`${entry.user_id}-${index}`}
            className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
            onClick={() => navigate(`/profile/${entry.user_id}`)}
          >
            <div className="flex-shrink-0 w-6">{getRankIcon(index)}</div>
            
            <Avatar className="h-10 w-10 border-2 border-accent/20">
              <AvatarImage src={entry.profiles.avatar_url} />
              <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                {getInitials(entry.profiles.full_name)}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground truncate">
                {entry.profiles.full_name}
              </p>
              <p className="text-xs text-muted-foreground">
                {entry.profiles.role}
              </p>
            </div>

            <div className="text-right">
              <p className="text-lg font-bold text-accent">{entry.score}</p>
              <p className="text-xs text-muted-foreground">poin</p>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          <Trophy className="h-5 w-5 text-accent" />
          Leaderboard Games
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="quiz" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="quiz">Quiz</TabsTrigger>
            <TabsTrigger value="memory">Memory</TabsTrigger>
            <TabsTrigger value="puzzle">Puzzle</TabsTrigger>
            <TabsTrigger value="color">Color</TabsTrigger>
          </TabsList>

          <TabsContent value="quiz">
            {renderLeaderboard(quizLeaderboard)}
          </TabsContent>

          <TabsContent value="memory">
            {renderLeaderboard(memoryLeaderboard)}
          </TabsContent>

          <TabsContent value="puzzle">
            {renderLeaderboard(puzzleLeaderboard)}
          </TabsContent>

          <TabsContent value="color">
            {renderLeaderboard(colorLeaderboard)}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default GameLeaderboard;
