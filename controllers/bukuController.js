const prisma = require("../config/prisma");
const fs = require("fs");
const path = require("path");
const natural = require("natural");
const { Stemmer } = require("sastrawijs");

// ======================================================
// HELPER: TEXT PREPROCESSING (Stopword & Stemming)
// ======================================================
const processText = (text) => {
  if (!text) return "";
  let clean = text.toLowerCase().replace(/[^a-z\s]/g, " ");
  let words = clean.split(/\s+/).filter((w) => w.length > 2);

  const stopWords = new Set([
    "dan",
    "atau",
    "yang",
    "di",
    "ke",
    "dari",
    "ini",
    "itu",
    "untuk",
    "pada",
    "adalah",
    "sebagai",
    "dengan",
    "juga",
    "oleh",
    "karena",
    "dalam",
    "akan",
    "secara",
    "jika",
    "maka",
    "lain",
    "seperti",
    "namun",
    "buku",
    "tentang",
    "penerbit",
    "penulis",
    "tahun",
    "terbit",
    "edisi",
    "cetakan",
    "paket",
    "teks",
    "pendidikan",
    "seri",
    "jilid",
    "halaman",
    "isbn",
    "modul",
    "yaitu",
    "merupakan",
    "antara",
    "serta",
    "bagi",
    "bisa",
    "dapat",
    "memiliki",
    "mempunyai",
    "ada",
    "tiap",
    "setiap",
    "sebuah",
    "kami",
    "kita",
    "saya",
    "anda",
    "dia",
    "mereka",
    "kalian",
    "apa",
    "bagaimana",
    "kenapa",
    "kapan",
    "dimana",
    "siapa",
    "mengapa",
    "hal",
    "saat",
    "lalu",
    "kemudian",
    "sedangkan",
    "sehingga",
    "meskipun",
    "walaupun",
    "bahkan",
    "tetapi",
    "melalui",
    "terhadap",
    "selama",
    "tanpa",
    "tersebut",
    "terdiri",
    "atas",
    "seluruh",
    "semua",
    "banyak",
    "sedikit",
    "kurang",
    "lebih",
    "paling",
    "sangat",
    "cukup",
    "perlu",
    "harus",
    "wajib",
    "ingin",
    "mau",
    "akan",
    "hendak",
    "sudah",
    "telah",
    "sedang",
    "masih",
    "belum",
    "bukan",
    "tidak",
    "jangan",
    "hanya",
    "cuma",
    "saja",
    "lagi",
    "pun",
    "kah",
    "lah",
    "tah",
    "membahas",
    "berisi",
    "materi",
    "meliputi",
    "untuk",
    "siswa",
    "kelas",
    "sma",
    "smk",
    "ma",
    "sd",
    "smp",
    "kuliah",
    "mahasiswa",
    "sejarah",
    "kurikulum",
    "praktikum",
    "tingkat",
    "lanjut",
    "bahasa",
    "teknologi",
    "informasi",
    "x",
    "xi",
    "xii",
    "merdeka",
  ]);

  words = words.filter((w) => !stopWords.has(w));
  const stemmer = new Stemmer();
  const stemmedWords = words.map((w) => stemmer.stem(w));
  return stemmedWords.join(" ");
};

// ======================================================
// GET ALL BUKU
// ======================================================
exports.getAll = async (req, res) => {
  try {
    const books = await prisma.buku.findMany({
      include: { kategori: true, eksemplar: true },
      orderBy: { id: "desc" },
    });

    const formattedData = books.map((book) => {
      const totalStok = book.total_eksemplar || 0;
      const rusakHilang = book.non_tersedia_inventory || 0;
      const sedangDipinjam = book.eksemplar.filter(
        (e) => e.status === "dipinjam" || e.status === "booking",
      ).length;
      const stokTersedia = totalStok - rusakHilang - sedangDipinjam;

      return {
        id: book.id,
        judul: book.judul,
        isbn: book.isbn,
        penulis: book.penulis,
        penerbit: book.penerbit,
        tahun_terbit: book.tahun_terbit,
        harga: book.harga,
        cover: book.cover || "default.png",
        deskripsi: book.deskripsi,
        kategori_id: book.kategori_id,
        kategori_nama: book.kategori?.nama_kategori || "Tanpa Kategori",
        stok: stokTersedia < 0 ? 0 : stokTersedia,
        total_eksemplar: totalStok,
        non_tersedia_inventory: rusakHilang,
        dipinjam: sedangDipinjam,
        status: stokTersedia > 0 ? "tersedia" : "kosong",
      };
    });
    res.status(200).json(formattedData);
  } catch (err) {
    console.error("Error getAll:", err);
    res.status(500).json({ message: "Gagal mengambil data buku." });
  }
};

