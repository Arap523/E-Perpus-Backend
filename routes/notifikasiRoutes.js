const express = require("express");
const router = express.Router();
const notifikasiController = require("../controllers/notifikasiController");

// Ambil notif berdasarkan user_id
router.get("/:user_id", notifikasiController.getByUser);

// --- PERBAIKAN DI SINI ---
// Tambahkan PUT karena Frontend lo manggil "PUT /api/notifikasi/read/93"
router.put("/read/:id", notifikasiController.markRead);

// Tetap jaga PATCH buat jaga-jaga kalau ada bagian lain yang pake
router.patch("/:id/read", notifikasiController.markRead);
router.patch("/user/:user_id/read-all", notifikasiController.markAllRead);

// Route Delete
router.delete("/:id", notifikasiController.deleteNotif);

module.exports = router;
