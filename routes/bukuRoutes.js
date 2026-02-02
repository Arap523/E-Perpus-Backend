const express = require("express");
const router = express.Router();
const bukuController = require("../controllers/bukuController");
const protect = require("../middleware/protect");
const upload = require("../middleware/uploadMiddleware");

// Semua user bisa melihat daftar buku (public)
router.get("/", bukuController.getAll);

// 🚨 REKOMENDASI BUKU (Taruh di atas route /:id biar gak bentrok kalau perlu)
router.get("/rekomendasi/:id", bukuController.getRecommendation);

// Ambil satu buku berdasarkan ID (buat edit)
router.get("/:id", bukuController.getById);

// Hanya admin yang boleh melihat detail inventaris stok ini.
router.get(
  "/eksemplar/:bukuId",
  protect(["admin"]),
  bukuController.getEksemplarDetail
);

// Hanya admin yang bisa tambah buku + upload cover
router.post(
  "/",
  protect(["admin"]),
  upload.single("cover"),
  bukuController.create
);

// Admin bisa update buku + upload cover baru
router.put(
  "/:id",
  protect(["admin"]),
  upload.single("cover"),
  bukuController.update
);

// Admin bisa hapus buku
router.delete("/:id", protect(["admin"]), bukuController.delete);

module.exports = router;
