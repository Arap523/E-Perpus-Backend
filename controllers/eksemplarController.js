const prisma = require("../config/prisma");
const { kirimWA } = require("../utils/whatsapp");

// ======================================================
// GET ALL EKSEMPLAR
// ======================================================
exports.getAll = async (req, res) => {
  try {
    const { buku_id } = req.query;
    const whereCondition = {};
    if (buku_id) whereCondition.buku_id = parseInt(buku_id);

    const data = await prisma.eksemplar.findMany({
      where: whereCondition,
      include: {
        buku: { select: { judul: true, cover: true, isbn: true } },
      },
      orderBy: { kode_eksemplar: "asc" },
    });

    const formatted = data.map((item) => ({
      id: item.id,
      kode_eksemplar: item.kode_eksemplar,
      no_inventaris: item.no_inventaris,
      tinggi_buku: item.tinggi_buku,
      status: item.status,
      buku_id: item.buku_id,
      judul_buku: item.buku?.judul,
      cover_buku: item.buku?.cover,
      isbn: item.buku?.isbn,
      created_at: item.created_at,
      updated_at: item.updated_at,
    }));

    res.status(200).json({ status: "success", data: formatted });
  } catch (error) {
    console.error("Error getAll:", error);
    res.status(500).json({ message: error.message });
  }
};

// ======================================================
// GET DETAIL
// ======================================================
exports.getEksemplarDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await prisma.eksemplar.findUnique({
      where: { id: parseInt(id) },
      include: { buku: true },
    });
    if (!item)
      return res.status(404).json({ message: "Eksemplar tidak ditemukan" });
    res.status(200).json(item);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ======================================================
