const prisma = require("../config/prisma");
const moment = require("moment");
const { kirimWA } = require("../utils/whatsapp");

const getWIBDate = () => {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }),
  );
};

/* ======================================================
   GET RIWAYAT PEMINJAMAN (KHUSUS MURID LOGIN)
====================================================== */
exports.getRiwayatMurid = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized." });

    const murid = await prisma.murid.findFirst({
      where: { user_id: userId },
      select: { id: true, nis: true },
    });

    if (!murid)
      return res.status(404).json({ message: "Data murid tidak ditemukan." });

    const riwayat = await prisma.peminjaman.findMany({
      where: { murid_id: murid.id },
      include: {
        eksemplar: {
          include: { buku: { select: { judul: true, cover: true } } },
        },
        murid: {
          include: { users: { select: { namaLengkap: true } } },
        },
      },
      orderBy: { id: "desc" },
    });

    const data = riwayat.map((item) => ({
      ...item,
      judul: item.eksemplar?.buku?.judul,
      cover: item.eksemplar?.buku?.cover,
      kode_eksemplar: item.eksemplar?.kode_eksemplar,
      nama_murid: item.murid?.users?.namaLengkap,
      nis: murid.nis,
    }));

    res.status(200).json({ status: "success", data });
  } catch (err) {
    res.status(500).json({ message: "Gagal mengambil riwayat." });
  }
};

/* ======================================================
   GET SEMUA PEMINJAMAN (ADMIN)
====================================================== */
exports.getAll = async (req, res) => {
  try {
    const peminjaman = await prisma.peminjaman.findMany({
      include: {
        murid: { include: { users: { select: { namaLengkap: true } } } },
        eksemplar: { include: { buku: { select: { judul: true } } } },
      },
      orderBy: { id: "desc" },
    });

    const data = peminjaman.map((p) => ({
      id: p.id,
      kode_booking: p.kode_booking,
      status_pinjam: p.status_pinjam,
      tanggal_pinjam: p.tanggal_pinjam,
      tanggal_kembali: p.tanggal_kembali,
      tanggal_actual: p.tanggal_actual,
      denda: p.denda,
      keterangan: p.keterangan,

      nis: p.murid?.nis,
      nama_murid: p.murid?.users?.namaLengkap,
      judul: p.eksemplar?.buku?.judul,
      kode_eksemplar: p.eksemplar?.kode_eksemplar,
    }));

    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ message: "Gagal mengambil data." });
  }
};

