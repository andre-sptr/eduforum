import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import { BookOpen, Gamepad2, Users, Trophy, Share2, ShieldCheck } from "lucide-react";

const features = [
  {
    icon: Users,
    title: "Komunitas Belajar",
    description: "Terhubung dengan teman sekelas dan diskusikan materi pelajaran dalam lingkungan yang suportif."
  },
  {
    icon: Gamepad2,
    title: "Game Edukasi",
    description: "Belajar jadi lebih menyenangkan dengan berbagai mini-games yang mengasah otak dan ketangkasan."
  },
  {
    icon: Trophy,
    title: "Leaderboard",
    description: "Bersaing secara sehat untuk mendapatkan peringkat tertinggi dan raih prestasi akademik."
  },
  {
    icon: Share2,
    title: "Berbagi Karya",
    description: "Pamerkan proyek dan karya kreatifmu kepada seluruh komunitas sekolah."
  },
  {
    icon: BookOpen,
    title: "Materi Terstruktur",
    description: "Akses rangkuman dan materi pelajaran yang disusun rapi untuk memudahkan pemahaman."
  },
  {
    icon: ShieldCheck,
    title: "Lingkungan Aman",
    description: "Platform yang dimoderasi untuk memastikan diskusi yang positif dan konstruktif."
  }
];

export const Features = () => {
  return (
    <section id="features" className="py-24 bg-muted/30 relative">
      <div className="container px-4 md:px-6">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Fitur Unggulan</h2>
          <p className="text-muted-foreground text-lg">
            Semua yang kamu butuhkan untuk pengalaman belajar yang lebih interaktif dan menyenangkan.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <Card className="h-full border-border/50 bg-card/50 backdrop-blur-sm hover:bg-card hover:shadow-xl transition-all duration-300 group">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
