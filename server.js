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

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "http://localhost:3000",
      "https://e-perpus.netlify.app",
      "http://103.175.218.4"
    ],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

global.io = io;

require("./utils/scheduler");

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:3000",
      "https://e-perpus.netlify.app",
      "http://103.175.218.4"
    ],
    credentials: true,
  })
);

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(morgan("combined"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(function(req, res, next) {
  req.io = io;
  next();
});

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

app.get("/", function(req, res) {
  res.json({
    success: true,
    message: "E-Perpus Backend API is running",
    timestamp: new Date().toISOString(),
    socketIO: "enabled"
  });
});

io.on("connection", function(socket) {
  console.log("User connected:", socket.id);
  
  var token = socket.handshake.auth.token;
  if (token) {
    try {
      var decoded = jwt.verify(token, process.env.JWT_SECRET);
      var userId = decoded.id;
      if (userId) {
        var roomName = "user_" + userId;
        socket.join(roomName);
        console.log("User " + userId + " joined room: " + roomName);
      }
    } catch (err) {
      console.log("Socket Auth Error:", err.message);
    }
  }

  socket.on("disconnect", function() {
    console.log("User disconnected:", socket.id);
  });
});

app.use(function(req, res, next) {
  res.status(404).json({
    success: false,
    message: "Route not found"
  });
});

app.use(function(err, req, res, next) {
  console.error("Error:", err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error"
  });
});

var PORT = process.env.PORT || 5001;

server.listen(PORT, "0.0.0.0", function() {
  console.log("Server running on port " + PORT);
  console.log("Environment: " + (process.env.NODE_ENV || "development"));
  console.log("Local: http://localhost:" + PORT);
  console.log("Network: http://103.175.218.4:" + PORT);
  console.log("Socket.IO enabled");
});

module.exports = app;