/* ======================================================
   CREATE PEMINJAMAN / BOOKING (FIXED: ADA JAM/WAKTU & FORMAT SERAGAM)
====================================================== */
exports.create = async (req, res) => {
  try {
    const userIdFromToken = req.user?.id;
    let { user_id, murid_id, buku_id, jumlah } = req.body;
    const qty = parseInt(jumlah) || 1;
    const io = req.io;

    let finalMuridId;

    // 1. Tentukan Murid ID
    if (murid_id) {
      finalMuridId = parseInt(murid_id);
    } else {
      const targetUserId = user_id || userIdFromToken;
      if (!targetUserId)
        return res.status(400).json({ message: "User ID wajib ada." });

      const muridData = await prisma.murid.findFirst({
        where: { user_id: parseInt(targetUserId) },
      });
      if (!muridData)
        return res.status(404).json({ message: "Murid tidak ditemukan." });
      finalMuridId = muridData.id;
    }

    // 2. Cek Limit
    const activeLoans = await prisma.peminjaman.count({
      where: {
        murid_id: finalMuridId,
        status_pinjam: { in: ["booking", "dipinjam"] },
      },
    });

    if (activeLoans + qty > 3) {
      return res.status(400).json({
        message: `Kuota habis! Murid ini punya ${activeLoans} buku aktif. Maksimal 3.`,
      });
    }

    // 3. Eksekusi Transaksi
    const isAdminInput = !!murid_id;
    const statusBaru = isAdminInput ? "dipinjam" : "booking";

    const result = await prisma.$transaction(async (tx) => {
      const murid = await tx.murid.findUnique({
        where: { id: finalMuridId },
        include: { users: true },
      });

      if (!murid || murid.status !== "aktif")
        throw new Error("Murid tidak aktif.");

      const eksemplars = await tx.eksemplar.findMany({
        where: { buku_id: parseInt(buku_id), status: "tersedia" },
        take: qty,
      });

      if (eksemplars.length < qty) throw new Error(`Stok tidak cukup.`);

      const now = getWIBDate();
      const returnDate = new Date(now);
      returnDate.setDate(returnDate.getDate() + 7);

      const createdRecords = [];

      for (const item of eksemplars) {
        await tx.eksemplar.update({
          where: { id: item.id },
          data: { status: statusBaru },
        });

        const kode = `BK${moment(now).format("YYYYMMDD")}-${item.id}-${Math.floor(
          1000 + Math.random() * 9000,
        )}`;

        const newRecord = await tx.peminjaman.create({
          data: {
            kode_booking: kode,
            murid_id: murid.id,
            eksemplar_id: item.id,
            status_pinjam: statusBaru,
            tanggal_pinjam: now,
            tanggal_kembali: returnDate,
            denda: 0,
          },
        });
        createdRecords.push(newRecord);
      }
      return { createdRecords, murid, returnDate, now }; // Bawa 'now' dan 'returnDate'
    });

    // 4. Kirim Notifikasi (WA & Socket)
    const buku = await prisma.buku.findUnique({
      where: { id: parseInt(buku_id) },
      select: { judul: true },
    });

    const listKode = result.createdRecords
      .map((b) => b.kode_booking)
      .join(", ");

    // 🔥 LOGIC DINAMIS: Teks & Waktu Lengkap (Ada Jam)
    const titleNotif = isAdminInput
      ? "PEMINJAMAN BERHASIL"
      : "BOOKING BERHASIL";
    let bodyNotif = isAdminInput
      ? `Buku telah berhasil dipinjam.`
      : `Booking berhasil! Silakan ambil buku di perpustakaan.`;

    // Kalau dipinjam, kasih info Tanggal & Waktu
    if (isAdminInput) {
      // 🔥 UPDATE DISINI: Tambah Format Jam HH:mm
      const tglPinjam = moment(result.now).format("DD MMM YYYY, HH:mm");
      const tglKembali = moment(result.returnDate).format("DD MMM YYYY, HH:mm");

      bodyNotif += `\n📅 Pinjam: *${tglPinjam} WIB*\n📅 Kembali: *${tglKembali} WIB*`;
    }

    // A. Kirim WA
    const nomorHp = result.murid?.telepon;
    if (nomorHp) {
      let pesanWA = `*E-PERPUS NOTIFICATION* 📚\n\nHalo ${result.murid.users.namaLengkap} 👋,\n${titleNotif} ✅\n\n📖 Buku: *${buku.judul}*\n💬 Info: ${bodyNotif}\n🎫 Kode: *${listKode}*`;
      kirimWA(nomorHp, pesanWA);
    }

    // B. Kirim Socket
    if (io) {
      io.emit("refresh_peminjaman_admin");
      if (result.murid && result.murid.user_id) {
        const targetRoom = `user_${result.murid.user_id}`;
        io.to(targetRoom).emit("new_notification", {
          title: titleNotif,
          message: `${bodyNotif} (Buku: ${buku.judul})`,
        });
      }
    }

    res.status(201).json({
      message: "Data berhasil disimpan.",
      data: result.createdRecords,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/* ======================================================
   UPDATE STATUS PEMINJAMAN (FIXED: FORMAT WA SERAGAM & JAM)
====================================================== */
exports.updateStatus = async (req, res) => {
  const { id } = req.params;
  let { status_pinjam, denda, tanggal_actual, keterangan } = req.body;
  const io = req.io;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Ambil Data
      const pinjam = await tx.peminjaman.findUnique({
        where: { id: parseInt(id) },
        include: {
          murid: { include: { users: true } },
          eksemplar: {
            include: { buku: { select: { judul: true, harga: true } } },
          }, // Include harga juga
        },
      });

      if (!pinjam) throw new Error("Data tidak ditemukan.");

      // 2. Logic Tanggal
      const sekarangWIB = getWIBDate();
      let tanggalFinal;

      if (tanggal_actual) {
        const [year, month, day] = tanggal_actual.split("-");
        tanggalFinal = new Date(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day),
          sekarangWIB.getHours(),
          sekarangWIB.getMinutes(),
          sekarangWIB.getSeconds(),
        );
      } else if (status_pinjam === "selesai" || status_pinjam === "hilang") {
        tanggalFinal = sekarangWIB;
      } else {
        tanggalFinal = pinjam.tanggal_actual;
      }

      // 3. Logic Hilang/Denda
      let isBukuHilang = false;
      let finalDenda = denda ? parseFloat(denda) : 0;
      let finalStatusPinjam = status_pinjam;
      let finalKeterangan = keterangan || null;

      if (status_pinjam === "hilang") {
        isBukuHilang = true;
        finalStatusPinjam = "selesai";
        const hargaBuku = pinjam.eksemplar.buku.harga;
        finalDenda = hargaBuku ? parseFloat(hargaBuku) : 10000;
        if (!finalKeterangan) finalKeterangan = "Buku dinyatakan HILANG.";
      }

      // 4. Update Peminjaman
      let updateData = {
        status_pinjam: finalStatusPinjam,
        denda: finalDenda,
        tanggal_actual: tanggalFinal,
        keterangan: finalKeterangan,
      };

      if (status_pinjam === "dipinjam") {
        const now = getWIBDate();
        const backDate = new Date(now);
        backDate.setDate(backDate.getDate() + 7);
        updateData.tanggal_pinjam = now;
        updateData.tanggal_kembali = backDate;
      }

      const updatedRecord = await tx.peminjaman.update({
        where: { id: parseInt(id) },
        data: updateData,
      });

      // 5. Update Eksemplar & Inventory
      let eksStatus = "tersedia";
      if (status_pinjam === "dipinjam") eksStatus = "dipinjam";
      else if (status_pinjam === "booking") eksStatus = "booking";
      else if (status_pinjam === "batal") eksStatus = "tersedia";
      else if (status_pinjam === "selesai" || status_pinjam === "hilang") {
        eksStatus = isBukuHilang ? "hilang" : "tersedia";
      }

      await tx.eksemplar.update({
        where: { id: pinjam.eksemplar_id },
        data: { status: eksStatus },
      });

      if (isBukuHilang) {
        await tx.buku.update({
          where: { id: pinjam.eksemplar.buku_id },
          data: { non_tersedia_inventory: { increment: 1 } },
        });
      }

      return { pinjam, updatedRecord, isBukuHilang };
    });

    // === KIRIM NOTIFIKASI ===
    const { pinjam, updatedRecord, isBukuHilang } = result;
    const nomorHp = pinjam.murid?.telepon;

    if (nomorHp) {
      let pesanWA = "";

      // 🔥 UPDATE DI SINI: Format Ada Jam HH:mm
      if (status_pinjam === "dipinjam") {
        const tglPinjam = moment(updatedRecord.tanggal_pinjam).format(
          "DD MMM YYYY, HH:mm",
        );
        const tglKembali = moment(updatedRecord.tanggal_kembali).format(
          "DD MMM YYYY, HH:mm",
        );

        pesanWA = `*E-PERPUS NOTIFICATION* 📚\n\nHalo ${pinjam.murid.users.namaLengkap} 👋,\nPEMINJAMAN BERHASIL ✅\n\n📖 Buku: *${pinjam.eksemplar.buku.judul}*\n💬 Info: Buku telah resmi dipinjam.\n📅 Pinjam: *${tglPinjam} WIB*\n📅 Kembali: *${tglKembali} WIB*`;
      } else if (status_pinjam === "selesai") {
        // Kalau selesai, kasih info jam kembali juga
        const tglSelesai = moment(updatedRecord.tanggal_actual).format(
          "DD MMM YYYY, HH:mm",
        );
        pesanWA = `*E-PERPUS NOTIFICATION* 📚\n\nHalo ${pinjam.murid.users.namaLengkap} 👋,\nPENGEMBALIAN SUKSES ✅\n\n📖 Buku: *${pinjam.eksemplar.buku.judul}*\n⏰ Waktu Kembali: ${tglSelesai} WIB\n💬 Info: Terima kasih telah mengembalikan buku.`;
      } else if (isBukuHilang) {
        pesanWA = `*E-PERPUS NOTIFICATION* ⚠️\n\nHalo ${pinjam.murid.users.namaLengkap},\nDENDA BUKU HILANG ❌\n\n📖 Buku: *${pinjam.eksemplar.buku.judul}*\n💰 Denda: Rp ${updatedRecord.denda.toLocaleString("id-ID")}\n💬 Info: Buku dinyatakan hilang. Harap selesaikan administrasi.`;
      }

      if (pesanWA) kirimWA(nomorHp, pesanWA);
    }

    if (io) {
      io.emit("refresh_peminjaman_admin");
      if (pinjam.murid && pinjam.murid.user_id) {
        const targetRoom = `user_${pinjam.murid.user_id}`;
        let message = `Status buku berubah jadi ${status_pinjam}.`;
        if (isBukuHilang)
          message = `Buku dinyatakan hilang. Denda: Rp ${updatedRecord.denda.toLocaleString("id-ID")}`;
        io.to(targetRoom).emit("new_notification", {
          title: "Status Update",
          message: message,
        });
      }
    }

    res.json({ message: "Data berhasil diperbarui." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

/* ======================================================
   DELETE PEMINJAMAN
====================================================== */
exports.delete = async (req, res) => {
  const { id } = req.params;
  const io = req.io;

  try {
    let deletedData = null;

    await prisma.$transaction(async (tx) => {
      const pinjam = await tx.peminjaman.findUnique({
        where: { id: parseInt(id) },
        include: {
          murid: true,
          eksemplar: { include: { buku: true } },
        },
      });

      if (!pinjam) throw new Error("Data tidak ditemukan.");
      deletedData = pinjam;

      await tx.eksemplar.update({
        where: { id: pinjam.eksemplar_id },
        data: { status: "tersedia" },
      });

      await tx.peminjaman.delete({ where: { id: parseInt(id) } });
    });

    if (io && deletedData) {
      io.emit("refresh_peminjaman_admin");
      if (deletedData.murid && deletedData.murid.user_id) {
        const targetRoom = `user_${deletedData.murid.user_id}`;
        io.to(targetRoom).emit("new_notification", {
          title: "Peminjaman Dihapus",
          message: `Data peminjaman buku "${deletedData.eksemplar?.buku?.judul}" telah dihapus oleh admin.`,
        });
      }
    }

    res.json({ message: "Data dihapus." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

/* ======================================================
   CHART STATS
====================================================== */
exports.getChartPeminjaman = async (req, res) => {
  try {
    const year = req.query.year
      ? parseInt(req.query.year)
      : new Date().getFullYear();
    const result =
      await prisma.$queryRaw`SELECT MONTH(tanggal_pinjam) as bulan, COUNT(id) as total FROM peminjaman WHERE YEAR(tanggal_pinjam) = ${year} GROUP BY MONTH(tanggal_pinjam) ORDER BY bulan ASC`;
    const values = new Array(12).fill(0);
    result.forEach((row) => {
      values[Number(row.bulan) - 1] = Number(row.total);
    });
    res.status(200).json({ status: "success", data: { year, values } });
  } catch (err) {
    res.status(500).json({ message: "Gagal mengambil statistik." });
  }
};
