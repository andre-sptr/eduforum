// src/components/RankBadge.tsx

import { Heart, Trophy, Medal, Award } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const rankConfig = {
  follower: [
    {},
    { icon: Trophy, style: "bg-accent text-accent-foreground ring-accent/50", text: "Top #1 Follower" },
    { icon: Medal, style: "bg-gray-400 text-gray-900 ring-gray-400/50", text: "Top #2 Follower" },
    { icon: Award, style: "bg-amber-600 text-white ring-amber-600/50", text: "Top #3 Follower" } 
  ],
  like: [
    {}, 
    { icon: Heart, style: "bg-red-500 text-white ring-red-500/50 fill-current", text: "Top #1 Likes" },
    { icon: Heart, style: "bg-gray-400 text-gray-900 ring-gray-400/50", text: "Top #2 Likes" }, 
    { icon: Heart, style: "bg-amber-600 text-white ring-amber-600/50", text: "Top #3 Likes" }   
  ]
};

export const RankBadge = ({ rank, type }: { rank: number | null, type: "follower" | "like" }) => {
  if (!rank || rank < 1 || rank > 3) return null;

  const { icon: Icon, style, text } = rankConfig[type][rank];

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger>
          <div
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold ring-2 ${style}`}
          >
            <Icon className="h-3 w-3" />
            <span>#{rank}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};