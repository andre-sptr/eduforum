export interface User {
  id: number;
  name: string;
  role: "Siswa" | "Guru" | "Alumni";
  avatar: string;
  bio?: string;
  totalPosts?: number;
  totalLikes?: number;
}

export interface Comment {
  id: number;
  userId: number;
  userName: string;
  userAvatar: string;
  text: string;
  time: string;
}

export interface Post {
  id: number;
  userId: number;
  userName: string;
  userRole: "Siswa" | "Guru" | "Alumni";
  userAvatar: string;
  content: string;
  image?: string;
  likes: number;
  comments: Comment[];
  time: string;
  isLiked?: boolean;
}

export const currentUser: User = {
  id: 1,
  name: "Ahmad Rizki",
  role: "Siswa",
  avatar: "AR",
  bio: "Siswa kelas XII - Passionate about technology and IoT",
  totalPosts: 12,
  totalLikes: 156,
};

export const mockPosts: Post[] = [
  {
    id: 1,
    userId: 2,
    userName: "Aisyah Putri",
    userRole: "Siswa",
    userAvatar: "AP",
    content: "Belajar ESP32 bareng teman-teman hari ini! Seru banget eksperimen dengan sensor-sensor IoT. Terima kasih Pak Andre yang sudah membimbing 🔥🚀",
    image: "post-tech",
    likes: 24,
    comments: [
      {
        id: 1,
        userId: 3,
        userName: "Rafi Muhammad",
        userAvatar: "RM",
        text: "Keren banget projektnya! 😍",
        time: "1 jam yang lalu",
      },
      {
        id: 2,
        userId: 4,
        userName: "Pak Andre",
        userAvatar: "PA",
        text: "Mantap! Terus eksplor dan jangan takut mencoba hal baru ya.",
        time: "30 menit yang lalu",
      },
    ],
    time: "2 jam yang lalu",
    isLiked: false,
  },
  {
    id: 2,
    userId: 4,
    userName: "Pak Andre",
    userRole: "Guru",
    userAvatar: "PA",
    content: "Selamat kepada tim robotika MAN IC Siak yang berhasil meraih juara 2 di kompetisi regional! Kalian luar biasa 🏆✨",
    image: "post-campus",
    likes: 89,
    comments: [
      {
        id: 3,
        userId: 5,
        userName: "Siti Nurhaliza",
        userAvatar: "SN",
        text: "Alhamdulillah, terima kasih atas dukungannya Pak!",
        time: "45 menit yang lalu",
      },
      {
        id: 4,
        userId: 6,
        userName: "Budi Santoso",
        userAvatar: "BS",
        text: "Congrats guys! 🎉",
        time: "20 menit yang lalu",
      },
    ],
    time: "4 jam yang lalu",
    isLiked: true,
  },
  {
    id: 3,
    userId: 7,
    userName: "Fatimah Zahra",
    userRole: "Siswa",
    userAvatar: "FZ",
    content: "Study group session hari ini produktif banget! Alhamdulillah materi Matematika jadi lebih mudah dipahami kalau belajar bareng 📚💡",
    image: "post-study",
    likes: 45,
    comments: [
      {
        id: 5,
        userId: 8,
        userName: "Ibu Siti",
        userAvatar: "IS",
        text: "Bagus sekali! Belajar kelompok memang efektif 👍",
        time: "2 jam yang lalu",
      },
    ],
    time: "5 jam yang lalu",
    isLiked: false,
  },
  {
    id: 4,
    userId: 9,
    userName: "Muhammad Farhan",
    userRole: "Alumni",
    userAvatar: "MF",
    content: "Kangen banget sama MAN IC! Dulu di sini belajar banyak hal yang sekarang berguna di kampus. Semangat untuk adik-adik yang masih berjuang! 💪🎓",
    likes: 67,
    comments: [],
    time: "1 hari yang lalu",
    isLiked: false,
  },
];