// ======================================================
// GET BY ID
// ======================================================
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    const book = await prisma.buku.findUnique({
      where: { id: parseInt(id) },
      include: { kategori: true, eksemplar: true },
    });

    if (!book)
      return res.status(404).json({ message: "Buku tidak ditemukan." });

    const totalStok = book.total_eksemplar || 0;
    const rusakHilang = book.non_tersedia_inventory || 0;
    const sedangDipinjam = book.eksemplar.filter(
      (e) => e.status === "dipinjam" || e.status === "booking",
    ).length;
    const stokTersedia = totalStok - rusakHilang - sedangDipinjam;

    const finalBuku = {
      ...book,
      kategori_nama: book.kategori?.nama_kategori,
      stok: stokTersedia < 0 ? 0 : stokTersedia,
      total_eksemplar: totalStok,
      non_tersedia_inventory: rusakHilang,
      dipinjam: sedangDipinjam,
      status: stokTersedia > 0 ? "tersedia" : "tidak tersedia",
    };
    res.status(200).json(finalBuku);
  } catch (err) {
    console.error("Error getById:", err);
    res.status(500).json({ message: err.message });
  }
};

// ======================================================
// CREATE BUKU
// ======================================================
exports.create = async (req, res) => {
  const {
    judul,
    penulis,
    penerbit,
    tahun_terbit,
    kategori_id,
    isbn,
    stok_awal,
    deskripsi,
    harga,
  } = req.body;

  const jumlahStok = parseInt(stok_awal);
  const tahun = parseInt(tahun_terbit);
  const hargaFix = harga && harga !== "" ? parseInt(harga) : null;

  const deleteUploadedFile = () => {
    if (req.file) {
      const filePath = path.join(
        __dirname,
        `../public/uploads/${req.file.filename}`,
      );
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  };

  if (
    !judul ||
    !penulis ||
    !penerbit ||
    !isbn ||
    !kategori_id ||
    !deskripsi ||
    !stok_awal ||
    !tahun_terbit
  ) {
    deleteUploadedFile();
    return res.status(400).json({
      status: "error",
      message: "Gagal Simpan: Kolom wajib belum diisi.",
    });
  }

  if (isNaN(jumlahStok) || jumlahStok < 1) {
    deleteUploadedFile();
    return res
      .status(400)
      .json({ status: "error", message: "Format Stok Salah." });
  }

  if (deskripsi && deskripsi.trim().split(/\s+/).filter(Boolean).length > 300) {
    deleteUploadedFile();
    return res
      .status(400)
      .json({ status: "error", message: "Deskripsi Terlalu Panjang." });
  }

  let coverPath = null;
  if (req.file) coverPath = `uploads/${req.file.filename}`;

  try {
    const existingIsbn = await prisma.buku.findUnique({
      where: { isbn: isbn },
    });
    if (existingIsbn) {
      deleteUploadedFile();
      return res
        .status(409)
        .json({ status: "error", message: "ISBN Sudah Terdaftar." });
    }

    const result = await prisma.$transaction(async (tx) => {
      const newBuku = await tx.buku.create({
        data: {
          judul,
          penulis,
          penerbit,
          tahun_terbit: tahun,
          isbn,
          cover: coverPath,
          kategori_id: parseInt(kategori_id),
          total_eksemplar: jumlahStok,
          non_tersedia_inventory: 0,
          deskripsi: deskripsi,
          harga: hargaFix,
        },
      });

      const prefix = (judul || "BKU")
        .substring(0, 3)
        .toUpperCase()
        .replace(/\s/g, "");
      const eksemplarData = [];
      for (let i = 1; i <= jumlahStok; i++) {
        const nomorUrut = String(i).padStart(3, "0");
        const kodeEksemplar = `${prefix}-${newBuku.id}-${nomorUrut}`;
        eksemplarData.push({
          buku_id: newBuku.id,
          kode_eksemplar: kodeEksemplar,
          status: "tersedia",
        });
      }
      await tx.eksemplar.createMany({ data: eksemplarData });
      return newBuku;
    });

    if (global.io)
      global.io.emit("change_data", { message: "Buku baru ditambahkan" });
    res.status(201).json({
      success: true,
      message: "Buku berhasil ditambahkan!",
      data: result,
    });
  } catch (err) {
    console.error("Error create:", err);
    deleteUploadedFile();
    res.status(500).json({
      status: "error",
      message: "Terjadi Kesalahan Server.",
      detail: err.message,
    });
  }
};

// ======================================================
// UPDATE BUKU
// ======================================================
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      judul,
      penulis,
      penerbit,
      tahun_terbit,
      kategori_id,
      isbn,
      total_eksemplar,
      non_tersedia_inventory,
      deskripsi,
      harga,
    } = req.body;

    const oldBuku = await prisma.buku.findUnique({
      where: { id: parseInt(id) },
      include: { eksemplar: true },
    });

    if (!oldBuku)
      return res.status(404).json({ message: "Buku tidak ditemukan." });

    if (deskripsi && deskripsi.trim().length > 0) {
      if (deskripsi.trim().split(/\s+/).filter(Boolean).length > 300) {
        if (req.file) {
          const filePath = path.join(
            __dirname,
            `../public/uploads/${req.file.filename}`,
          );
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
        return res.status(400).json({ message: `Deskripsi terlalu panjang!` });
      }
    }

    let hargaFix = oldBuku.harga;
    if (harga !== undefined) {
      hargaFix = harga && harga !== "" ? parseInt(harga) : null;
    }

    let updateData = {
      judul,
      penulis,
      penerbit,
      isbn,
      tahun_terbit: tahun_terbit ? parseInt(tahun_terbit) : null,
      kategori_id: parseInt(kategori_id),
      deskripsi:
        deskripsi && deskripsi.trim() !== "" ? deskripsi : oldBuku.deskripsi,
      harga: hargaFix,
      total_eksemplar: total_eksemplar
        ? parseInt(total_eksemplar)
        : oldBuku.total_eksemplar,
      non_tersedia_inventory: non_tersedia_inventory
        ? parseInt(non_tersedia_inventory)
        : 0,
    };

    if (req.file) {
      updateData.cover = `uploads/${req.file.filename}`;
      if (oldBuku.cover) {
        const oldPath = path.join(__dirname, `../public/${oldBuku.cover}`);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.buku.update({ where: { id: parseInt(id) }, data: updateData });

      if (total_eksemplar) {
        const newTotalStok = parseInt(total_eksemplar);
        const currentFisik = oldBuku.eksemplar.length;
        if (newTotalStok > currentFisik) {
          const selisih = newTotalStok - currentFisik;
          const prefix = (judul || oldBuku.judul)
            .substring(0, 3)
            .toUpperCase()
            .replace(/\s/g, "");
          const newEksemplars = [];
          for (let i = 1; i <= selisih; i++) {
            const nextNumber = currentFisik + i;
            const nomorUrut = String(nextNumber).padStart(3, "0");
            const kodeEksemplar = `${prefix}-${id}-${nomorUrut}`;
            newEksemplars.push({
              buku_id: parseInt(id),
              kode_eksemplar: kodeEksemplar,
              status: "tersedia",
            });
          }
          await tx.eksemplar.createMany({ data: newEksemplars });
        }
      }
    });

    if (global.io)
      global.io.emit("change_data", { message: "Buku berhasil diupdate" });
    res
      .status(200)
      .json({ success: true, message: "Data buku berhasil diperbarui!" });
  } catch (err) {
    console.error("Error update:", err);
    res.status(500).json({ message: err.message });
  }
};

