export type WordItem = { word: string; hint: string };

const rumah = [
  "RUMAH","SEKOLAH","BUKU","PENA","PENSIL","KERTAS","MEJA","KURSI","JENDELA","PINTU",
  "LANTAI","ATAP","DINDING","LAMPU","KIPAS","KOMPUTER","LAPTOP","PONSEL","TELEVISI","RADIO",
  "KULKAS","KOMPOR","PIRING","GELAS","MANGKUK","SENDOK","GARPU","PISAU","WASTAFEL","KASUR",
  "BANTAL","SELIMUT","LEMARI","TIRAI","KUNCI","DOMPET","JAM","KALENDER","BUNGA","TANAMAN",
  "POT","EMBER","SAPU","PEL","SEPATU","SANDAL","JAKET","PAYUNG","HELM","SEPEDA",
  "MOTOR","MOBIL","OBENG","PALU","PAKU","GUNTING","CERMIN"
];

const makanan = [
  "NASI","SAYUR","SOP","GORENG","REBUS","BAKAR","IKAN","AYAM","DAGING","TELUR",
  "SUSU","KEJU","ROTI","MENTEGA","GULA","GARAM","TEH","KOPI","AIR","JUS",
  "BUBUR","MIE","SAMBAL","SAUS","KECAP","KUE","BISKUIT","COKELAT","PERMEN","PISANG",
  "APEL","JERUK","MANGGA","ANGGUR","STROBERI","PEPAYA","NANAS","KELAPA","SEMANGKA","MELON"
];

const hewan = [
  "KUCING","ANJING","BURUNG","SAPI","KAMBING","DOMBA","KUDA","GAJAH","HARIMAU","SINGA",
  "ZEBRA","JERAPAH","MONYET","KERBAU","BERUANG","SERIGALA","KELINCI","ULAR","BUAYA","BEBEK",
  "ANGSA","MERPATI","ELANG","HIU","PAUS","GURITA","UDANG","KEPITING","KERANG","TUPAI",
  "LANDAK","RUSA","BADAK","ORANGUTAN","KAKATUA","CENDERAWASIH","KALKUN","BANGAU","KUTILANG","GAGAK",
  "MERAK","BELUT","LELE","GURAME","NILA","NYAMUK","LEBAH","SEMUT","LALAT","BELALANG"
];

const tubuh = [
  "KEPALA","RAMBUT","WAJAH","MATA","TELINGA","HIDUNG","MULUT","GIGI","LIDAH","LEHER",
  "BAHU","TANGAN","SIKU","TELAPAK","JARI","KUKU","DADA","PUNGGUNG","PERUT","PINGGANG",
  "PINGGUL","KAKI","LUTUT","BETIS","TUMIT","TULANG","DARAH","JANTUNG","PARU","OTAK",
  "PIKIRAN","NAPAS","KERINGAT","DEMAM","BATUK","PILEK","LUKA","OBAT","VITAMIN","HANDUK"
];

const tempat = [
  "LANGIT","AWAN","HUJAN","PETIR","KEMARAU","BANJIR","ANGIN","MATAHARI","BULAN","BINTANG",
  "GUNUNG","BUKIT","LEMBAH","LAUT","PANTAI","SUNGAI","DANAU","HUTAN","PADANG","GURUN",
  "KOTA","DESA","PASAR","TOKO","KANTOR","MUSEUM","BANDARA","STASIUN","TERMINAL","PELABUHAN",
  "LAPANGAN","PERPUSTAKAAN","GEDUNG","KAMPUS","KLINIK","APOTEK","MASJID","GEREJA","VIHARA","TAMAN"
];

const peran = [
  "BAYI","ANAK","REMAJA","DEWASA","LANSIA","PRIA","WANITA","GURU","MURID","DOSEN",
  "MAHASISWA","DOKTER","PERAWAT","POLISI","TENTARA","PETANI","NELAYAN","PEDAGANG","SOPIR","MONTIR",
  "TUKANG","ARSITEK","INSINYUR","PROGRAMER","DESAINER","SENIMAN","PENYANYI","PENARI","PENULIS","WARTAWAN"
];

const kerja = [
  "BELAJAR","MENGAJAR","MEMBACA","MENULIS","MENGHITUNG","BERMAIN","BERLARI","BERJALAN","BERENANG","MENDENGAR",
  "MELIHAT","BERBICARA","TERTAWA","MENANGIS","TERSENYUM","MAKAN","MINUM","TIDUR","BANGUN","MANDI",
  "BERDOA","BEKERJA","BELANJA","MEMASAK","MEMBERSIHKAN","MENCUCI","MENYAPU","MENJAHIT","MENGGAMBAR","MENARI",
  "MENYANYI","BERKENDARA","BERSEPEDA","BERWISATA","MENDAKI","MENYELAM","BERLATIH","MENGAJUKAN","MENOLAK","MENERIMA"
];

const warna = ["MERAH","BIRU","KUNING"];

export const wordBank: WordItem[] = [
  ...rumah.map(word => ({ word, hint: "Benda di rumah" })),
  ...makanan.map(word => ({ word, hint: "Makanan atau minuman" })),
  ...hewan.map(word => ({ word, hint: "Hewan" })),
  ...tubuh.map(word => ({ word, hint: "Bagian tubuh" })),
  ...tempat.map(word => ({ word, hint: "Tempat atau alam" })),
  ...peran.map(word => ({ word, hint: "Pekerjaan atau peran" })),
  ...kerja.map(word => ({ word, hint: "Kata kerja" })),
  ...warna.map(word => ({ word, hint: "Warna" })),
];

export const pickRandomWord = (
  list: WordItem[] = wordBank,
  excludeWord?: string
): WordItem => {
  const pool = excludeWord ? list.filter(w => w.word !== excludeWord) : list;
  if (pool.length === 0) throw new Error("Daftar kata kosong.");
  return pool[Math.floor(Math.random() * pool.length)];
};