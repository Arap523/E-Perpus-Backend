const prisma = require("../config/prisma");
const { hashPassword, comparePassword } = require("../utils/hashing");
const fs = require("fs"); // Wajib ada untuk hapus file
const path = require("path"); // Wajib ada untuk path file

// ======================================================
// GET ALL ADMINS
// ======================================================
exports.getAll = async (req, res) => {
  try {
    const admins = await prisma.admin.findMany({
      include: {
        users: {
          select: {
            id: true,
            namaLengkap: true,
            email: true,
            role_id: true,
          },
        },
      },
      orderBy: {
        created_at: "desc",
      },
    });

    const formattedData = admins.map((admin) => ({
      id: admin.id,
      user_id: admin.user_id,
      namaLengkap: admin.users?.namaLengkap,
      email: admin.users?.email,
      role_id: admin.users?.role_id,
      created_at: admin.created_at,
    }));

    res.json(formattedData);
  } catch (err) {
    console.error("Error getAll Admin:", err);
    res.status(500).json({ message: "Error server", error: err.message });
  }
};

// ======================================================
// GET PROFILE ADMIN (Ambil data berdasarkan User ID dari Token)
// ======================================================
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const admin = await prisma.admin.findFirst({
      where: { user_id: userId },
      include: {
        users: { select: { email: true, namaLengkap: true, role_id: true } },
      },
    });

    if (!admin) {
      return res
        .status(404)
        .json({ message: "Profile admin tidak ditemukan." });
    }

    // Flattening data
    const formattedData = {
      ...admin,
      email: admin.users?.email,
      namaLengkap: admin.users?.namaLengkap,
    };

    res.status(200).json({ data: formattedData });
  } catch (err) {
    console.error("Error getProfile Admin:", err);
    res.status(500).json({ message: "Gagal mengambil data profile." });
  }
};

// ======================================================
// CREATE ADMIN
// ======================================================
exports.create = async (req, res) => {
  try {
    const { namaLengkap, email, password } = req.body;

    if (!namaLengkap || !email || !password) {
      return res.status(400).json({ message: "Semua field wajib diisi." });
    } // Cek Email di tabel users

    const existing = await prisma.users.findUnique({
      where: { email: email },
    });

    if (existing) {
      return res.status(409).json({ message: "Email sudah terdaftar." });
    }

    const hashedPassword = await hashPassword(password); // Transaksi Create User + Admin

    const result = await prisma.$transaction(async (tx) => {
      const newUser = await tx.users.create({
        data: {
          namaLengkap,
          email,
          password: hashedPassword,
          role_id: 3, // Role Admin
        },
      });

      const newAdmin = await tx.admin.create({
        data: {
          user_id: newUser.id, // Telepon dan Alamat bisa diisi null saat create, diisi saat update profile
        },
      });

      return { newUser, newAdmin };
    });

    res.status(201).json({
      message: "Admin berhasil dibuat",
      id: result.newAdmin.id,
      user_id: result.newUser.id,
    });
  } catch (err) {
    console.error("Error Create Admin:", err);
    res.status(500).json({ message: "Error server", error: err.message });
  }
};

// ======================================================
// UPDATE ADMIN (Admin Edit Data dari Dashboard)
// ======================================================
exports.update = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { namaLengkap, email, password } = req.body;

    const currentAdmin = await prisma.admin.findUnique({
      where: { id: id },
      include: { users: true }, // Relasi ke users
    });

    if (!currentAdmin) {
      return res.status(404).json({ message: "Admin tidak ditemukan." });
    }

    const userId = currentAdmin.user_id; // Cek Email Unik (kalau diganti)

    if (email && email !== currentAdmin.users.email) {
      const emailCheck = await prisma.users.findUnique({
        where: { email: email },
      });
      if (emailCheck) {
        return res
          .status(409)
          .json({ message: "Email sudah digunakan user lain." });
      }
    }

    const updateData = {
      namaLengkap: namaLengkap || currentAdmin.users.namaLengkap,
      email: email || currentAdmin.users.email,
    };

    if (password) {
      updateData.password = await hashPassword(password);
    }

    await prisma.users.update({
      where: { id: userId },
      data: updateData,
    });

    res.json({ message: "Admin berhasil diperbarui" });
  } catch (err) {
    console.error("Error Update Admin:", err);
    res.status(500).json({ message: "Error server", error: err.message });
  }
};

