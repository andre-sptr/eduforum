// src/pages/WebsitePage.tsx
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search } from "lucide-react";

const studentWebsites = [
  { id: 1, name: "Game Skill Analyzer", author: "Andhika Syahputra, Aulia Hadziq Afif, Bintang Rahman, Fatimah Azmi Nadira, dan Hilal Nov Putra Tri Ratya", url: "https://lembu.icsiak.site/", description: "Temukan Potensi Belajarmu dari Game!" },
  { id: 2, name: "Islamic Future", author: "Firdan Habsi Wijayanto, Rafa Syarahil, Rakha Saputra, dan Taat Nugroho", url: "https://jannahin.icsiak.site/", description: "Menggabungkan Nilai-Nilai Islami dengan Teknologi Masa Depan." },
  { id: 3, name: "Seryn", author: "Azkia Calisa, Wardatul, Puan Faizah, Nailah Fauziah, dan Shafa Nabilah", url: "https://seryn.icsiak.site/", description: "Send Sweet Vibes to MAN IC Friends." },
  { id: 4, name: "Smart Vibes", author: "Fadila Safitri, Hilya Atira Salsabila, Neni Sahira, dan Tasya Nur Elisa", url: "https://smartvibes.icsiak.site/", description: "Aku SmartVibes — temen ngobrol dan bantu belajarmu. Mau bahas apa hari ini?" },
  { id: 5, name: "Study Share", author: "Oksya Donika Amalia, Azilla Lovenia Almisky, Alya Azizah Afdal, Aira Reyhana Sumardi, dan Nayla Azira", url: "https://studyshare.icsiak.site/", description: "Tempat anak Madrasah berbagi video belajar, berdiskusi, dan upload tugas bareng." },
];

export default function WebsitePage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredWebsites = useMemo(() => {
    const query = searchQuery.toLowerCase();
    if (!query) return studentWebsites;
    
    return studentWebsites.filter(site => 
      site.name.toLowerCase().includes(query) || 
      site.author.toLowerCase().includes(query) || 
      site.description.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/40">
      <header className="sticky top-0 z-50 border-b border-border bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container mx-auto flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="rounded-xl">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Website Siswa
          </h1>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl px-4 py-6">
        <div className="space-y-4">
          <p className="text-muted-foreground">
            Lihat proyek dan situs website karya siswa angkatan 10 MAN Insan Cendekia Siak.
          </p>

          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Cari karya berdasarkan nama, pembuat, atau deskripsi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 rounded-xl bg-input/60 border-border"
            />
          </div>

          {filteredWebsites.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredWebsites.map((site) => ( 
                <Card 
                  key={site.id} 
                  className="border-border bg-card/60 transition hover:shadow-md 
                             flex flex-col"
                >
                  <CardHeader>
                    <CardTitle className="text-lg">{site.name}</CardTitle>
                    <p className="mb-4 text-sm text-muted-foreground">{site.description}</p>
                    <div className="pt-2">
                      <h4 className="text-sm font-semibold text-primary">Karya:</h4>
                      <ul className="list-disc list-inside text-sm text-primary/90 pl-2 space-y-0.5 mt-1">
                        {site.author
                          .replace(/,?\s+dan\s+/g, ", ")
                          .split(',')
                          .map(name => name.trim())
                          .map((name, index) => (
                            <li key={index}>{name}</li>
                          ))
                        }
                      </ul>
                    </div>
                    
                  </CardHeader>
                  <CardContent 
                    className="flex-1 flex flex-col"
                  >
                    <Button
                      asChild
                      variant="outline"
                      className="rounded-xl border-accent text-accent hover:bg-accent hover:text-accent-foreground 
                                 mt-auto"
                    >
                      <a href={site.url} target="_blank" rel="noopener noreferrer">
                        Kunjungi
                      </a>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>Tidak ada karya yang ditemukan untuk "{searchQuery}".</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}