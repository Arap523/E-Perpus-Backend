const prisma = require("../config/prisma");

exports.getLaporan = async (req, res) => {
  try {
    const { start_date, end_date, status } = req.query;

    // 1. Build Filter
    let whereClause = {};

    // Filter Tanggal
    if (start_date && end_date) {
      whereClause.tanggal_pinjam = {
        gte: new Date(start_date),
        lte: new Date(end_date),
      };
    }

    // Filter Status
    if (status) {
      whereClause.status_pinjam = status;
    }

    // 2. Query Database
    const rawData = await prisma.peminjaman.findMany({
      where: whereClause,
      include: {
        murid: {
          include: {
            users: { select: { namaLengkap: true } },
          },
        },
        eksemplar: {
          include: {
            buku: { select: { judul: true, isbn: true } },
          },
        },
      },
      orderBy: { tanggal_pinjam: "desc" },
    });

    // 3. Format Data (Flattening)
    const formattedData = rawData.map((item) => ({
      id: item.id,
      kode_booking: item.kode_booking,
      nis: item.murid?.nis || "-",
      nama_murid: item.murid?.users?.namaLengkap || "User Terhapus",
      kelas: item.murid?.kelas || "-",
      kode_eksemplar: item.eksemplar?.kode_eksemplar || "-",
      judul: item.eksemplar?.buku?.judul || "Buku Terhapus",
      status_pinjam: item.status_pinjam,
      tanggal_pinjam: item.tanggal_pinjam,
      tanggal_kembali: item.tanggal_kembali,
      tanggal_actual: item.tanggal_actual,
      denda: item.denda ? parseFloat(item.denda) : 0,
      // 🔥 TAMBAHIN BARIS INI (PENTING) 🔥
      keterangan: item.keterangan,
    }));

    res.status(200).json({
      status: "success",
      data: formattedData,
    });
  } catch (error) {
    console.error("Error Get Laporan:", error);
    res.status(500).json({ message: "Gagal mengambil data laporan." });
  }
};
