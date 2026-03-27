const express = require("express");
const router = express.Router();
const fs = require("fs");
const BMI = require("../models/blogSchema"); // BlogSchema
const verifyToken = require("../middlewares/verifyToken");
const cloudinary = require("../middlewares/cloudinary");
const multer = require("multer");
const { ADMIN_EMAIL } = process.env;

const upload = multer({ storage: multer.memoryStorage() });

// Admin check middleware
const ADMIN_EMAILS = process.env.ADMIN_EMAIL.split(",");

const isAdmin = (req, res, next) => {
    if (!ADMIN_EMAILS.includes(req.user.email)) {
        return res.status(403).json({ message: "Admin access only" });
    }
    next();
};

router.post(
    "/create-blogs",
    verifyToken,   // <-- attaches req.user
    isAdmin,
    upload.single("image"),
    async (req, res) => {
        try {
            const { author, title, content } = req.body;

            const blogEntry = new BMI({
                author,
                title,
                content,
                userId: req.user._id   // <-- required
            });

            if (req.file) {
                const fileStr = req.file.buffer.toString("base64");
                const result = await cloudinary.uploader.upload(
                    `data:${req.file.mimetype};base64,${fileStr}`,
                    { folder: "blogs" }
                );

                blogEntry.image = result.secure_url;
                blogEntry.imagePublicId = result.public_id;
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
router.put(
    "/update-blog/:id",
    verifyToken,
    isAdmin,
    upload.single("image"),
    async (req, res) => {
        try {
            const { author, title, content } = req.body;
            const blog = await BMI.findById(req.params.id);

            if (!blog) return res.status(404).json({ message: "Blog not found" });

            // Update image if new file uploaded
            if (req.file) {
                // Delete previous image if exists
                if (blog.imagePublicId) {
                    await cloudinary.uploader.destroy(blog.imagePublicId);
                }

                // Upload new image from buffer
                const result = await new Promise((resolve, reject) => {
                    cloudinary.uploader
                        .upload_stream({ folder: "blogs" }, (err, result) =>
                            err ? reject(err) : resolve(result)
                        )
                        .end(req.file.buffer);
                });

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