// ======================================================
// UPDATE PROFILE ADMIN (Update Data & Password Sendiri) - FINAL FOTO FIX
// ======================================================
exports.updateProfile = async (req, res) => {
  // Asumsi req.file sudah diproses oleh Multer dan logic password change ada di frontend
  const userId = req.user.id;
  const { namaLengkap, email, telepon, alamat, oldPassword, newPassword } =
    req.body;

  // Path file baru (jika ada file di upload)
  let profilePicturePath = null;
  if (req.file) {
    profilePicturePath = `uploads/${req.file.filename}`;
  }

  try {
    const existingAdmin = await prisma.admin.findFirst({
      where: { user_id: userId },
      include: { users: true },
    });

    if (!existingAdmin) {
      // Hapus file jika admin tidak ditemukan
      if (req.file) {
        const filePath = path.join(
          __dirname,
          `../public/uploads/${req.file.filename}`
        );
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
      return res
        .status(404)
        .json({ message: "Profile admin tidak ditemukan." });
    }

    // --- VALIDASI & Cek Password (Logic SAMA) ---
    if (email && email !== existingAdmin.users.email) {
      const emailCheck = await prisma.users.findUnique({ where: { email } });
      if (emailCheck) {
        if (req.file) {
          // Hapus file jika validasi email gagal
          const filePath = path.join(
            __dirname,
            `../public/uploads/${req.file.filename}`
          );
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
        return res
          .status(409)
          .json({ message: "Email sudah digunakan user lain." });
      }
    }

    // Cek Password Lama jika ada permintaan ganti password
    if (oldPassword && newPassword) {
      const isMatch = await comparePassword(
        oldPassword,
        existingAdmin.users.password
      );
      if (!isMatch) {
        return res.status(401).json({ message: "Password lama salah." });
      }
    } else if (newPassword && !oldPassword) {
      return res.status(400).json({
        message: "Password lama harus diisi untuk mengganti password.",
      });
    }

    // --- TRANSAKSI UPDATE ---
    await prisma.$transaction(async (tx) => {
      // 1. Update Tabel USERS (Nama, Email, Password)
      const updateUserData = {};
      if (namaLengkap) updateUserData.namaLengkap = namaLengkap;
      if (email) updateUserData.email = email;
      if (newPassword)
        updateUserData.password = await hashPassword(newPassword);

      if (Object.keys(updateUserData).length > 0) {
        await tx.users.update({
          where: { id: userId },
          data: updateUserData,
        });
      }

      // 2. Update Tabel ADMIN (Telepon, Alamat, Foto)
      const updateAdminData = {};
      if ("telepon" in req.body) updateAdminData.telepon = telepon;
      if ("alamat" in req.body) updateAdminData.alamat = alamat;

      if (profilePicturePath) {
        // Tambahkan path foto baru
        updateAdminData.profile_picture = profilePicturePath;

        // Hapus cover lama jika ada dan bukan default
        if (
          existingAdmin.profile_picture &&
          !existingAdmin.profile_picture.includes("default")
        ) {
          const oldPath = path.join(
            __dirname,
            `../public/${existingAdmin.profile_picture}`
          );
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }
      }

      if (Object.keys(updateAdminData).length > 0) {
        await tx.admin.update({
          where: { id: existingAdmin.id },
          data: updateAdminData,
        });
      }
    });

    res.status(200).json({ message: "Profile admin berhasil diperbarui." });
  } catch (err) {
    // Jika ada error fatal (database connection, dll), hapus file yang baru diupload
    if (req.file) {
      const filePath = path.join(
        __dirname,
        `../public/uploads/${req.file.filename}`
      );
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    console.error("Error updateProfile Admin:", err);
    if (err.code === "P2002") {
      return res
        .status(409)
        .json({ message: "Email sudah digunakan data lain." });
    }
    res
      .status(500)
      .json({ message: "Gagal memperbarui profile.", error: err.message });
  }
};

// ======================================================
// DELETE ADMIN
// ======================================================
exports.delete = async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const adminData = await prisma.admin.findUnique({
      where: { id: id },
    });

    if (!adminData) {
      return res.status(404).json({ message: "Admin tidak ditemukan." });
    } // Hapus User (Cascade delete di DB akan otomatis hapus Admin juga) // Tapi pakai transaksi lebih aman biar jelas logic-nya

    await prisma.$transaction(async (tx) => {
      // Karena di schema lu: onDelete: Cascade,
      // hapus users -> otomatis hapus admin
      await tx.users.delete({
        where: { id: adminData.user_id },
      });
    });

    res.json({ message: "Admin berhasil dihapus" });
  } catch (err) {
    console.error("Error Delete Admin:", err);
    res
      .status(500)
      .json({ message: "Gagal menghapus admin", error: err.message });
  }
};

// ======================================================
// CHANGE PASSWORD
// ======================================================
exports.changePassword = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: "Password lama dan baru wajib diisi." });
    }

    const adminData = await prisma.admin.findUnique({
      where: { id: id },
      include: { users: true },
    });

    if (!adminData) {
      return res.status(404).json({ message: "Admin tidak ditemukan." });
    }

    const isMatch = await comparePassword(
      oldPassword,
      adminData.users.password
    );
    if (!isMatch) {
      return res.status(401).json({ message: "Password lama salah." });
    }

    const hashedPassword = await hashPassword(newPassword);

    await prisma.users.update({
      where: { id: adminData.user_id },
      data: { password: hashedPassword },
    });

    res.json({ message: "Password berhasil diubah." });
  } catch (err) {
    console.error("Error Change Password:", err);
    res.status(500).json({ message: "Error server", error: err.message });
  }
};
