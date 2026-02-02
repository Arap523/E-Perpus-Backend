const cron = require("node-cron");
const prisma = require("../config/prisma");
const moment = require("moment");
const { kirimWA } = require("../utils/whatsapp");

cron.schedule("*/1 * * * *", async () => {
  console.log("⏰ [SCHEDULER] Checking Loans, Booking, & Reminders...");

  try {
    const now = moment();

    // Ambil data yang statusnya 'booking' atau 'dipinjam'
    const activeRecords = await prisma.peminjaman.findMany({
      where: {
        status_pinjam: { in: ["dipinjam", "booking"] },
      },
      include: {
        murid: { include: { users: true } },
        eksemplar: { include: { buku: true } },
      },
    });

    for (const record of activeRecords) {
      const startTime = moment(record.created_at);
      const durasiMenit = now.diff(startTime, "minutes");

      // === LOGIKA A: EXPIRED BOOKING (30 MENIT) ===
      if (record.status_pinjam === "booking") {
        // ... (Kode Booking kamu tetap sama di sini) ...
        // Warning 20 menit
        if (durasiMenit >= 20 && durasiMenit < 21) {
          const nomorHp = record.murid?.telepon;
          if (nomorHp) {
            const pesanWarning = `*PERINGATAN BOOKING* ⏳\n\nHalo ${record.murid.users.namaLengkap},\nWaktu booking buku *"${record.eksemplar.buku.judul}"* tinggal 10 menit lagi!\n\n🎫 Kode Booking: *${record.kode_booking}*\nSegera tunjukkan kode di atas ke petugas.\n\n.`;
            kirimWA(nomorHp, pesanWarning);
          }
        }

        // Batal 30 menit
        if (durasiMenit >= 30) {
          // ... logic update db batal ...
          await prisma.$transaction(async (tx) => {
            await tx.peminjaman.update({
              where: { id: record.id },
              data: { status_pinjam: "batal" },
            });
            await tx.eksemplar.update({
              where: { id: record.eksemplar_id },
              data: { status: "tersedia" },
            });
          });
          console.log(`❌ Booking Expired: ${record.kode_booking}`);
          // ... logic kirim WA batal ...
        }
      }

      // === LOGIKA KHUSUS PEMINJAMAN (H-1 & DENDA) ===
      if (record.status_pinjam === "dipinjam") {
        const deadline = moment(record.tanggal_kembali);

        // --- BARU: LOGIKA H-1 REMINDER ---
        // Cek apakah deadline adalah BESOK
        const besok = moment().add(1, "days").startOf("day");
        const tglDeadline = deadline.clone().startOf("day");

        // Jika tanggal deadline == besok
        if (besok.isSame(tglDeadline)) {
          if (now.hour() === 8 && now.minute() === 0) {
            const nomorHp = record.murid?.telepon;
            if (nomorHp) {
              const formattedDeadline = deadline.format(
                "DD-MM-YYYY [pukul] HH:mm",
              );
              const pesanReminder =
                `*REMINDER PENGEMBALIAN* ⏰\n\n` +
                `Halo ${record.murid.users.namaLengkap},\n` +
                `Jangan lupa, batas waktu pengembalian buku *"${record.eksemplar.buku.judul}"* adalah *BESOK* (${formattedDeadline}).\n\n` +
                `Mohon kembalikan tepat waktu untuk menghindari denda.` +
                `\n\n.`;

              kirimWA(nomorHp, pesanReminder);
              console.log(
                `✅ Reminder H-1 sent to ${record.murid.users.namaLengkap}`,
              );
            }
          }
        }

        // === LOGIKA B: DENDA PER MINGGU (Existing) ===
        if (now.isAfter(deadline)) {
          // ... (Kode Denda kamu tetap sama di sini) ...
          const hariTerlambat = now.diff(deadline, "days");
          const jumlahMinggu = Math.floor(hariTerlambat / 7) + 1;
          const dendaPerMinggu = 10000;
          const totalDenda = jumlahMinggu * dendaPerMinggu;

          if (Number(record.denda) !== totalDenda) {
            await prisma.peminjaman.update({
              where: { id: record.id },
              data: { denda: totalDenda },
            });
            console.log(`💸 Denda Updated: Rp ${totalDenda}`);

            const nomorHp = record.murid?.telepon;
            if (nomorHp) {
              const pesanDenda = `*PERINGATAN DENDA* ⚠️\n\nHalo ${record.murid.users.namaLengkap},\nBuku *"${record.eksemplar.buku.judul}"* sudah melewati batas waktu.\n\n💰 Total Denda: *Rp ${totalDenda.toLocaleString("id-ID")}*\n\nMohon segera kembalikan buku.\n\n.`;
              kirimWA(nomorHp, pesanDenda);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error("❌ Error in scheduler:", error);
  }
});
