const express = require("express")
const cors = require("cors")
const dotenv = require("dotenv")

const authRouter = require("./routers/authRouter")
const adminRouter = require("./routers/adminRouter")
const emailRouter = require("./routers/emailRouter")

dotenv.config()
const app = express()

// CORS setup — must be FIRST
const corsOptions = {
  origin: process.env.CORS_ORIGIN || "*",  // temporarily allow all if env missing
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204
}

app.use(cors(corsOptions))
app.use(express.json())

// Log every request (optional)
app.use((req, res, next) => {
  console.log("--- Incoming Request ---")
  console.log("Method:", req.method)
  console.log("URL:", req.originalUrl)
  console.log("Origin:", req.headers.origin)
  next()
})

app.get("/", (req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("OK");
});

// Routers after CORS
app.use("/api/auth", authRouter)
app.use("/api/admin", adminRouter)
app.use("/api/admin", emailRouter)

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => console.log(`Server running on ${PORT}`));
