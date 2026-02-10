import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { RightSidebar } from "./RightSidebar";
import { BottomNav } from "./BottomNav";
import Navbar from "@/components/Navbar"; 
import { cn } from "@/lib/utils";

export default function AppShell() {
  const location = useLocation();
  const isHomePage = location.pathname === "/home";

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      { }
      <div className={cn("flex max-w-[1920px] mx-auto", isHomePage && "justify-center")}>
        <Sidebar />
        
        <main className={cn(
          "flex-1 w-full min-h-screen border-x border-border/50 pb-16 lg:pb-0 transition-all duration-300",
          isHomePage ? "max-w-2xl" : "max-w-7xl"
        )}>
            { }
            <div className="lg:hidden sticky top-0 z-40">
                <Navbar /> 
            </div>
            <Outlet />
        </main>

        {isHomePage && <RightSidebar />}
      </div>

      { }
      <BottomNav />
    </div>
  );
}
