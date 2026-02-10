import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const Hero = () => {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden bg-background pt-20">
      { }
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-accent/20 rounded-full blur-[100px]" />
      </div>

      <div className="container px-4 md:px-6 relative z-10">
        <div className="flex flex-col items-center text-center space-y-8 max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent border border-accent/20 mb-6">
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-medium">Revolusi Belajar Digital</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
              Tingkatkan Potensi <br />
              <span className="bg-gradient-to-r from-primary via-blue-600 to-accent bg-clip-text text-transparent">
                Bersama EduForum
              </span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Platform kolaborasi siswa untuk berbagi pengetahuan, berdiskusi, dan bermain game edukatif.
              Jadilah bagian dari komunitas pembelajar masa depan.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-col sm:flex-row gap-4 w-full justify-center"
          >
            <Button 
              size="lg" 
              className="rounded-full text-lg px-8 h-12 bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90 shadow-lg shadow-primary/25 transition-all hover:scale-105"
              onClick={() => navigate("/auth")}
            >
              Mulai Sekarang
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="rounded-full text-lg px-8 h-12 border-primary/20 hover:bg-primary/5 transition-all hover:scale-105"
              onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Pelajari Fitur
            </Button>
          </motion.div>

          { }
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="w-full mt-16 relative"
          >
            <div className="relative rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm shadow-2xl overflow-hidden aspect-video max-w-5xl mx-auto">
               <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 to-accent/5" />
               <div className="grid grid-cols-3 gap-4 p-8 h-full items-center opacity-80">
                  { }
                  <div className="col-span-1 space-y-4">
                    <div className="h-32 rounded-lg bg-muted/50 animate-pulse" />
                    <div className="h-32 rounded-lg bg-muted/50 animate-pulse delay-75" />
                  </div>
                  <div className="col-span-2 space-y-4">
                    <div className="h-64 rounded-lg bg-muted/50 animate-pulse delay-150" />
                    <div className="flex gap-4">
                       <div className="h-20 w-1/3 rounded-lg bg-muted/50 animate-pulse delay-200" />
                       <div className="h-20 w-2/3 rounded-lg bg-muted/50 animate-pulse delay-300" />
                    </div>
                  </div>
               </div>
               
               { }
               <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-muted-foreground/30 font-bold text-4xl select-none">Preview Dashboard</span>
               </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
