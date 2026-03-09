const express = require("express");
const router = express.Router();
const fs = require("fs");
const BMI = require("../models/bmiSchema"); // Consider BlogSchema
const { verifyToken, isAdmin } = require("../middleware/auth");
const cloudinary = require("../middlewares/cloudinary");
const multer = require("multer");

// Multer setup for temp storage
const upload = multer({ dest: "temp/" });

// Create a blog post (admin only)
router.post(
    "/create-blog",
    verifyToken,
    isAdmin,
    upload.single("image"),
    async (req, res) => {
        try {
            const { author, title, content } = req.body;

            if (!req.file) {
                return res.status(400).json({ message: "Image is required" });
            }

            // Upload to Cloudinary
            const result = await cloudinary.uploader.upload(req.file.path, {
                folder: "blogs",
                resource_type: "image",
            });

            // Remove temp file
            fs.unlinkSync(req.file.path);

            const blogEntry = new BMI({
                userId: req.user.id,
                author,
                title,
                content,
                image: result.secure_url,
                imagePublicId: result.public_id,
                date: new Date(),
            });

            await blogEntry.save();
            res.json({ message: "Blog saved successfully", blog: blogEntry });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: "Failed to save blog" });
        }
    }
);

// Get all blogs
router.get("/blogs", async (req, res) => {
    try {
        const blogs = await BMI.find().sort({ date: -1 });
        res.json(blogs);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch blogs" });
    }
});

// Delete a blog post (admin only)
router.delete(
    "/delete-blog/:id",
    verifyToken,
    isAdmin,
    async (req, res) => {
        try {
            const blog = await BMI.findById(req.params.id);
            if (!blog) {
                return res.status(404).json({ message: "Blog not found" });
            }
            await cloudinary.uploader.destroy(blog.imagePublicId);
            await blog.remove();
            res.json({ message: "Blog deleted successfully" });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: "Failed to delete blog" });
        }
    }
);

// Update a blog post (admin only)
router.put(
    "/update-blog/:id",
    verifyToken,
    isAdmin,
    upload.single("image"),
    async (req, res) => {
        try {
            const { author, title, content } = req.body;
            const blog = await BMI.findById(req.params.id);
            if (!blog) {
                return res.status(404).json({ message: "Blog not found" });
            }
            if (req.file) {
                await cloudinary.uploader.destroy(blog.imagePublicId);
                const result = await cloudinary.uploader.upload(req.file.path, {
                    folder: "blogs",
                    resource_type: "image",
                });
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
    }
);

module.exports = router;