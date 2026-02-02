const prisma = require("../config/prisma");
const { hashPassword } = require("../utils/hashing");
const fs = require("fs");
const path = require("path");

const uploadPath = path.join(__dirname, "../public/uploads");

// ======================================================
// GET ALL MURID
// ======================================================
exports.getAll = async (req, res) => {
  try {
    const students = await prisma.murid.findMany({
      include: {
        users: {
          select: { email: true, namaLengkap: true },
        },
      },
      orderBy: { id: "desc" },
    });

    const formattedData = students.map((s) => ({
      id: s.id,
      user_id: s.user_id,
      nis: s.nis,
      kelas: s.kelas,
      jurusan: s.jurusan,
      jenis_kelamin: s.jenis_kelamin,
      alamat: s.alamat,
      telepon: s.telepon,
      status: s.status,
      profile_picture: s.profile_picture,
      email: s.users?.email,
      namaLengkap: s.users?.namaLengkap,
      created_at: s.created_at,
    }));

    res.status(200).json({
      message: "Data murid berhasil diambil.",
      data: formattedData,
    });
  } catch (err) {
    console.error("Error getAll Murid:", err);
    res.status(500).json({ message: "Gagal mengambil data murid." });
  }
};

// ======================================================
// GET PROFILE MURID (By Token)
// ======================================================
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const student = await prisma.murid.findFirst({
      where: { user_id: userId },
      include: {
        users: { select: { email: true, namaLengkap: true, role_id: true } },
      },
    });

    if (!student) {
      return res
        .status(404)
        .json({ message: "Profile murid tidak ditemukan." });
    }

    const formattedData = {
      ...student,
      email: student.users?.email,
      namaLengkap: student.users?.namaLengkap,
    };

    res.status(200).json({ data: formattedData });
  } catch (err) {
    console.error("Error getProfile Murid:", err);
    res.status(500).json({ message: "Gagal mengambil data profile." });
  }
};

// ======================================================
// GET MURID BY ID (For Admin)
// ======================================================
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;

    const student = await prisma.murid.findUnique({
      where: { id: parseInt(id) },
      include: {
        users: {
          select: { email: true, namaLengkap: true },
        },
      },
    });

    if (!student) {
      return res.status(404).json({ message: "Murid tidak ditemukan." });
    }

    const formattedData = {
      ...student,
      email: student.users?.email,
      namaLengkap: student.users?.namaLengkap,
    };

    res.status(200).json({
      message: "Data murid berhasil diambil.",
      data: formattedData,
    });
  } catch (err) {
    res.status(500).json({ message: "Gagal mengambil data murid." });
  }
};

// ======================================================
// CREATE MURID (ADMIN)
// ======================================================
exports.create = async (req, res) => {
  try {
    let {
      email,
      password,
      namaLengkap,
      nis,
      kelas,
      jurusan,
      jenis_kelamin,
      alamat,
      telepon,
      status,
    } = req.body;

    if (jenis_kelamin) {
      jenis_kelamin = jenis_kelamin.replace(/-/g, "_").replace(/ /g, "_");
    }

    if (
      !email ||
      !password ||
      !namaLengkap ||
      !nis ||
      !kelas ||
      !jenis_kelamin ||
      !alamat ||
      !telepon
    ) {
      return res.status(400).json({ message: "Field wajib diisi." });
    }
    if ((kelas === "XI" || kelas === "XII") && !jurusan) {
      return res
        .status(400)
        .json({ message: "Jurusan wajib diisi untuk kelas XI dan XII." });
    }
    if (kelas === "X") jurusan = "-";
    status = status ?? "aktif";

    const existingEmail = await prisma.users.findUnique({ where: { email } });
    if (existingEmail)
      return res.status(409).json({ message: "Email sudah digunakan." });

    const existingNIS = await prisma.murid.findUnique({ where: { nis } });
    if (existingNIS)
      return res.status(409).json({ message: "NIS sudah digunakan." });

    const hashedPassword = await hashPassword(password);

    await prisma.$transaction(async (tx) => {
      const newUser = await tx.users.create({
        data: {
          email,
          password: hashedPassword,
          namaLengkap,
          role_id: 4, // Role Murid
        },
      });

      await tx.murid.create({
        data: {
          user_id: newUser.id,
          nis,
          kelas,
          jurusan,
          jenis_kelamin,
          alamat,
          telepon,
          status,
        },
      });
    });

    res.status(201).json({ message: "Murid berhasil ditambahkan." });
  } catch (err) {
    console.error("Error create murid:", err);
    res
      .status(500)
      .json({ message: "Gagal menambahkan murid.", error: err.message });
  }
};

