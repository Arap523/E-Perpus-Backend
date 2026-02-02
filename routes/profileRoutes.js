const express = require("express");
const router = express.Router();

// Import middleware protect
const protect = require("../middleware/protect");

// Import middleware upload Multer (Ganti path sesuai lokasi lu)
const upload = require("../middleware/uploadMiddleware");

// Import fungsi dari controller masing-masing
const adminController = require("../controllers/adminController");
const muridController = require("../controllers/muridController");

// ======================================================
// GET PROFILE (Shared Endpoint)
// ======================================================
router.get("/", protect(["admin", "murid"]), (req, res) => {
  // Menggunakan role string yang lebih stabil
  const roleString = req.user.role;

  if (roleString === "admin") {
    return adminController.getProfile(req, res);
  } else if (roleString === "murid") {
    return muridController.getProfile(req, res);
  } else {
    return res
      .status(403)
      .json({ message: "Akses ditolak: Role tidak dikenali." });
  }
});

// ======================================================
// UPDATE PROFILE (PUT /api/profile)
// ======================================================
router.put(
  "/",
  protect(["admin", "murid"]),
  upload.single("profile_picture"), // 👈 Multer berjalan di sini
  (req, res) => {
    const roleString = req.user.role;

    if (roleString === "admin") {
      // Panggil fungsi updateProfile Admin (yang harus handle req.file)
      return adminController.updateProfile(req, res);
    } else if (roleString === "murid") {
      // Panggil fungsi updateProfile Murid (yang harus handle req.file)
      return muridController.updateProfile(req, res);
    } else {
      return res.status(403).json({ message: "Role tidak valid." });
    }
  }
);

module.exports = router;
