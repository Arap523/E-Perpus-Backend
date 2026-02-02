const prisma = require("../../config/prisma");
const { comparePassword, hashPassword } = require("../../utils/hashing");
const jwt = require("jsonwebtoken");

const roleMap = {
  3: "admin",
  4: "murid",
};

// ===================
// TOKEN RESPONSE FUNCTION
// ===================
function kirimTokenRes(user, role, res, status = null) {
  const token = jwt.sign(
    { id: user.id, role_id: user.role_id },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );

  res.status(200).json({
    message: "Login berhasil",
    token,
    user: {
      id: user.id,
      email: user.email,
      namaLengkap: user.namaLengkap,
      role,
      status,
    },
  });
}

// ======================================================
// LOGIN
// ======================================================
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email dan password wajib diisi." });
    }

    // 1. Cari User by Email (Prisma)
    const user = await prisma.users.findUnique({
      where: { email: email },
    });

    if (!user) {
      return res.status(401).json({ message: "Akun tidak ditemukan." });
    }

    // 2. Cek Password
    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) return res.status(401).json({ message: "Password salah." });

    // 3. Cek Role
    const role = roleMap[user.role_id];
    if (!role) return res.status(403).json({ message: "Role tidak dikenali." });

    let status = null;

    // 4. Cek Data Spesifik Role
    if (role === "murid") {
      const murid = await prisma.murid.findFirst({
        where: { user_id: user.id },
      });
      if (!murid)
        return res.status(403).json({ message: "Akun murid tidak ditemukan." });
      status = murid.status;
    } else if (role === "admin") {
      const admin = await prisma.admin.findFirst({
        where: { user_id: user.id },
      });
      if (!admin)
        return res.status(403).json({ message: "Akun admin tidak ditemukan." });
    }

    // 5. Kirim Token
    kirimTokenRes(user, role, res, status);
  } catch (err) {
    console.error("Login Error:", err);
    res
      .status(500)
      .json({ message: "Terjadi error server", error: err.message });
  }
};

// ------------------------------------------------------

// ======================================================
// REGISTER ADMIN
// ======================================================
exports.registerAdmin = async (req, res) => {
  try {
    const { email, password, konfirmasiPassword, namaLengkap } = req.body;

    if (!email || !password || !konfirmasiPassword || !namaLengkap) {
      return res.status(400).json({ message: "Semua field wajib diisi." });
    }

    if (password !== konfirmasiPassword) {
      return res
        .status(400)
        .json({ message: "Password dan konfirmasi harus sama." });
    }

    // Cek Email (Prisma)
    const existingUser = await prisma.users.findUnique({
      where: { email: email },
    });

    if (existingUser) {
      return res.status(409).json({ message: "Email sudah terdaftar." });
    }

    const hashedPassword = await hashPassword(password);

    // TRANSAKSI: Create User + Create Admin
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create User
      const newUser = await tx.users.create({
        data: {
          email,
          password: hashedPassword,
          namaLengkap,
          role_id: 3, // Role Admin
        },
      });

      // 2. Create Admin
      const newAdmin = await tx.admin.create({
        data: {
          user_id: newUser.id,
        },
      });

      return { newUser, newAdmin };
    });

    res.status(201).json({
      message: "Registrasi admin berhasil",
      user_id: result.newUser.id,
      admin_id: result.newAdmin.id,
    });
  } catch (err) {
    console.error("Reg Admin Error:", err);
    res
      .status(500)
      .json({ message: "Terjadi error server", error: err.message });
  }
};

// ------------------------------------------------------

