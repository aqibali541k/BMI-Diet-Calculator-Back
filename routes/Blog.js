const express = require("express");
const router = express.Router();
const fs = require("fs");
const BMI = require("../models/blogSchema"); // BlogSchema
const verifyToken = require("../middlewares/verifyToken");
const cloudinary = require("../middlewares/cloudinary");
const multer = require("multer");
const { ADMIN_EMAIL } = process.env;

const upload = multer({ dest: "uploads/" });

// Admin check middleware
const isAdmin = (req, res, next) => {
    if (req.user.email !== ADMIN_EMAIL) {
        return res.status(403).json({ message: "Admin access only" });
    }
    next();
};

// ------------------ CREATE BLOG ------------------
router.post(
    "/create-blogs",
    verifyToken,
    isAdmin,
    upload.single("image"),
    async (req, res) => {
        try {
            const { author, title, content } = req.body;

            if (req.file) {
                await cloudinary.uploader.destroy(blog.imagePublicId);

                const fileStr = req.file.buffer.toString("base64");
                const result = await cloudinary.uploader.upload(
                    `data:${req.file.mimetype};base64,${fileStr}`,
                    { folder: "blogs" }
                );

                blog.image = result.secure_url;
                blog.imagePublicId = result.public_id;
            }

            await blogEntry.save();
            res.json({ message: "Blog saved successfully", blog: blogEntry });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: "Failed to save blog" });
        }
    }
);

// ------------------ GET ALL BLOGS ------------------
router.get("/all-blogs", async (req, res) => {
    try {
        const blogs = await BMI.find().sort({ date: -1 });
        res.json(blogs);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch blogs" });
    }
});

// ------------------ GET SINGLE BLOG ------------------
router.get("/single-blog/:id", verifyToken, async (req, res) => {
    try {
        const blog = await BMI.findById(req.params.id);
        if (!blog) return res.status(404).json({ message: "Blog not found" });
        res.json(blog);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch blog" });
    }
});

// ------------------ DELETE BLOG ------------------
router.delete("/delete-blog/:id", verifyToken, isAdmin, async (req, res) => {
    try {
        const blog = await BMI.findById(req.params.id);
        if (!blog) return res.status(404).json({ message: "Blog not found" });

        await cloudinary.uploader.destroy(blog.imagePublicId);
        await BMI.findByIdAndDelete(req.params.id);

        res.json({ message: "Blog deleted successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to delete blog" });
    }
});

// ------------------ UPDATE BLOG ------------------
router.put("/update-blog/:id", verifyToken, isAdmin, upload.single("image"), async (req, res) => {
    try {
        const { author, title, content } = req.body;
        const blog = await BMI.findById(req.params.id);

        if (!blog) return res.status(404).json({ message: "Blog not found" });

        // Update image if new file uploaded
        if (req.file) {
            await cloudinary.uploader.destroy(blog.imagePublicId);
            const result = await cloudinary.uploader.upload(req.file.path, { folder: "blogs" });
            fs.unlinkSync(req.file.path);
            blog.image = result.secure_url;
            blog.imagePublicId = result.public_id;
        }

        blog.author = author;
        blog.title = title;
        blog.content = content;

        await blog.save();
        res.json({ message: "Blog updated successfully", blog });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to update blog" });
    }
});

module.exports = router;