const prisma = require("../config/prisma");

// ======================================================
// GET NOTIFIKASI MURID
// ======================================================
exports.getByUser = async (req, res) => {
  try {
    const { user_id } = req.params;

    const murid = await prisma.murid.findFirst({
      where: { user_id: parseInt(user_id) },
      select: { id: true },
    });

    if (!murid) {
      return res.status(404).json({ message: "Data murid tidak ditemukan." });
    }

    const rawData = await prisma.notifikasi.findMany({
      where: { murid_id: murid.id },
      orderBy: { created_at: "desc" },
    });

    const formatted = rawData.map((item) => ({
      ...item,
      message: item.pesan, // Menjaga kompatibilitas dengan frontend
    }));

    res.status(200).json(formatted);
  } catch (err) {
    console.error("Error get notif murid:", err);
    res
      .status(500)
      .json({ message: "Gagal ambil notifikasi murid", error: err.message });
  }
};

// ======================================================
// MARK READ (Tandai Satu)
// FIX: Menggunakan PUT/PATCH dan disesuaikan dengan log frontend
// ======================================================
exports.markRead = async (req, res) => {
  try {
    const { id } = req.params;

    // Cek dulu apakah datanya ada sebelum diupdate
    const existing = await prisma.notifikasi.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existing) {
      return res.status(404).json({ message: "Notifikasi tidak ditemukan" });
    }

    await prisma.notifikasi.update({
      where: { id: parseInt(id) },
      data: { status: "read" },
    });

    res.json({ message: "Notifikasi ditandai sebagai dibaca" });
  } catch (err) {
    console.error("Error mark read:", err.message);
    res.status(500).json({ message: "Gagal update notifikasi" });
  }
};

// ======================================================
// MARK ALL READ
// ======================================================
exports.markAllRead = async (req, res) => {
  try {
    const { user_id } = req.params;

    const murid = await prisma.murid.findFirst({
      where: { user_id: parseInt(user_id) },
      select: { id: true },
    });

    if (!murid)
      return res.status(404).json({ message: "Murid tidak ditemukan" });

    await prisma.notifikasi.updateMany({
      where: { murid_id: murid.id, status: "unread" },
      data: { status: "read" },
    });

    res.json({ message: "Semua notifikasi ditandai sebagai dibaca" });
  } catch (err) {
    console.error("Error mark all read:", err);
    res.status(500).json({ message: "Gagal menandai semua" });
  }
};

// ======================================================
// DELETE NOTIFIKASI (FIXED: Anti-Crash)
// ======================================================
exports.deleteNotif = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Cek dulu datanya ada atau nggak
    const target = await prisma.notifikasi.findUnique({
      where: { id: parseInt(id) },
    });

    // 2. Kalau nggak ada, jangan lanjut delete, langsung suksesin aja (Idempotent)
    if (!target) {
      return res
        .status(404)
        .json({ message: "Notifikasi memang sudah tidak ada" });
    }

    // 3. Kalau ada, baru delete
    await prisma.notifikasi.delete({
      where: { id: parseInt(id) },
    });

    res.status(200).json({ message: "Notifikasi berhasil dihapus" });
  } catch (err) {
    // Menangani error Prisma jika data hilang di waktu bersamaan (race condition)
    console.error("Gagal hapus notif murid:", err.message);
    res.status(500).json({ message: "Gagal menghapus notifikasi" });
  }
};
