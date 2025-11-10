import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import authRouter from "./routers/authRouter.js"
import adminRouter from "./routers/adminRouter.js"
import emailRouter from "./routers/emailRouter.js"

dotenv.config()

const app = express()

// build allowed origins from env
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim().replace(/\/$/, ""))
  : true

const corsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true)
    const cleanOrigin = origin.replace(/\/$/, "")
    const match =
      allowedOrigins === true || allowedOrigins.includes(cleanOrigin)
    return match ? cb(null, true) : cb(new Error(`CORS blocked for ${origin}`))
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204
}

app.use(cors(corsOptions))
app.options("*", cors(corsOptions))
app.use(express.json())

// Log every request (put BEFORE your routers)
app.use((req, res, next) => {
  console.log("--- Incoming Request ---")
  console.log("Method:", req.method)
  console.log("URL:", req.originalUrl)
  console.log("Origin:", req.headers.origin)
  console.log("Headers:", req.headers)
  console.log("-------------------------")
  next()
})

// Routes after logging
app.use("/api/auth", authRouter)
app.use("/api/admin", adminRouter)
app.use("/api/admin", emailRouter)

const PORT = process.env.PORT || 3001
app.listen(PORT, "0.0.0.0", () => console.log(`Server running on ${PORT}`))
