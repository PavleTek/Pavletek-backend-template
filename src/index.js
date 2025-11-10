const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')
dotenv.config()

const app = express()

// CORS FIRST
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : true

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no Origin (curl, mobile apps)
    if (!origin) return callback(null, true)

    // Normalize trailing slashes
    const cleanOrigin = origin.replace(/\/$/, '')
    const allowed = Array.isArray(allowedOrigins)
      ? allowedOrigins.map((o) => o.replace(/\/$/, ''))
      : allowedOrigins

    if (allowed === true || allowed.includes(cleanOrigin)) {
      callback(null, true)
    } else {
      console.log('Blocked CORS request from:', origin)
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
}

app.use(cors(corsOptions))
app.use(express.json())

// ROUTES COME *AFTER* CORS
app.use('/api/auth', require('./routers/authRouter'))
app.use('/api/admin', require('./routers/adminRouter'))
app.use('/api/admin', require('./routers/emailRouter'))

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
