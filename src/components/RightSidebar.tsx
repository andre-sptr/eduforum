import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { FileText } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const freeTools = [
  { 
    name: "PDF Tools", 
    websiteUrl: "https://pdf.flamyheart.site/" 
  },
  { 
    name: "AI Agent", 
    iconUrl: "/maskot.png",
    websiteUrl: "https://ai.flamyheart.site/" 
  },
  { 
    name: "ChatBot", 
    iconUrl: "/whatsapp.png",
    websiteUrl: "https://wa.me/6287790596246" 
  },
  { 
    name: "AetherNet", 
    iconUrl: "/logo.jpg",
    websiteUrl: "https://aethernet.flamyheart.site/" 
  },
];

export const RightSidebar = () => {
  return (
    <aside className="col-span-10 md:col-span-3 hidden md:block space-y-6">
      <Card className="shadow-sm overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg">Free Tools</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3.5">
          <TooltipProvider>
            <div className="grid grid-cols-4 gap-4">
              {freeTools.map((tool) => (
                <Tooltip key={tool.name} delayDuration={100}>
                  <TooltipTrigger asChild>
                    <a
                      href={tool.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block aspect-square"
                      aria-label={`Link ke ${tool.name}`}
                    >
                      <div className="flex h-full w-full items-center justify-center rounded-lg bg-muted/50 border border-border/50 group-hover:bg-muted group-hover:scale-105 group-hover:shadow-md transition-all duration-200">
                        {tool.iconUrl ? (
                          <img
                            src={tool.iconUrl}
                            alt={tool.name}
                            className="h-3/5 w-3/5 object-contain" 
                          />
                        ) : (
                          <FileText className="h-1/2 w-1/2 text-blue-500 group-hover:text-primary transition-colors duration-200" />
                        )}
                      </div>
                    </a>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{tool.name}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </TooltipProvider>
        </CardContent>
      </Card>
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Tentang EduForum</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-justify">
            <strong>EduForum</strong> adalah platform komunitas digital eksklusif yang dirancang khusus untuk siswa, guru, 
            dan alumni <strong>MAN Insan Cendekia Siak</strong>. Di sini, setiap anggota dapat terhubung, berbagi pengalaman, 
            serta berdiskusi seputar akademik, pengembangan diri, dan kehidupan sekolah dalam suasana yang positif dan inspiratif. 🎓
            <br /><br />
            EduForum hadir untuk menciptakan ekosistem pembelajaran yang kolaboratif, di mana ide dan pengetahuan dapat 
            tumbuh bersama. Melalui fitur diskusi, berbagi materi, dan publikasi kegiatan, platform ini mendorong setiap 
            individu untuk aktif berkontribusi dan memperluas jaringan dalam lingkungan yang aman, suportif, dan bernilai edukatif. 🌱
            <br /><br />
            Dengan semangat “Belajar, Berkarya, dan Terhubung”, EduForum menjadi wadah bagi komunitas MAN IC Siak untuk 
            terus berkembang, menginspirasi, dan memperkuat hubungan antargenerasi demi terciptanya budaya digital yang produktif dan bermakna.
          </p>
        </CardContent>
      </Card>
    </aside>
  );
};