const prisma = require("../config/prisma");

// ======================================================
// GET ALL (Ubah nama jadi getAll)
// ======================================================
exports.getAll = async (req, res) => {
  try {
    const data = await prisma.kategori.findMany({
      orderBy: { id: "desc" },
    });

    res.status(200).json({
      status: "success",
      data: data,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ======================================================
// CREATE (Ubah nama jadi create)
// ======================================================
exports.create = async (req, res) => {
  try {
    const { nama_kategori } = req.body;

    const newKategori = await prisma.kategori.create({
      data: {
        nama_kategori: nama_kategori,
      },
    });

    res.status(201).json({
      status: "success",
      message: "Kategori berhasil ditambahkan",
      data: newKategori,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ======================================================
// UPDATE (Ubah nama jadi update)
// ======================================================
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { nama_kategori } = req.body;

    await prisma.kategori.update({
      where: { id: parseInt(id) },
      data: { nama_kategori: nama_kategori },
    });

    res.status(200).json({ message: "Kategori berhasil diupdate" });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ message: "Kategori tidak ditemukan" });
    }
    res.status(500).json({ message: error.message });
  }
};

// ======================================================
// DELETE (Ubah nama jadi delete)
// ======================================================
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.kategori.delete({
      where: { id: parseInt(id) },
    });

    res.status(200).json({ message: "Kategori berhasil dihapus" });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ message: "Kategori tidak ditemukan" });
    }
    if (error.code === "P2003") {
      return res
        .status(400)
        .json({ message: "Gagal hapus: Kategori sedang digunakan oleh Buku." });
    }
    res.status(500).json({ message: error.message });
  }
};
