// routes/muridRoutes.js

const express = require("express");
const router = express.Router();

const muridController = require("../controllers/muridController");
const protect = require("../middleware/protect");

// Hanya admin yang bisa ambil semua data murid
router.get("/", protect(["admin"]), muridController.getAll);
// Ambil murid berdasarkan ID
router.get("/:id", protect(["admin", "murid"]), muridController.getById);

router.post("/", protect(["admin"]), muridController.create);

// Admin dan murid bisa update data, tapi dicek di controller agar murid hanya ubah miliknya
router.put("/:id", protect(["admin", "murid"]), muridController.update);

// Admin dan murid bisa hapus data, tapi dicek di controller agar murid hanya hapus miliknya
router.delete("/:id", protect(["admin", "murid"]), muridController.delete);

module.exports = router;
