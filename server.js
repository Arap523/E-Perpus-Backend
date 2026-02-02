const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const helmet = require("helmet");
const morgan = require("morgan");
const multer = require("multer");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken"); // 1. WAJIB IMPORT JWT

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

// ==========================================
// ✅ 1. SETUP SERVER & SOCKET.IO
// ==========================================
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:4173"],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

global.io = io;

// ==========================================
// ✅ 2. IMPORT SCHEDULER
// ==========================================
require("./utils/scheduler");

// ==========================================
// ✅ 3. MIDDLEWARE
// ==========================================
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:4173"],
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
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));

// ==========================================
// ✅ 5. SOCKET.IO CONNECTION LOGIC (UPDATED)
// ==========================================
io.on("connection", (socket) => {
  // Ambil token dari handshake auth yang dikirim Frontend
  const token = socket.handshake.auth.token;

  console.log(`🔌 Socket connecting: ${socket.id}`);

  if (token) {
    try {
      // Decode token untuk dapatkan User ID
      // Pastikan process.env.JWT_SECRET sesuai dengan .env lu
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.id; // Sesuaikan dengan payload token lu (id/userId)

      if (userId) {
        // OTOMATIS JOIN ROOM (Tanpa nunggu event 'join')
        const roomName = `user_${userId}`;
        socket.join(roomName);
        console.log(`✅ User ${userId} AUTOMATICALLY joined room: ${roomName}`);
      }
    } catch (err) {
      console.log("❌ Socket Auth Error:", err.message);
    }
  } else {
    console.log("⚠️ Client connect tanpa token");
  }

  socket.on("disconnect", () => {
    console.log(`❌ Socket disconnected: ${socket.id}`);
  });
});

// ==========================================
// ✅ 6. START SERVER
// ==========================================
server.listen(PORT, () => {
  console.log(`✅ Server berjalan di http://localhost:${PORT}`);
});
