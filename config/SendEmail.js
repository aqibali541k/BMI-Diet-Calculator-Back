const nodemailer = require("nodemailer");

const sendEmail = async (email, subject, message) => {
    const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",   // ✅ correct
        port: 465,
        secure: true,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject,
        text: message,
    };

    await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;