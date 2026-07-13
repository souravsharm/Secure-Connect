import express from 'express'
import bodyParser from "body-parser"
import dotenv from 'dotenv'
import gallagherCache from './utils/gallagherCache.js'
import { asyncHandler } from './utils/errorHandler.js'
import v1CacheRoutes from './routes/v1/cacheRoutes.js'
import v1CardholderRoutes from './routes/v1/cardholderRoutes.js'
import v1AuthRoutes from './routes/v1/authRoutes.js'
import path from 'path'
import { fileURLToPath } from 'url'
import logger, { correlationMiddleware, httpLogger, withCorrelation } from './utils/logger.js'

const app = express()
const port = process.env.PORT|| 3000

// Set up file paths
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, 'config', 'secrets.env') })

// Middlewares
app.use(express.static("public"))
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

// Simple CORS for browser-based API tester
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Correlation-Id')
  res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS')
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200)
  }
  next()
})

// Correlation + HTTP request logging
app.use(correlationMiddleware)
app.use(httpLogger)

// Root route
app.get("/", asyncHandler(async (req, res) => {
    const log = req?.log || withCorrelation(logger, req?.correlationId)
    log.info('Root route hit, ensuring Gallagher href cache')
    // Cache the basic hrefs
    await gallagherCache.cacheBasicHrefs()
    log.info('Root route success')
    res.status(200).json({
      message: `App running successfully`
    })
  }))

// Use versioned API routes
app.use('/api/v1/auth', v1AuthRoutes)
app.use('/api/v1', v1CacheRoutes)
app.use('/api/v1', v1CardholderRoutes)

// Error handling middleware
app.use((err, req, res, next) => {
  const status = err.status || err.response?.status || 500
  const log = req?.log || withCorrelation(logger, req?.correlationId)
  const origin = `${req.method} ${req.originalUrl}`
  const payload = {
    error: err,
    origin,
    status,
    upstream: err?.response?.data
  }
  if (status >= 500) {
    log.error('Unhandled 5xx error', payload)
    // Print concise error to console for visibility in dev
    // eslint-disable-next-line no-console
    console.error(`[${new Date().toISOString()}] 5xx ${origin}:`, err.message)
  } else if (status >= 400) {
    log.warn('Handled 4xx error', payload)
    // eslint-disable-next-line no-console
    console.error(`[${new Date().toISOString()}] 4xx ${origin}:`, err.message)
  } else {
    log.error('Unhandled error caught by error middleware', payload)
  }
  res.status(status).json({ message: err.message })
})

app.listen(port, () => {
  logger.info('Backend server started', { url: `http://localhost:${port}`, port })
})


