import { motion } from "framer-motion";
import { Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ShareButtonProps {
  onClick: () => void;
  className?: string;
}

export function ShareButton({ onClick, className }: ShareButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group flex items-center gap-2 text-sm transition-colors focus:outline-none text-muted-foreground hover:text-blue-500",
        className
      )}
    >
      <div className="relative">
        <motion.div
          whileTap={{ scale: 0.8 }}
          transition={{ duration: 0.1 }}
        >
          <Share2 className="h-4 w-4 transition-all duration-300" />
        </motion.div>
      </div>
    </button>
  );
}
