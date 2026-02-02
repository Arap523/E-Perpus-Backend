const express = require("express");
const router = express.Router();
const adminNotifController = require("../controllers/adminNotifikasiController");

// Path: /api/notifikasi/admin
router.get("/:user_id", adminNotifController.getByUser);
router.put("/read/:id", adminNotifController.markRead);
router.put("/read-all", adminNotifController.markAllRead);
router.delete("/:id", adminNotifController.deleteNotif); // <--- PASTIKAN BARIS INI ADA!

module.exports = router;
