const express = require("express");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const User = require("../models/userSchema");
const verifyToken = require("../middlewares/verifyToken");
const cloudinary = require("../middlewares/cloudinary");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
/* ================= ADMIN MIDDLEWARE ================= */

const isAdmin = (req, res, next) => {

  if (req.user.email !== ADMIN_EMAIL) {
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

    let role = "user";
    if (email === ADMIN_EMAIL) role = "admin";

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

module.exports = router;