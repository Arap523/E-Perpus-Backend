const express = require("express");
const router = express.Router();
const eksemplarController = require("../controllers/eksemplarController");
const protect = require("../middleware/protect");

// Middleware Auth
router.use(protect(["admin"]));

// 1. GET ALL
router.get("/", eksemplarController.getAll);

// 2. CREATE
router.post("/", eksemplarController.create);

// 3. DETAIL (BALIKIN KE VERSI LAMA PAKE /detail) ⚠️
// Ini biar Frontend lu gak error 404 pas mau edit
router.get("/:id/detail", eksemplarController.getEksemplarDetail);

// 4. UPDATE STATUS (Hilang/Rusak/Tersedia)
// Tetap arahin ke 'updateStatus' ya, biar logic dendanya jalan
router.put("/:id", eksemplarController.updateStatus);

// 5. DELETE
router.delete("/:id", eksemplarController.delete);

module.exports = router;