// ======================================================
// UPDATE MURID (Admin Edit Data)
// ======================================================
exports.update = async (req, res) => {
  try {
    const muridId = parseInt(req.params.id);
    const io = req.io;

    const existingMurid = await prisma.murid.findUnique({
      where: { id: muridId },
      include: { users: true },
    });

    if (!existingMurid) {
      return res.status(404).json({ message: "Murid tidak ditemukan." });
    }

    let {
      email,
      namaLengkap,
      nis,
      kelas,
      jurusan,
      jenis_kelamin,
      alamat,
      telepon,
      status,
    } = req.body;

    if (jenis_kelamin) {
      jenis_kelamin = jenis_kelamin.replace(/-/g, "_").replace(/ /g, "_");
    }

    if (
      !email ||
      !namaLengkap ||
      !nis ||
      !kelas ||
      !jenis_kelamin ||
      !alamat ||
      !telepon
    ) {
      return res.status(400).json({ message: "Field wajib diisi." });
    }
    if ((kelas === "XI" || kelas === "XII") && !jurusan) {
      return res
        .status(400)
        .json({ message: "Jurusan wajib diisi untuk kelas XI dan XII." });
    }
    if (kelas === "X") jurusan = "-";
    status = status ?? "aktif";

    const updateMuridData = {
      nis,
      kelas,
      jurusan,
      jenis_kelamin,
      alamat,
      telepon,
      status,
    };

    const finalMuridData = {};
    for (const key in updateMuridData) {
      if (req.body.hasOwnProperty(key)) {
        finalMuridData[key] = updateMuridData[key];
      }
    }

    await prisma.murid.update({
      where: { id: muridId },
      data: {
        ...finalMuridData,
        users: {
          update: {
            email: email,
            namaLengkap: namaLengkap,
          },
        },
      },
    });

    // Notifikasi logic
    const oldStatus = existingMurid.status;
    const newStatus = status;
    let pesan = null;

    if (oldStatus !== "aktif" && newStatus === "aktif") {
      pesan = `🎉 Selamat! Akun E-Perpus Anda telah diaktifkan oleh Admin.`;
    } else if (oldStatus === "aktif" && newStatus !== "aktif") {
      pesan = `⚠️ Perhatian! Akun E-Perpus Anda telah dinonaktifkan sementara.`;
    }

    if (pesan) {
      await prisma.notifikasi.create({
        data: {
          murid_id: muridId,
          pesan: pesan,
          status: "unread",
        },
      });

      if (io) {
        io.to(`user_${existingMurid.user_id}`).emit("new_notification", {
          message: pesan,
          timestamp: new Date(),
        });
      }
    }

    res.status(200).json({ message: "Murid berhasil diperbarui." });
  } catch (err) {
    console.error("Error update murid:", err);
    if (err.code === "P2002") {
      return res
        .status(409)
        .json({ message: "Email atau NIS sudah digunakan data lain." });
    }
    res
      .status(500)
      .json({ message: "Gagal memperbarui murid.", error: err.message });
  }
};

