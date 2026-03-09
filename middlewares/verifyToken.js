const jwt = require("jsonwebtoken");
require("dotenv").config();

const JWT_KEY = process.env.JWT_KEY;

if (!JWT_KEY) {
  console.error("JWT_KEY missing in .env");
  process.exit(1);
}

const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "No token provided",
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, JWT_KEY);

    req.user = decoded;

    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

module.exports = verifyToken;