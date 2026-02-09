const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

dotenv.config();
const app = express();

// ==========================================
// ✅ 1. SETUP SERVER & SOCKET.IO
// ==========================================
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    // GANTI: Masukkan URL Netlify kamu di sini
    origin: ["https://project-kamu.netlify.app", "http://localhost:5173"],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

global.io = io;

// ==========================================
// ✅ 2. IMPORT SCHEDULER
// ==========================================
// CATATAN: Scheduler (Cron) tidak akan berjalan otomatis di Vercel Serverless.
// Kamu harus menggunakan "Vercel Cron Jobs" di dashboard Vercel.
require("./utils/scheduler");

// ==========================================
// ✅ 3. MIDDLEWARE
// ==========================================
app.use(
  cors({
    // GANTI: Masukkan URL Netlify kamu di sini
    origin: [ 'http://localhost:5173',
    'http://localhost:3000',
    'https://e-perpus.netlify.app',],
    credentials: true,
  }),
);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(morgan("combined"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  req.io = io;
  next();
});

// ==========================================
// ✅ 4. ROUTES
// ==========================================
app.use("/api/auth", require("./routes/Auth/AuthRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/murid", require("./routes/muridRoutes"));
app.use("/api/buku", require("./routes/bukuRoutes"));
app.use("/api/kategori", require("./routes/kategoriRoutes"));
app.use("/api/peminjaman", require("./routes/peminjamanRoutes"));
app.use("/api/profile", require("./routes/profileRoutes"));
app.use("/api/notifikasi", require("./routes/notifikasiRoutes"));
app.use("/api/notifikasi/admin", require("./routes/adminNotifikasiRoutes"));
app.use("/api/eksemplar", require("./routes/eksemplarRoutes"));
app.use("/api/laporan", require("./routes/laporanRoutes"));

// CATATAN: Vercel tidak mendukung penyimpanan file lokal permanen.
// Gunakan Supabase Storage untuk foto buku/profil.
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));

// ==========================================
// ✅ 5. SOCKET.IO CONNECTION LOGIC
// ==========================================
// CATATAN: WebSockets (Socket.io) tidak didukung secara native oleh Vercel Serverless.
// Koneksi akan terputus setiap kali fungsi selesai dijalankan.
io.on("connection", (socket) => {
  const token = socket.handshake.auth.token;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.id;
      if (userId) {
        const roomName = `user_${userId}`;
        socket.join(roomName);
      }
    } catch (err) {
      console.log("❌ Socket Auth Error:", err.message);
    }
  }
});

// ==========================================
// ✅ 6. EXPORT UNTUK VERCEL
// ==========================================
// Vercel tidak membutuhkan server.listen. Cukup export app Express-nya.
module.exports = app;