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

const corsOptions = {
  origin: process.env.CORS_ORIGIN || (process.env.NODE_ENV === 'production' ? false : true), // Allow all origins in dev, specific in prod
  credentials: true,
  optionsSuccessStatus: 200,
};

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
