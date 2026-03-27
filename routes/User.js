const express = require("express");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const User = require("../models/userSchema");
const verifyToken = require("../middlewares/verifyToken");
const cloudinary = require("../middlewares/cloudinary");
const crypto = require("crypto");
const sendEmail = require("../config/SendEmail");
const { OAuth2Client } = require("google-auth-library");

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const ADMIN_EMAIL = process.env.ADMIN_EMAIL
  .split(",")          // split comma separated
  .map(email => email.trim().toLowerCase());  // remove spaces and make lowercase
const isAdmin = (req, res, next) => {
  if (!ADMIN_EMAIL.includes(req.user.email.toLowerCase())) {
    return res.status(403).json({ message: "Admin access only" });
  }
  next();
};
/* ================= REGISTER ================= */
router.post("/register", upload.single("image"), async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const emailExists = await User.findOne({ email });
    if (emailExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Register
    let role = "user";
    if (ADMIN_EMAIL.includes(email.toLowerCase())) role = "admin";
    let image = "";
    let imagePublicId = "";

    if (req.file) {
      try {
        // Convert file buffer to base64 and upload to Cloudinary
        const fileStr = req.file.buffer.toString("base64");
        const uploadResult = await cloudinary.uploader.upload(
          `data:${req.file.mimetype};base64,${fileStr}`,
          { folder: "users" }
        );
        image = uploadResult.secure_url;
        imagePublicId = uploadResult.public_id;
      } catch (err) {
        console.error("Cloudinary upload failed:", err);
        return res.status(500).json({ message: "Image upload failed" });
      }
    }

    const user = await User.create({
      name,
      email,
      password, // hash handled in schema
      role,
      image,
      imagePublicId,
    });

    const token = jwt.sign(
      { id: user._id, role: user.role, email: user.email },
      process.env.JWT_KEY,
      { expiresIn: "7d" }
    );

    user.password = undefined;

    res.status(201).json({
      message: "User registered successfully",
      token,
      user,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Registration failed" });
  }
  // console.log("Assigned role:", role); // should print 'admin'
});
/* ================= LOGIN ================= */

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role, email: user.email },
      process.env.JWT_KEY,
      { expiresIn: "7d" }
    );

    user.password = undefined;

    res.json({
      message: "Login successful",
      token,
      user,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Login failed" });
  }
});
/* ================= GOOGLE LOGIN ================= */

router.post("/google", async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: "Token is required" });
    }

    // 🔐 Verify Google Token
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    const { email, name, picture } = payload;

    if (!email) {
      return res.status(400).json({ message: "Invalid Google account" });
    }

    // 🔍 Check existing user
    let user = await User.findOne({ email });

    // 🆕 Create user if not exists
    if (!user) {

      // Google login
      let role = "user";
      if (ADMIN_EMAIL.includes(email.toLowerCase())) role = "admin";
      user = await User.create({
        name,
        email,
        password: Math.random().toString(36).slice(-8), // dummy password
        role,
        image: picture,
      });
    }

    // 🔑 Generate JWT
    const authToken = jwt.sign(
      { id: user._id, role: user.role, email: user.email },
      process.env.JWT_KEY,
      { expiresIn: "7d" }
    );

    user.password = undefined;

    res.json({
      message: "Google login successful",
      token: authToken,
      user,
    });

  } catch (error) {
    console.error("Google Auth Error:", error);
    res.status(500).json({ message: "Google authentication failed" });
  }
});


/* ================= PROFILE ================= */

router.get("/profile", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ================= UPDATE PROFILE ================= */

router.put(
  "/update",
  verifyToken,
  upload.single("image"),
  async (req, res) => {
    try {
      const user = await User.findById(req.user.id);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (req.body.name) {
        user.name = req.body.name;
      }

      if (req.file) {
        if (user.imagePublicId) {
          await cloudinary.uploader.destroy(user.imagePublicId);
        }

        const uploadResult = await new Promise((resolve, reject) => {
          cloudinary.uploader
            .upload_stream({ folder: "users" }, (err, result) =>
              err ? reject(err) : resolve(result)
            )
            .end(req.file.buffer);
        });

        user.image = uploadResult.secure_url;
        user.imagePublicId = uploadResult.public_id;
      }

      await user.save();

      user.password = undefined;

      res.json({
        message: "Profile updated successfully",
        user,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Profile update failed" });
    }
  }
);

/* ================= ALL USERS (ADMIN) ================= */

router.get("/all", verifyToken, isAdmin, async (req, res) => {
  try {
    const users = await User.find().select("-password");

    res.json({ users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});
router.delete("/delete-user/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete user" });
  }
});
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 🔑 Token generate
    const resetToken = crypto.randomBytes(32).toString("hex");

    // 🔒 Hash token
    user.resetPasswordToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // ⏳ Expiry (15 min)
    user.resetPasswordExpire = Date.now() + 15 * 60 * 1000;

    await user.save();

    const resetUrl = `http://localhost:5173/auth/new-password/${resetToken}`;

    // ✅ EMAIL SEND
    await sendEmail(
      user.email,
      "Password Reset Request",
      `Click this link to reset your password:\n\n${resetUrl}\n\nThis link will expire in 15 minutes.`
    );

    res.json({
      message: "Reset link sent to your email",
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to send reset link" });
  }
});

router.post("/reset-password/:token", async (req, res) => {
  try {
    const { password } = req.body;

    const hashedToken = crypto
      .createHash("sha256")
      .update(req.params.token)
      .digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    res.json({ message: "Password reset successfully" });

  } catch (err) {
    res.status(500).json({ message: "Error resetting password" });
  }
});
module.exports = router;