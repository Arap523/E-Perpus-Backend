const express = require("express");
const router = express.Router();
const guestOnly = require("../../middleware/guestOnly");
const protect = require("../../middleware/protect");
const authController = require("../../controllers/Auth/authController");

router.post("/login", guestOnly, authController.login);

router.post("/register/murid", guestOnly, authController.registerMurid);

// hanya admin yang sudah login yang boleh membuat admin baru
router.post(
  "/register/admin",
  protect(["admin"]),
  authController.registerAdmin
);

module.exports = router;