// ======================================================
// DELETE BUKU
// ======================================================
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    const buku = await prisma.buku.findUnique({ where: { id: parseInt(id) } });
    if (!buku)
      return res.status(404).json({ message: "Buku tidak ditemukan." });

    const peminjamanAktif = await prisma.peminjaman.findFirst({
      where: {
        eksemplar: { buku_id: parseInt(id) },
        status_pinjam: { in: ["booking", "dipinjam"] },
      },
    });

    if (peminjamanAktif)
      return res
        .status(400)
        .json({ message: "Gagal hapus: Masih ada peminjaman aktif." });

    await prisma.$transaction([
      prisma.eksemplar.deleteMany({ where: { buku_id: parseInt(id) } }),
      prisma.buku.delete({ where: { id: parseInt(id) } }),
    ]);

    if (buku.cover) {
      const filePath = path.join(__dirname, `../public/${buku.cover}`);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    if (global.io)
      global.io.emit("change_data", { message: "Buku berhasil dihapus" });
    res.status(200).json({ success: true, message: "Buku berhasil dihapus!" });
  } catch (err) {
    console.error("Error delete:", err);
    res.status(500).json({ message: "Gagal menghapus buku." });
  }
};

// ======================================================
// GET EKSEMPLAR DETAIL
// ======================================================
exports.getEksemplarDetail = async (req, res) => {
  try {
    const { bukuId } = req.params;
    const eksemplarList = await prisma.eksemplar.findMany({
      where: { buku_id: parseInt(bukuId) },
      orderBy: { kode_eksemplar: "asc" },
    });
    if (!eksemplarList.length)
      return res.status(404).json({ message: "Eksemplar tidak ditemukan." });
    res.status(200).json({
      success: true,
      message: "Detail eksemplar diambil.",
      data: eksemplarList,
    });
  } catch (err) {
    console.error("ERROR getEksemplarDetail:", err);
    res.status(500).json({ message: "Gagal mengambil detail eksemplar." });
  }
};

