
export default function Footer() {
  return (
    <footer className="border-t border-white/10 py-6 bg-card/30 backdrop-blur-sm mt-auto">
      <div className="container mx-auto px-4 text-center">
        <div className="flex flex-col items-center justify-center gap-2">
           <div className="flex items-center gap-2 text-muted-foreground/50 text-xs uppercase tracking-widest font-medium">
              <span>Community</span>
              <span className="w-1 h-1 rounded-full bg-primary/40" />
              <span>Learning</span>
              <span className="w-1 h-1 rounded-full bg-primary/40" />
              <span>Growth</span>
           </div>
           <p className="text-sm text-muted-foreground mt-2">
            Built with <span className="text-red-500 animate-pulse">❤</span> by{" "}
            <a
              href="https://andresptr.site"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-foreground hover:text-primary transition-colors relative inline-block group"
            >
              Andre Saputra
              <span className="absolute -bottom-0.5 left-0 w-0 h-0.5 bg-primary transition-all group-hover:w-full" />
            </a>
            {" "}© {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </footer>
  );
}