// ======================================================
// UPDATE PROFILE MURID (Self Update) - FIXED 🛠️
// ======================================================
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    let { namaLengkap, email, telepon, alamat, password } = req.body;
    const file = req.file;

    const existingMurid = await prisma.murid.findFirst({
      where: { user_id: userId },
      include: { users: true },
    });

    if (!existingMurid) {
      if (file) fs.unlinkSync(path.join(uploadPath, file.filename));
      return res
        .status(404)
        .json({ message: "Profile murid tidak ditemukan untuk user ini." });
    }

    const actualMuridId = existingMurid.id;

    // Cek Email Duplikasi
    if (email && email !== existingMurid.users.email) {
      const emailCheck = await prisma.users.findUnique({ where: { email } });
      if (emailCheck) {
        if (file) fs.unlinkSync(path.join(uploadPath, file.filename));
        return res
          .status(409)
          .json({ message: "Email sudah digunakan oleh akun lain." });
      }
    }

    const updateUserData = {};
    if (email) updateUserData.email = email;
    if (namaLengkap) updateUserData.namaLengkap = namaLengkap;
    if (password) updateUserData.password = await hashPassword(password);

    const updateMuridData = {};
    if ("telepon" in req.body) updateMuridData.telepon = telepon;
    if ("alamat" in req.body) updateMuridData.alamat = alamat;

    // === LOGIKA FILE UPLOAD ===
    let oldProfilePicture = existingMurid.profile_picture;
    if (file) {
      // ✅ FIX: Tambah prefix 'uploads/' agar format sama dengan Admin
      updateMuridData.profile_picture = `uploads/${file.filename}`;
    }

    // TRANSAKSI
    await prisma.$transaction(async (tx) => {
      if (Object.keys(updateUserData).length > 0) {
        await tx.users.update({
          where: { id: userId },
          data: updateUserData,
        });
      }
      if (Object.keys(updateMuridData).length > 0) {
        await tx.murid.update({
          where: { id: actualMuridId },
          data: updateMuridData,
        });
      }
    });

    // === LOGIKA HAPUS FILE LAMA (SETELAH TRANSAKSI BERHASIL) ===
    if (file && oldProfilePicture) {
      // ✅ FIX: Gunakan path relative ke public karena oldProfilePicture sekarang isinya "uploads/namafile.jpg"
      const oldFilePath = path.join(__dirname, "../public", oldProfilePicture);

      // Cek file ada & pastikan bukan file yang baru saja diupload
      if (
        fs.existsSync(oldFilePath) &&
        !oldProfilePicture.includes(file.filename)
      ) {
        fs.unlink(oldFilePath, (err) => {
          if (err)
            console.error("Gagal menghapus file lama:", oldFilePath, err);
        });
      }
    }

    res.status(200).json({ message: "Profile murid berhasil diperbarui." });
  } catch (err) {
    console.error("Error updateProfile Murid:", err);

    // === CLEANUP FILE BARU JIKA ERROR ===
    if (req.file) {
      fs.unlink(path.join(uploadPath, req.file.filename), (unlinkErr) => {
        if (unlinkErr)
          console.error("Gagal menghapus file baru setelah error:", unlinkErr);
      });
    }

    if (err.code === "P2002") {
      return res
        .status(409)
        .json({ message: "Email sudah digunakan oleh akun lain." });
    }
    res
      .status(500)
      .json({ message: "Gagal memperbarui profile.", error: err.message });
  }
};

// ======================================================
// DELETE MURID
// ======================================================
exports.delete = async (req, res) => {
  try {
    const muridId = parseInt(req.params.id);

    const muridData = await prisma.murid.findUnique({
      where: { id: muridId },
    });

    if (!muridData) {
      return res.status(404).json({ message: "Murid tidak ditemukan." });
    }

    // Hapus User (Parent) -> Cascade Delete ke Murid
    await prisma.users.delete({
      where: { id: muridData.user_id },
    });

    res.status(200).json({ message: "Murid berhasil dihapus." });
  } catch (err) {
    console.error("Error delete murid:", err);
    res.status(500).json({ message: "Gagal menghapus murid." });
  }
};
