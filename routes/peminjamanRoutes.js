const express = require("express");
const router = express.Router();
const peminjamanController = require("../controllers/peminjamanController");
const protect = require("../middleware/protect");

// 1. Route Umum
router.get("/", protect(["admin", "murid"]), peminjamanController.getAll);
router.post("/", protect(["admin", "murid"]), peminjamanController.create);
router.get(
  "/riwayat",
  protect(["murid"]),
  peminjamanController.getRiwayatMurid
);

// 2. 🔥 ROUTE CHART STATISTIK (Baru) 🔥
// Taruh di sini biar rapi (dikelompokkan sesama GET)
// Pake protect admin karena ini data dashboard
router.get(
  "/chart-stats",
  protect(["admin"]),
  peminjamanController.getChartPeminjaman
);

// 3. Route dengan Parameter ID (:id)
router.put("/:id", protect(["admin"]), peminjamanController.updateStatus);
router.delete("/:id", protect(["admin"]), peminjamanController.delete);

module.exports = router;
