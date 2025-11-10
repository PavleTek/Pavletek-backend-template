const express = require("express");
const prisma = require("./lib/prisma");
const dotenv = require("dotenv");
const cors = require("cors");
const authRouter = require("./routers/authRouter");
const adminRouter = require("./routers/adminRouter");
const emailRouter = require("./routers/emailRouter");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : true

const corsOptions = {
  origin: function (origin, callback) {
    console.log('Request origin:', origin)
    console.log('Allowed origins:', allowedOrigins)

    // Allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin) return callback(null, true)

    if (allowedOrigins === true || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error(`CORS blocked for origin: ${origin}`))
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
}

app.use(cors(corsOptions));
app.use(express.json());

// Routes
app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/admin", emailRouter);

app.listen(PORT, () => {
  console.log(PORT);
  console.log(process.env.DATABASE_URL);
  console.log(`Server running on http://localhost:${PORT}`);
});
