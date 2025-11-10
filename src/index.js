// TEMPORARY: allow every origin
import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import authRouter from "./routers/authRouter.js"
import adminRouter from "./routers/adminRouter.js"
import emailRouter from "./routers/emailRouter.js"

dotenv.config()
const app = express()

app.use(cors())                // <— universal CORS
app.options("*", cors())       // <— universal preflight
app.use(express.json())

app.use((req, res, next) => {
  console.log("--- Incoming Request ---")
  console.log("Method:", req.method)
  console.log("URL:", req.originalUrl)
  console.log("Origin:", req.headers.origin)
  next()
})

app.use("/api/auth", authRouter)
app.use("/api/admin", adminRouter)
app.use("/api/admin", emailRouter)

const PORT = process.env.PORT || 3001
app.listen(PORT, "0.0.0.0", () => console.log(`Server running on ${PORT}`))
