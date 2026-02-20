import { Hero } from "@/components/landing/Hero";
import { Features } from "@/components/landing/Features";
import { CTA } from "@/components/landing/CTA";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const LandingNavbar = () => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-background/80 backdrop-blur-md border-b border-border shadow-sm py-3" : "bg-transparent py-5"
      }`}
    >
      <div className="container px-4 md:px-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <img src="/favicon.ico" alt="Logo" className="h-8 w-8 rounded-md shadow-sm" />
          <span className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            EduForum
          </span>
        </Link>

        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Button 
            variant="ghost" 
            onClick={() => navigate("/auth")}
            className="hidden sm:inline-flex font-medium"
          >
            Masuk
          </Button>
          <Button 
            onClick={() => navigate("/auth")}
            className="rounded-full px-6 bg-primary hover:bg-primary/90"
          >
            Daftar
          </Button>
        </div>
      </div>
    </header>
  );
};

const Footer = () => (
  <footer className="bg-muted/50 border-t border-border py-12">
    <div className="container px-4 md:px-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
        <div className="col-span-1 md:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <img src="/favicon.ico" alt="Logo" className="h-6 w-6" />
            <span className="text-lg font-bold">EduForum</span>
          </div>
          <p className="text-muted-foreground max-w-sm">
            Platform edukasi yang menghubungkan siswa untuk belajar, berbagi, dan berkembang bersama.
          </p>
        </div>
        <div>
        </div>
        <div>
          <h3 className="font-semibold mb-4">Platform</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><a href="#features" className="hover:text-foreground" onClick={(e) => { e.preventDefault(); document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' }); }}>Fitur</a></li>
            <li><a href="#" className="hover:text-foreground" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Tentang Kami</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/50 pt-8 text-center text-sm text-muted-foreground">
        <a
          href="https://andresptr.site"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium underline-offset-4"
        >
          © {new Date().getFullYear()} Andre Saputra
        </a>
      </div>
    </div>
  </footer>
);

export default function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        navigate("/home");
      }
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20">
      <LandingNavbar />
      <main>
        <Hero />
        <Features />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
