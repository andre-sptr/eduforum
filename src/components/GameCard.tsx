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
        "group relative overflow-hidden border-white/10 bg-card/40 backdrop-blur-md transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:bg-card/60",
        game.wrapColor ? "ring-1 ring-white/20" : "hover:ring-1 hover:ring-primary/20"
    )}>
      {}
      <div className={cn(
          "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-gradient-to-br from-transparent via-primary/5 to-transparent pointer-events-none",
          game.wrapColor ? game.wrapColor.replace("from-", "from-").replace("to-", "to-") : ""
      )} />

      {game.wrapColor && (
        <div className={`pointer-events-none absolute inset-0 opacity-10 bg-gradient-to-br ${game.wrapColor} group-hover:opacity-20 transition-all duration-500`} />
      )}
      
      <CardHeader className="relative pb-2 z-10">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-4">
             {game.badge ? (
                 <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${game.badge.cls} shadow-inner ring-1 ring-inset ring-black/5`}>
                    {game.badge.icon}
                 </span>
             ) : (
                 <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary ring-1 ring-primary/20 shadow-sm group-hover:scale-110 transition-transform duration-500">
                    {game.icon}
                 </div>
             )}
             <div>
                <CardTitle className="text-lg font-bold leading-tight group-hover:text-primary transition-colors duration-300">{game.title}</CardTitle>
                <CardDescription className="text-xs mt-1.5 font-medium px-2 py-0.5 rounded-md bg-muted/50 inline-block">
                    {game.category === 'single' ? 'Single Player' : 'Multiplayer'}
                </CardDescription>
             </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 -mr-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-full transition-all duration-300"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(game.id);
            }}
          >
            <Heart className={cn("h-5 w-5 transition-all duration-300", isFavorite ? "fill-red-500 text-red-500 scale-110" : "scale-100")} />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="relative space-y-6 z-10 pt-2">
        <p className="text-sm text-muted-foreground/80 line-clamp-2 min-h-[2.5rem] leading-relaxed">
          {game.description}
        </p>
        
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="w-full h-11 gap-2 rounded-xl bg-primary/90 hover:bg-primary shadow-lg shadow-primary/20 hover:shadow-primary/40 text-primary-foreground font-semibold transition-all duration-300 transform group-hover:translate-y-0 translate-y-1 opacity-90 group-hover:opacity-100">
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
