const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;

  // Tidak ada token → user guest → boleh lanjut
  if (!authHeader) return next();

  // Ada token → user sudah login → blokir
  return res.status(403).json({
    message: "Halaman ini hanya untuk pengguna yang belum login.",
  });
};
