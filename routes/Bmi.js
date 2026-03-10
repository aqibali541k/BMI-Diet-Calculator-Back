const express = require("express");
const router = express.Router();
const BMI = require("../models/bmiSchema.js");
const verifyToken = require("../middlewares/verifyToken");

// Save BMI
router.post("/create", verifyToken, async (req, res) => {
    try {

        const { height, weight } = req.body;

        const heightInMeters = height / 100;

        const bmi = (weight / (heightInMeters * heightInMeters)).toFixed(2);

        let category = "";

        if (bmi < 18.5) category = "Underweight";
        else if (bmi < 25) category = "Normal Weight";
        else if (bmi < 30) category = "Overweight";
        else category = "Obese";

        const bmiEntry = new BMI({
            userId: req.user.id,
            height,
            weight,
            bmi,
            category,
        });

        await bmiEntry.save();

        res.json({
            message: "BMI calculated successfully",
            bmi,
            category,
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to calculate BMI" });
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