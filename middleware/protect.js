// middleware/protect.js

const jwt = require("jsonwebtoken");

// Map role_id ke nama role
const roleMap = {
  3: "admin",
  4: "murid",
};

module.exports =
  (allowedRoles = []) =>
  (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Token tidak ditemukan." });
    }

    const token = authHeader.split(" ")[1];

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Convert role_id ke nama role string
      const userRole = roleMap[decoded.role_id];

      if (!userRole) {
        return res.status(401).json({ message: "Role tidak dikenal." });
      }

      // ① Jika allowedRoles kosong → semua role yang valid diizinkan
      // ② Jika allowedRoles berisi sesuatu → filter sesuai role
      if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
        return res.status(403).json({ message: "Akses ditolak." });
      }

      // Attach user info ke request
      req.user = {
        id: decoded.id,
        email: decoded.email,
        role: userRole,
      };

      next();
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({ message: "Token kadaluarsa." });
      }
      return res.status(401).json({ message: "Token tidak valid." });
    }
  };