// CREATE
// ======================================================
exports.create = async (req, res) => {
  try {
    const { buku_id, kode_eksemplar, no_inventaris, tinggi_buku } = req.body;

    if (!buku_id || !kode_eksemplar) {
      return res
        .status(400)
        .json({ message: "ID Buku dan Kode Eksemplar wajib diisi." });
    }

    const exist = await prisma.eksemplar.findUnique({
      where: { kode_eksemplar: kode_eksemplar },
    });
    if (exist)
      return res.status(409).json({ message: "Kode Eksemplar sudah ada." });

    const newItem = await prisma.eksemplar.create({
      data: {
        buku_id: parseInt(buku_id),
        kode_eksemplar,
        no_inventaris: no_inventaris || null,
        tinggi_buku: tinggi_buku || null,
        status: "tersedia",
      },
    });

    res.status(201).json({
      status: "success",
      message: "Eksemplar berhasil ditambahkan!",
      data: newItem,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ======================================================
// 🔥 UPDATE STATUS (FIXED: Hapus Update Kolom Non-Existent) 🔥
// ======================================================
exports.updateStatus = async (req, res) => {
  const { id } = req.params;
  const { status: rawStatus, no_inventaris } = req.body;
  const io = req.io;

  const status = rawStatus ? rawStatus.toLowerCase() : null;
  console.log(`\n🚀 [DEBUG] Update Status Eksemplar ID: ${id}`);

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Ambil Data Lama
      const eksemplarLama = await tx.eksemplar.findUnique({
        where: { id: parseInt(id) },
        include: { buku: true },
      });

      if (!eksemplarLama) throw new Error("Eksemplar tidak ditemukan.");

      let loanUpdate = null;
      let dendaApplied = 0;
      let activeLoan = null;

      // 2. LOGIC HILANG/RUSAK
      if (status === "hilang" || status === "rusak") {
        activeLoan = await tx.peminjaman.findFirst({
          where: {
            eksemplar_id: eksemplarLama.id,
            status_pinjam: { in: ["dipinjam", "booking"] },
          },
          include: { murid: { include: { users: true } } },
        });

        if (activeLoan) {
          const hargaBuku = eksemplarLama.buku.harga;
          dendaApplied = hargaBuku ? parseFloat(hargaBuku) : 10000;

          await tx.peminjaman.update({
            where: { id: activeLoan.id },
            data: {
              status_pinjam: "selesai",
              denda: dendaApplied,
              tanggal_actual: new Date(),
              keterangan: `Denda menghilangkan buku / merusak buku `,
            },
          });
        }
      }

      // 3. Update Status Fisik Eksemplar
      const updatedEksemplar = await tx.eksemplar.update({
        where: { id: parseInt(id) },
        data: {
          status: status || eksemplarLama.status,
          no_inventaris:
            no_inventaris !== undefined
              ? no_inventaris
              : eksemplarLama.no_inventaris,
        },
      });

      // ============================================================
      // 4. 🔥 SELF-HEALING: HITUNG ULANG (FIXED)
      // ============================================================

      // A. Hitung Realita Total
      const realTotal = await tx.eksemplar.count({
        where: { buku_id: eksemplarLama.buku_id },
      });

      // B. Hitung Realita yg Rusak/Hilang
      const realRusakHilang = await tx.eksemplar.count({
        where: {
          buku_id: eksemplarLama.buku_id,
          status: { in: ["hilang", "rusak"] },
        },
      });

      // C. Update Master Buku
      // ⚠️ HAPUS dipinjam & dibooking dari sini karena gak ada di DB
      await tx.buku.update({
        where: { id: eksemplarLama.buku_id },
        data: {
          total_eksemplar: realTotal,
          non_tersedia_inventory: realRusakHilang,
        },
      });

      console.log(
        `   ✅ FIXED STOCK: Total=${realTotal}, Rusak=${realRusakHilang}`,
      );

      return { updatedEksemplar, activeLoan, dendaApplied };
    });

    // === NOTIFIKASI ===
    const { activeLoan, dendaApplied, updatedEksemplar } = result;

    if (activeLoan && (status === "hilang" || status === "rusak")) {
      const nomorHp = activeLoan.murid?.telepon;
      if (nomorHp) {
        const msg = `*PEMBERITAHUAN DENDA* ⚠️\n\nHalo ${activeLoan.murid.users.namaLengkap},\nBuku *"${updatedEksemplar.buku?.judul || "Perpustakaan"}"* dengan kode *${updatedEksemplar.kode_eksemplar}* telah dilaporkan *${status.toUpperCase()}*.\n\nAnda dikenakan denda penggantian sebesar: *Rp ${dendaApplied.toLocaleString("id-ID")}*.\nHarap segera membayar denda ke petugas perpustkaan.`;
        kirimWA(nomorHp, msg);
      }

      if (io && activeLoan.murid.user_id) {
        io.to(`user_${activeLoan.murid.user_id}`).emit("new_notification", {
          title: "Denda Buku",
          message: `Buku dilaporkan ${status}. Denda: Rp ${dendaApplied.toLocaleString("id-ID")}`,
        });
        io.emit("refresh_peminjaman_admin");
      }
    }

    res.status(200).json({
      message: "Status eksemplar berhasil diperbarui.",
      data: updatedEksemplar,
      info: activeLoan ? `Denda Rp ${dendaApplied} dibebankan.` : null,
    });
  } catch (error) {
    console.error("Error update:", error);
    res.status(500).json({ message: error.message });
  }
};

// ======================================================
// DELETE
// ======================================================
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.eksemplar.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existing)
      return res.status(404).json({ message: "Eksemplar tidak ditemukan." });

    if (["dipinjam", "booking"].includes(existing.status)) {
      return res
        .status(400)
        .json({ message: "Gagal hapus: Eksemplar sedang dipinjam/booking." });
    }

    await prisma.eksemplar.delete({ where: { id: parseInt(id) } });

    // Hitung ulang total setelah delete
    const currentTotal = await prisma.eksemplar.count({
      where: { buku_id: existing.buku_id },
    });

    await prisma.buku.update({
      where: { id: existing.buku_id },
      data: { total_eksemplar: currentTotal },
    });

    res.status(200).json({ message: "Eksemplar berhasil dihapus." });
  } catch (error) {
    if (error.code === "P2003") {
      return res
        .status(400)
        .json({ message: "Gagal hapus: Masih ada riwayat peminjaman." });
    }
    res.status(500).json({ message: error.message });
  }
};
