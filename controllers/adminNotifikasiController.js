const prisma = require("../config/prisma");

// ======================================================
// 1. GET NOTIFIKASI ADMIN
// ======================================================
exports.getByUser = async (req, res) => {
  try {
    const { user_id } = req.params;

    // Validasi input
    if (!user_id)
      return res.status(400).json({ message: "User ID tidak valid" });

    const rawData = await prisma.notifikasi_admin.findMany({
      where: {
        user_id: parseInt(user_id), // Filter punya user ini aja
      },
      orderBy: {
        created_at: "desc",
      },
    });

    res.status(200).json(rawData);
  } catch (err) {
    console.error("Error get notif admin:", err);
    res.status(500).json({ message: "Gagal ambil data", error: err.message });
  }
};

// ======================================================
// 2. MARK READ (Satu Notifikasi)
// ======================================================
exports.markRead = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`[DEBUG] Mark Read ID: ${id}`);

    const updated = await prisma.notifikasi_admin.update({
      where: { id: parseInt(id) },
      data: {
        status: "read", // ✅ Sesuai ENUM di schema lu
      },
    });

    res.json({ message: "Notifikasi dibaca", data: updated });
  } catch (err) {
    console.error("[DEBUG] Error markRead:", err.message);

    // Error P2025 = Record not found
    if (err.code === "P2025") {
      return res.status(404).json({ message: "Notifikasi tidak ditemukan" });
    }
    res.status(500).json({ message: "Gagal update", error: err.message });
  }
};

// ======================================================
// 3. MARK ALL READ (Semua Notifikasi User Tersebut)
// ======================================================
exports.markAllRead = async (req, res) => {
  try {
    // ⚠️ Frontend WAJIB kirim { user_id: 18 } di Body!
    const { user_id } = req.body;

    if (!user_id) {
      return res
        .status(400)
        .json({ message: "User ID wajib dikirim di body!" });
    }

    console.log(`[DEBUG] Mark All Read for User: ${user_id}`);

    const result = await prisma.notifikasi_admin.updateMany({
      where: {
        user_id: parseInt(user_id), // ✅ Filter biar user lain gak kena imbas
        status: "unread", // ✅ Cuma update yang masih unread
      },
      data: {
        status: "read", // ✅ Sesuai ENUM
      },
    });

    res.json({ message: `${result.count} notifikasi ditandai sudah dibaca` });
  } catch (err) {
    console.error("Error mark all read:", err);
    res.status(500).json({ message: "Gagal proses", error: err.message });
  }
};

// ======================================================
// 4. DELETE NOTIFIKASI
// ======================================================
exports.deleteNotif = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.notifikasi_admin.delete({
      where: { id: parseInt(id) },
    });

    res.status(200).json({ message: "Notifikasi berhasil dihapus" });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(200).json({ message: "Notifikasi sudah tidak ada" });
    }
    res.status(500).json({ message: "Gagal hapus", error: err.message });
  }
};
