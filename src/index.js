const express = require("express")
const cors = require("cors")
const dotenv = require("dotenv")

const authRouter = require("./routers/authRouter")
const adminRouter = require("./routers/adminRouter")
const emailRouter = require("./routers/emailRouter")

dotenv.config()
const app = express()

// very top of index.js
const fs = require("fs");

function logToFile(msg) {
  fs.appendFileSync("/tmp/app.log", `[${new Date().toISOString()}] ${msg}\n`);
  console.log(msg);
}


process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("SIGTERM", () => {
  console.warn("⚠️ Received SIGTERM - process will be terminated soon.");
});

process.on("SIGINT", () => {
  console.warn("⚠️ Received SIGINT - process interrupted manually.");
});

process.on("exit", (code) => {
  console.log("⚙️ Process exiting with code:", code);
});

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
app.use("/api/auth",console.log('auth is being tried on'), authRouter)
app.use("/api/admin", adminRouter)
app.use("/api/admin", emailRouter)

setInterval(() => {
  console.log("💓 Heartbeat - server still alive", new Date().toISOString());
}, 5000);

process.on("SIGTERM", () => {
  console.warn("⚠️ Received SIGTERM - Railway orchestrator stopping this container.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => console.log(`Server running on ${PORT}`));
