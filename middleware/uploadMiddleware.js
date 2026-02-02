const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Path relatif dari folder middleware ke folder public/uploads
const uploadPath = path.join(__dirname, "../public/uploads");

// Pastikan direktori ada
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Ambil ID User dari token (disediakan oleh middleware 'protect')
    const userId = req.user?.id || "guest";
    const ext = path.extname(file.originalname).toLowerCase();

    // Bersihkan nama file asli dan batasi panjangnya
    const baseName = path
      .basename(file.originalname, ext)
      .replace(/\s+/g, "_")
      .replace(/[^\w-]/g, "") // Hapus karakter non-alphanumeric lain
      .substring(0, 15);

    // Format: userId-timestamp-basename.ext
    const uniqueName = `${userId}-${Date.now()}-${baseName}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // Max 5MB
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExt = [".jpg", ".jpeg", ".png"];
    if (!allowedExt.includes(ext)) {
      return cb(new Error("Hanya file gambar JPG/PNG yang diizinkan"), false);
    }
    cb(null, true);
  },
});

module.exports = {
  // Digunakan untuk profile picture (req.file)
  single: upload.single.bind(upload), // Digunakan untuk array file atau field lain
  array: upload.array.bind(upload),
  none: upload.none.bind(upload),
};
