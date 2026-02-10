import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const CTA = () => {
  const navigate = useNavigate();
  
  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-primary/5" />
      <div className="container px-4 md:px-6 relative z-10">
        <div className="max-w-4xl mx-auto text-center space-y-8 bg-card border border-border/50 rounded-3xl p-8 md:p-16 shadow-2xl bg-gradient-to-b from-card to-muted/50">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
            Siap untuk Memulai?
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Bergabunglah dengan ratusan siswa lainnya dan rasakan pengalaman belajar yang baru.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button 
              size="lg" 
              className="rounded-full text-lg px-8 h-12 bg-primary hover:bg-primary/90 shadow-lg hover:shadow-primary/25 transition-all"
              onClick={() => navigate("/auth")}
            >
              Daftar Sekarang
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};