// ======================================================
// REGISTER MURID (Dengan Notifikasi) - FIXED ALL ISSUES
// ======================================================
exports.registerMurid = async (req, res) => {
  try {
    const io = req.io;
    let {
      email,
      password,
      konfirmasiPassword,
      namaLengkap,
      nis,
      kelas,
      jurusan,
      jenis_kelamin,
      alamat,
      telepon,
    } = req.body;

    // 1. Perbaiki format ENUM jenis_kelamin
    if (jenis_kelamin) {
      jenis_kelamin = jenis_kelamin.replace(/-/g, "_").replace(/ /g, "_");
    }

    // Validasi
    if (
      !email ||
      !password ||
      !konfirmasiPassword ||
      !namaLengkap ||
      !nis ||
      !kelas ||
      !jenis_kelamin ||
      !alamat ||
      !telepon ||
      ((kelas === "XI" || kelas === "XII") && !jurusan)
    ) {
      return res
        .status(400)
        .json({ message: "Field wajib diisi sesuai ketentuan." });
    }

    if (password !== konfirmasiPassword) {
      return res
        .status(400)
        .json({ message: "Konfirmasi password tidak cocok." });
    }

    const existingUser = await prisma.users.findUnique({
      where: { email: email },
    });

    if (existingUser) {
      return res.status(409).json({ message: "Email sudah digunakan." });
    }

    const hashedPassword = await hashPassword(password);

    // TRANSAKSI: Create User + Create Murid
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create User
      const newUser = await tx.users.create({
        data: {
          email,
          password: hashedPassword,
          namaLengkap,
          role_id: 4, // Role Murid
        },
      });

      // 2. Create Murid
      const newMurid = await tx.murid.create({
        data: {
          user_id: newUser.id,
          nis,
          kelas,
          jurusan: jurusan || null,
          jenis_kelamin,
          alamat,
          telepon,
          // FIX 2: Menggunakan nama ENUM dari Schema, bukan nilai map-nya
          status: "tidak_aktif",
        },
      });

      return { newUser, newMurid };
    });

    const muridId = result.newMurid.id;
    const userId = result.newUser.id;

    // ============================
    // LOGIKA NOTIFIKASI
    // ============================

    // 1. Notif ke MURID (Disimpan ke DB + Socket)
    try {
      const pesanMurid =
        "Akun anda telah berhasil register silahkan menghubungi admin untuk aktvasi akun anda";

      await prisma.notifikasi.create({
        data: {
          murid_id: muridId,
          pesan: pesanMurid,
          status: "unread",
        },
      });

      io.to(`user_${userId}`).emit("new_notification", {
        message: pesanMurid,
        timestamp: new Date(),
      });
    } catch (notifError) {
      console.error("Gagal kirim notif murid:", notifError);
    }

    // 2. Notif ke ADMIN (Tabel notifikasi_admin)
    try {
      const pesanAdmin = `Murid baru "${namaLengkap}" telah mendaftar dan menunggu aktivasi.`;

      // FIX 3: Cari ID Admin (role_id = 3) untuk memenuhi kolom user_id yang wajib
      const adminUser = await prisma.users.findFirst({
        where: { role_id: 3 },
        select: { id: true },
      });

      if (adminUser) {
        await prisma.notifikasi_admin.create({
          data: {
            user_id: adminUser.id, // <-- ID Admin ditambahkan di sini
            pesan: pesanAdmin,
            status: "unread",
          },
        });
      } else {
        console.warn(
          "Peringatan: Tidak ada user Admin yang ditemukan (role_id: 3). Notifikasi Admin tidak disimpan."
        );
      }

      // Broadcast ke room admin (via Socket.IO)
      io.emit("new_admin_notification", {
        message: pesanAdmin,
        timestamp: new Date(),
      });
    } catch (notifError) {
      // Ini akan menangani error jika ada masalah koneksi DB atau skema lain saat menyimpan notif admin
      console.error("Gagal kirim notif admin:", notifError);
    }

    res.status(201).json({
      message: "Registrasi murid berhasil",
      user_id: userId,
      murid_id: muridId,
    });
  } catch (err) {
    console.error("Reg Murid Error:", err);
    res
      .status(500)
      .json({ message: "Terjadi error server", error: err.message });
  }
};
