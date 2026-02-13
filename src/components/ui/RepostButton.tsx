import { motion, AnimatePresence } from "framer-motion";
import { Repeat2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface RepostButtonProps {
  isReposted: boolean;
  repostCount: number;
  onRepost: () => void;
  onQuote: () => void;
  isOwnPost: boolean;
  className?: string;
}

export function RepostButton({
  isReposted,
  repostCount,
  onRepost,
  onQuote,
  isOwnPost,
  className,
}: RepostButtonProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          disabled={isOwnPost}
          className={cn(
            "group flex items-center gap-2 text-sm transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed",
            isReposted ? "text-green-500" : "text-muted-foreground hover:text-green-500",
            className
          )}
        >
          <div className="relative">
            <motion.div
              whileTap={{ scale: 0.8, rotate: 180 }}
              transition={{ duration: 0.3 }}
            >
              <Repeat2
                className={cn(
                  "h-5 w-5 transition-all duration-300",
                  isReposted && "stroke-[2.5px]"
                )}
              />
            </motion.div>
          </div>

          <AnimatePresence mode="wait">
            <motion.span
              key={repostCount}
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 10, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {repostCount > 0 ? repostCount : ""}
            </motion.span>
          </AnimatePresence>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={onRepost}>
          <Repeat2 className="mr-2 h-4 w-4" />
          {isReposted ? "Batal Repost" : "Repost"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onQuote}>
          <Pencil className="mr-2 h-4 w-4" />
          Quote Repost
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
