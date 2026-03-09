const express = require("express");
const router = express.Router();
const BMI = require("../models/bmiSchema");
const { verifyToken, isAdmin } = require("../middleware/auth");

// Save BMI
router.post("/create", verifyToken, async (req, res) => {
    try {
        const { height, weight, bmi, category } = req.body;

        const bmiEntry = new BMI({
            userId: req.user.id,
            height,
            weight,
            bmi,
            category,
        });

        await bmiEntry.save();
        res.json({ message: "BMI saved successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to save BMI" });
    }
});

// Get BMI history
router.get("/history", verifyToken, async (req, res) => {
    try {
        const bmiHistory = await BMI.find({ userId: req.user.id }).sort({ date: -1 });
        res.json(bmiHistory);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch BMI history" });
    }
});

module.exports = router;