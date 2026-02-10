import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, Play } from "lucide-react";
import { Game } from "@/hooks/useGames";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";

interface GameCardProps {
  game: Game;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
}

export const GameCard = ({ game, isFavorite, onToggleFavorite }: GameCardProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card className={cn(
        "group relative overflow-hidden border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:shadow-xl",
        game.wrapColor ? "ring-1 ring-border" : ""
    )}>
      {game.wrapColor && (
        <div className={`pointer-events-none absolute inset-0 opacity-20 bg-gradient-to-br ${game.wrapColor} group-hover:opacity-30 transition-opacity`} />
      )}
      
      <CardHeader className="relative pb-2">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
             {game.badge ? (
                 <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${game.badge.cls} shadow-sm`}>
                    {game.badge.icon}
                 </span>
             ) : (
                 <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    {game.icon}
                 </div>
             )}
             <div>
                <CardTitle className="text-lg leading-tight group-hover:text-primary transition-colors">{game.title}</CardTitle>
                <CardDescription className="text-xs mt-1 line-clamp-1">{game.category === 'single' ? 'Single Player' : 'Multiplayer'}</CardDescription>
             </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 -mr-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(game.id);
            }}
          >
            <Heart className={cn("h-5 w-5 transition-all", isFavorite ? "fill-red-500 text-red-500 scale-110" : "")} />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="relative space-y-4">
        <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
          {game.description}
        </p>
        
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="w-full gap-2 rounded-xl group-hover:bg-primary group-hover:text-primary-foreground transition-all">
              <Play className="h-4 w-4 fill-current" />
              Mainkan Sekarang
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {game.icon || game.badge?.icon}
                {game.title}
              </DialogTitle>
              <DialogDescription>{game.description}</DialogDescription>
            </DialogHeader>
            <div className="mt-4">
              {game.component}
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
