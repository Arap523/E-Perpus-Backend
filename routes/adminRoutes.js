// routes/adminRoutes.js
const express = require("express");
const router = express.Router();

const adminController = require("../controllers/adminController");
const protect = require("../middleware/protect"); // ⬅ default import

router.get("/", protect(["admin"]), adminController.getAll);
// SETELAH ADMIN PERTAMA JADI
router.post("/", protect(["admin"]), adminController.create);
router.put("/:id", protect(["admin"]), adminController.update);
router.delete("/:id", protect(["admin"]), adminController.delete);
router.put(
  "/change-password/:id",
  protect(["admin"]),
  adminController.changePassword
);

module.exports = router;
