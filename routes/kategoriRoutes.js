const express = require("express");
const router = express.Router();
const kategoriController = require("../controllers/kategoriController");
const protect = require("../middleware/protect");

router.get("/", kategoriController.getAll);

// hanya admin
router.post("/", protect(["admin"]), kategoriController.create);
router.put("/:id", protect(["admin"]), kategoriController.update);
router.delete("/:id", protect(["admin"]), kategoriController.delete);

module.exports = router;
