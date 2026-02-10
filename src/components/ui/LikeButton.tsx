import { motion, AnimatePresence } from "framer-motion";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

interface LikeButtonProps {
  isLiked: boolean;
  likeCount: number;
  onClick: () => void;
  className?: string;
}

export function LikeButton({ isLiked, likeCount, onClick, className }: LikeButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group flex items-center gap-2 text-sm transition-colors focus:outline-none",
        isLiked ? "text-red-500" : "text-muted-foreground hover:text-red-500",
        className
      )}
    >
      <div className="relative">
        <motion.div
          whileTap={{ scale: 0.8 }}
          transition={{ duration: 0.1 }}
        >
          <Heart
            className={cn(
              "h-5 w-5 transition-all duration-300",
              isLiked && "fill-current"
            )}
          />
        </motion.div>
        
        { }
        <AnimatePresence>
          {isLiked && (
            <>
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 1, scale: 0, x: 0, y: 0 }}
                  animate={{
                    opacity: 0,
                    scale: 1.5,
                    x: Math.cos((i * 60 * Math.PI) / 180) * 15,
                    y: Math.sin((i * 60 * Math.PI) / 180) * 15,
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="absolute left-1/2 top-1/2 h-1 w-1 rounded-full bg-red-500"
                  style={{ marginLeft: "-2px", marginTop: "-2px" }}
                />
              ))}
            </>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence mode="wait">
        <motion.span
          key={likeCount}
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 10, opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {likeCount > 0 ? likeCount : ""}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
