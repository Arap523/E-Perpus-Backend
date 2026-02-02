const axios = require("axios");
require("dotenv").config();

const kirimWA = async (nomor, pesan) => {
  try {
    const token = process.env.FONNTE_TOKEN;

    if (!token) {
      console.log("❌ TOKEN BELUM DIISI DI .ENV!");
      return false;
    }

    const response = await axios.post(
      "https://api.fonnte.com/send",
      {
        target: nomor,
        message: pesan,
        countryCode: "62", // Otomatis ubah 08 jadi 62
      },
      {
        headers: {
          Authorization: token,
        },
      }
    );

    console.log(`✅ WA Terkirim ke ${nomor}`);
    return response.data;
  } catch (error) {
    console.error("❌ Gagal kirim WA:", error.message);
    return null;
  }
};

module.exports = { kirimWA };
