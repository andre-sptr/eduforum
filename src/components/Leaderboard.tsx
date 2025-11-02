import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TrendingUp, Trophy, Medal, Award, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@radix-ui/react-tooltip";

interface LeaderboardUser {
  id: string;
  full_name: string;
  avatar_url?: string;
  follower_count: number;
}

interface LeaderboardProps {
  users: LeaderboardUser[];
}

const freeTools = [
  { 
    name: "PDF Tools", 
    websiteUrl: "https://pdf.flamyheart.site/" 
  },
  { 
    name: "AI Agent", 
    iconUrl: "/maskot.png",
    websiteUrl: "https://ai.flamyheart.site/" 
  },
  { 
    name: "ChatBot", 
    iconUrl: "/whatsapp.png",
    websiteUrl: "https://wa.me/6287790596246" 
  },
  { 
    name: "AetherNet", 
    iconUrl: "/logo.jpg",
    websiteUrl: "https://aethernet.flamyheart.site/" 
  },
];

const Leaderboard = ({ users }: LeaderboardProps) => {
  const navigate = useNavigate();
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

  return (
    <div className="space-y-4">
      <Card className="shadow-sm overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg">Free Tools</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3.5">
          <TooltipProvider>
            <div className="grid grid-cols-4 gap-4">
              {freeTools.map((tool) => (
                <Tooltip key={tool.name} delayDuration={100}>
                  <TooltipTrigger asChild>
                    <a
                      href={tool.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block aspect-square"
                      aria-label={`Link ke ${tool.name}`}
                    >
                      <div className="flex h-full w-full items-center justify-center rounded-lg bg-muted/50 border border-border/50 group-hover:bg-muted group-hover:scale-105 group-hover:shadow-md transition-all duration-200">
                        {tool.iconUrl ? (
                          <img
                            src={tool.iconUrl}
                            alt={tool.name}
                            className="h-3/5 w-3/5 object-contain" 
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <FileText className="h-1/2 w-1/2 text-blue-500 group-hover:text-primary transition-colors duration-200" />
                        )}
                      </div>
                    </a>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{tool.name}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </TooltipProvider>
        </CardContent>
      </Card>
      
      <Card className="bg-card border-border">
        <CardHeader className="border-b border-border">
          <CardTitle className="text-xl flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-accent" />
            Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {users.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-4">
              Belum ada data
            </p>
          ) : (
            users.map((user, index) => (
              <div
                key={user.id}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-[var(--transition-smooth)] cursor-pointer"
                onClick={() => navigate(`/profile/${user.id}`)}
              >
                <div className="flex-shrink-0 w-6">{getRankIcon(index)}</div>
                
                <Avatar className="h-10 w-10 border-2 border-accent/20">
                  <AvatarImage src={user.avatar_url} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                    {getInitials(user.full_name)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate">{user.full_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {user.follower_count} followers
                  </p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
      
      <Card className="shadow-sm">
        <CardHeader className="border-b border-border">
          <CardTitle className="text-xl flex items-center gap-2">Tentang EduForum</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-justify mt-4">
            <strong>EduForum</strong> adalah platform komunitas digital eksklusif yang dirancang khusus untuk siswa, guru, 
            dan alumni <strong>MAN Insan Cendekia Siak</strong>. Di sini, setiap anggota dapat terhubung, berbagi pengalaman, 
            serta berdiskusi seputar akademik, pengembangan diri, dan kehidupan sekolah dalam suasana yang positif dan inspiratif. 🎓
            <br /><br />
            EduForum hadir untuk menciptakan ekosistem pembelajaran yang kolaboratif, di mana ide dan pengetahuan dapat 
            tumbuh bersama. Melalui fitur diskusi, berbagi materi, dan publikasi kegiatan, platform ini mendorong setiap 
            individu untuk aktif berkontribusi dan memperluas jaringan dalam lingkungan yang aman, suportif, dan bernilai edukatif. 🌱
            <br /><br />
            Dengan semangat "Belajar, Berkarya, dan Terhubung", EduForum menjadi wadah bagi komunitas MAN IC Siak untuk 
            terus berkembang, menginspirasi, dan memperkuat hubungan antargenerasi demi terciptanya budaya digital yang produktif dan bermakna.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Leaderboard;
