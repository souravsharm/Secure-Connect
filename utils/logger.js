import fs from 'fs';
import path from 'path';
import { createLogger, format, transports } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { v4 as uuidv4 } from 'uuid';

// Ensure logs directory exists
const logsDir = path.resolve('logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Redaction helpers
function maskCardNumber(cardNumber) {
  if (!cardNumber || typeof cardNumber !== 'string') return cardNumber;
  const last4 = cardNumber.slice(-4);
  return `**** **** **** ${last4}`;
}

function redactPII(obj) {
  if (obj == null) return obj;
  if (typeof obj === 'string') return obj;

  // Deep clone with basic cycle protection
  const seen = new WeakSet();
  const clone = (value) => {
    if (value == null) return value;
    if (typeof value !== 'object') return value;
    if (seen.has(value)) return '[Circular]';
    seen.add(value);

    if (Array.isArray(value)) {
      return value.map(clone);
    }
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      // Redact common PII fields
      if (['firstName', 'lastName', 'fullName', 'name'].includes(k)) {
        out[k] = '[REDACTED_NAME]';
      } else if (['cardNumber', 'cardNo', 'pan'].includes(k)) {
        out[k] = typeof v === 'string' ? maskCardNumber(v) : '[REDACTED_CARD]';
      } else if (['email'].includes(k)) {
        out[k] = '[REDACTED_EMAIL]';
      } else if (['phone', 'mobile'].includes(k)) {
        out[k] = '[REDACTED_PHONE]';
      } else if (k.toLowerCase().includes('token') || k.toLowerCase().includes('secret')) {
        out[k] = '[REDACTED_SECRET]';
      } else {
        out[k] = clone(v);
      }
    }
    return out;
  };

  return clone(obj);
}

// Build formats
const addErrorStack = format((info) => {
  if (info instanceof Error) {
    return { ...info, message: info.message, stack: info.stack };
  }
  if (info.error instanceof Error) {
    info.error = { message: info.error.message, stack: info.error.stack };
  }
  return info;
});

const redactFormat = format((info) => {
  // Redact known payload shapes
  const safeInfo = { ...info };
  if (safeInfo.payload) safeInfo.payload = redactPII(safeInfo.payload);
  if (safeInfo.request) safeInfo.request = redactPII(safeInfo.request);
  if (safeInfo.response) safeInfo.response = redactPII(safeInfo.response);
  if (safeInfo.meta) safeInfo.meta = redactPII(safeInfo.meta);
  return safeInfo;
});

const jsonFormat = format.combine(
  addErrorStack(),
  redactFormat(),
  format.timestamp(),
  format.json()
);

const consoleFormat = format.combine(
  addErrorStack(),
  redactFormat(),
  format.colorize(),
  format.timestamp(),
  format.printf(({ level, message, timestamp, ...meta }) => {
    const rest = Object.keys(meta).length ? JSON.stringify(meta) : '';
    return `[${timestamp}] ${level}: ${message} ${rest}`;
  })
);

const isProd = (process.env.NODE_ENV || '').toLowerCase() === 'production';

// Create base logger
const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: jsonFormat,
  defaultMeta: {
    service: 'secure-connect',
    env: process.env.NODE_ENV || 'development'
  },
  transports: [
    new DailyRotateFile({
      dirname: logsDir,
      filename: 'app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '10m',
      maxFiles: '14d',
      level: process.env.FILE_LOG_LEVEL || 'info',
      format: jsonFormat
    }),
    // Dedicated 4xx errors
    new DailyRotateFile({
      dirname: logsDir,
      filename: 'errors-4xx-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '10m',
      maxFiles: '30d',
      level: 'warn',
      format: jsonFormat
    }),
    // Dedicated 5xx errors
    new DailyRotateFile({
      dirname: logsDir,
      filename: 'errors-5xx-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '10m',
      maxFiles: '30d',
      level: 'error',
      format: jsonFormat
    })
  ],
  exceptionHandlers: [
    new DailyRotateFile({
      dirname: logsDir,
      filename: 'exceptions-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '10m',
      maxFiles: '14d',
      format: jsonFormat
    })
  ],
  rejectionHandlers: [
    new DailyRotateFile({
      dirname: logsDir,
      filename: 'rejections-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '10m',
      maxFiles: '14d',
      format: jsonFormat
    })
  ]
});

if (!isProd) {
  logger.add(
    new transports.Console({
      level: process.env.CONSOLE_LOG_LEVEL || 'debug',
      format: consoleFormat
    })
  );
}

// Correlation ID middleware and helpers
function correlationMiddleware(req, _res, next) {
  // Prefer incoming header if present
  const headerId = req.headers['x-correlation-id'];
  const id = (typeof headerId === 'string' && headerId.trim()) ? headerId : uuidv4();
  req.correlationId = id;
  next();
}

function withCorrelation(logger, correlationId) {
  // Return a child-like wrapper that injects correlationId
  const wrap = (level) => (message, meta = {}) => {
    const payload = {
      ...meta,
      correlationId
    };
    logger.log(level, message, payload);
  };

  return {
    error: wrap('error'),
    warn: wrap('warn'),
    info: wrap('info'),
    http: wrap('http'),
    verbose: wrap('verbose'),
    debug: wrap('debug'),
    silly: wrap('silly'),
    child(extra = {}) {
      return withCorrelation(logger, correlationId || extra.correlationId || uuidv4());
    }
  };
}

// Request logging middleware (express)
function httpLogger(req, res, next) {
  const start = Date.now();
  const corrId = req.correlationId || uuidv4();

  const child = withCorrelation(logger, corrId);
  req.log = child;

  child.info('Incoming request', {
    method: req.method,
    url: req.originalUrl || req.url,
    headers: {
      // Only keep safe headers
      'user-agent': req.headers['user-agent'],
      'x-forwarded-for': req.headers['x-forwarded-for'],
      'x-correlation-id': req.headers['x-correlation-id']
    }
  });

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    child.info('Request completed', {
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: res.statusCode,
      durationMs
    });
  });

  next();
}

export { logger, correlationMiddleware, httpLogger, maskCardNumber, redactPII, withCorrelation };
export default logger;