// ======================================================
// GET RECOMMENDATION
// ======================================================
exports.getRecommendation = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Ambil data buku target
    const target = await prisma.buku.findUnique({
      where: { id: parseInt(id) },
      include: { kategori: true },
    });

    if (!target)
      return res.status(404).json({ message: "Buku tidak ditemukan" });

    // 2. Ambil kandidat
    const candidates = await prisma.buku.findMany({
      where: { NOT: { id: target.id } },
      include: { kategori: true },
    });

    if (!candidates.length) return res.status(200).json([]);

    // 3. Inisialisasi TF-IDF
    const tfidf = new natural.TfIdf();

    // Dokumen 0: Target
    const targetContent = `${target.judul} ${target.kategori?.nama_kategori || ""} ${target.penulis || ""} ${target.deskripsi || ""}`;
    const processedTarget = processText(targetContent);

    // [DEBUG] Log Text Processing Target
    console.log("\n=============================================");
    console.log("🔍 INSPEKSI TEXT PROCESSING (STANDARD)");
    console.log("=============================================");
    console.log("JUDUL     :", target.judul);
    console.log("BERSIH    :", processedTarget.substring(0, 100) + "...");
    console.log("=============================================\n");

    tfidf.addDocument(processedTarget);

    // Dokumen 1 s/d N: Kandidat
    candidates.forEach((book) => {
      // Standard: Judul cuma sekali
      const content = `${book.judul} ${book.kategori?.nama_kategori || ""} ${book.penulis || ""} ${book.deskripsi || ""}`;
      tfidf.addDocument(processText(content));
    });

    const recommendations = [];
    let debugCount = 0;

    // --- MULAI PERHITUNGAN COSINE SIMILARITY STANDARD ---

    // A. Hitung Magnitude Target
    let magA = 0;
    const termsTarget = tfidf.listTerms(0);
    termsTarget.forEach((item) => {
      magA += item.tfidf * item.tfidf;
    });
    magA = Math.sqrt(magA);

    // B. Loop Kandidat
    for (let i = 1; i < tfidf.documents.length; i++) {
      let dot = 0;
      let magB = 0;

      const candidateTerms = tfidf.listTerms(i);

      candidateTerms.forEach((item) => {
        const term = item.term;
        const b = item.tfidf;
        const a = tfidf.tfidf(term, 0);

        if (a > 0) dot += a * b;
        magB += b * b;
      });

      magB = Math.sqrt(magB);

      let similarity = 0;
      if (magA > 0 && magB > 0) {
        similarity = dot / (magA * magB);
      }

      // Filter Threshold
      if (similarity > 0.3) {
        const book = candidates[i - 1];
        recommendations.push({
          id: book.id,
          judul: book.judul,
          penulis: book.penulis,
          cover: book.cover || "default.png",
          kategori: book.kategori?.nama_kategori || "Tanpa Kategori",
          harga: book.harga,
          deskripsi: book.deskripsi,
          similarity_score: Number(similarity.toFixed(3)),
        });

        // LOGIC CETAK TABEL & BUKTI VALIDASI (Hanya Jika Match)
        if (debugCount < 3) {
          console.log(
            "\n==============================================================",
          );
          console.log(
            `✅ MATCH DITEMUKAN! (SIMILARITY: ${similarity.toFixed(3)})`,
          );
          console.log(
            "==============================================================",
          );
          console.log(`TARGET      : ${target.judul}`);
          console.log(`REKOMENDASI : ${book.judul}`);
          console.log(
            "--------------------------------------------------------------",
          );
          console.log(
            "| No | Kata (Term)    | Bobot Target (A) | Bobot Rekomendasi (B)|",
          );
          console.log(
            "--------------------------------------------------------------",
          );

          // 1. Ambil Semua Terms & Sortir
          const sortedTerms = termsTarget.sort((a, b) => b.tfidf - a.tfidf);

          // 2. Hitung Manual Magnitude Cuma dari Top 8 (Buat Pembuktian)
          let magnitudeTop8_Sq = 0;

          // 3. Cetak Tabel Top 15
          sortedTerms.slice(0, 15).forEach((item, idx) => {
            const match = candidateTerms.find((t) => t.term === item.term);
            const bobotB = match ? match.tfidf.toFixed(4) : "0.0000";

            // Kumpulin kuadrat khusus Top 8 buat bukti
            if (idx < 8) {
              magnitudeTop8_Sq += item.tfidf * item.tfidf;
            }

            if (item.tfidf > 0.1 || match) {
              console.log(
                `| ${String(idx + 1).padEnd(2)} | ${item.term.padEnd(14)} | ${item.tfidf.toFixed(4).padEnd(16)} | ${bobotB.padEnd(20)} |`,
              );
            }
          });
          console.log(
            "--------------------------------------------------------------",
          );

          // ==========================================================
          // 👇 INI BAGIAN PENTING BUAT BUKTI SKRIPSI / SIDANG 👇
          // ==========================================================
          console.log(
            "\n📊 [BUKTI VALIDASI PERHITUNGAN PANJANG VEKTOR (MAGNITUDE)]",
          );
          console.log(
            "--------------------------------------------------------------",
          );
          console.log(
            `A. Panjang Vektor A (Target) ||A||      : ${magA.toFixed(4)}`,
          );
          console.log(
            `B. Panjang Vektor B (Rekomendasi) ||B|| : ${magB.toFixed(4)}`,
          );
          console.log(
            "--------------------------------------------------------------",
          );

          debugCount++;
        }
      }
    }

    // 4. Sorting & Limit
    const finalResult = recommendations
      .sort((a, b) => b.similarity_score - a.similarity_score)
      .slice(0, 10);

    res.status(200).json(finalResult);
  } catch (err) {
    console.error("Error Recommendation:", err);
    res.status(500).json({ message: "Gagal memproses rekomendasi buku" });
  }
};
