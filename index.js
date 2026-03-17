const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const authRouter = require("./routes/User");
const bmiRouter = require("./routes/Bmi");
const blogRouter = require("./routes/Blog");

const { MONGO_URL, PORT } = process.env;

// Middlewares
app.use(cors());
app.use(express.json());
const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]); // Google DNS
// MongoDB connection
mongoose.connect(MONGO_URL)
  .then(() => {
    console.log("MongoDB has been connected successfully");
  })
  .catch((error) => {
    console.error("Something went wrong while connecting MongoDB", error);
  });

// Routes
app.use("/users", authRouter);
app.use("/bmi", bmiRouter);
app.use("/blogs", blogRouter);

// Server start
app.listen(PORT, () => {
  console.log("Server is running perfectly on PORT:", PORT);
});
// const express = require("express");
// const mongoose = require("mongoose");
// const cors = require("cors");
// const dotenv = require("dotenv");

// dotenv.config(); // ✅ VERY IMPORTANT

// const app = express();

// /* ---------- MIDDLEWARE ---------- */
// app.use(express.json());

// app.use(
//   cors({
//     origin: "*", // abhi ok, frontend URL baad me restrict kar sakta hai
//   }),
// );

// /* ---------- ROUTES ---------- */
// // ⚠️ Vercel ke liye path correct
// const authRouter = require("./routes/User");
// const notesRouter = require("./routes/Notes");

// /* ---------- MONGODB CONNECTION (CACHED) ---------- */
// let cached = global.mongoose;

// if (!cached) {
//   cached = global.mongoose = { conn: null, promise: null };
// }

// async function connectDB() {
//   if (cached.conn) return cached.conn;

//   if (!cached.promise) {
//     cached.promise = mongoose
//       .connect(process.env.MONGO_URL)
//       .then((mongoose) => mongoose);
//   }

//   cached.conn = await cached.promise;
//   console.log("✅ MongoDB connected");
//   return cached.conn;
// }

// // connect on first request
// connectDB();

// /* ---------- ROUTES ---------- */
// app.use("/users", authRouter);
// app.use("/notes", notesRouter);

// app.get("/", (req, res) => {
//   res.send("🚀 Server is online");
// });

// /* ---------- EXPORT (NO app.listen) ---------- */
// module.exports = app;
