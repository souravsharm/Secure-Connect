import express from 'express';
import bcrypt from 'bcryptjs';
import { asyncHandler } from '../../utils/errorHandler.js';
import { validateLoginBody } from '../../middlewares/validation.js';
import { signToken } from '../../middlewares/auth.js';
import logger from '../../utils/logger.js';

const router = express.Router();

// Basic in-memory brute-force protection for the login endpoint.
// Keyed by IP; resets on server restart. Fine for a single-instance demo API,
// swap for a shared store (e.g. Redis) if this ever runs behind multiple instances.
const MAX_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map();

function loginRateLimiter(req, res, next) {
  const key = req.ip;
  const now = Date.now();
  const record = attempts.get(key);

  if (record && now - record.firstAttempt < LOCKOUT_WINDOW_MS && record.count >= MAX_ATTEMPTS) {
    const retryAfterSec = Math.ceil((LOCKOUT_WINDOW_MS - (now - record.firstAttempt)) / 1000);
    res.set('Retry-After', String(retryAfterSec));
    return res.status(429).json({ message: 'Too many login attempts. Try again later.' });
  }
  next();
}

function registerFailedAttempt(ip) {
  const now = Date.now();
  const record = attempts.get(ip);
  if (!record || now - record.firstAttempt >= LOCKOUT_WINDOW_MS) {
    attempts.set(ip, { count: 1, firstAttempt: now });
  } else {
    record.count += 1;
  }
}

function clearAttempts(ip) {
  attempts.delete(ip);
}

router.post(
  '/login',
  loginRateLimiter,
  validateLoginBody,
  asyncHandler(async (req, res) => {
    const { username, password } = req.validated;
    const log = req?.log || logger;

    const expectedUsername = process.env.AUTH_USERNAME;
    const expectedPasswordHash = process.env.AUTH_PASSWORD_HASH;

    if (!expectedUsername || !expectedPasswordHash) {
      log.error('Auth is misconfigured: AUTH_USERNAME/AUTH_PASSWORD_HASH not set');
      return res.status(500).json({ message: 'Authentication is not configured on the server' });
    }

    const usernameMatches = username === expectedUsername;
    const passwordMatches = usernameMatches && (await bcrypt.compare(password, expectedPasswordHash));

    if (!usernameMatches || !passwordMatches) {
      registerFailedAttempt(req.ip);
      log.warn('Failed login attempt', { username: '[REDACTED_NAME]' });
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    clearAttempts(req.ip);
    const token = signToken({ sub: username, role: 'admin' });
    log.info('Login successful', { username: '[REDACTED_NAME]' });
    res.status(200).json({
      token,
      tokenType: 'Bearer',
      expiresIn: process.env.JWT_EXPIRES_IN || '1h'
    });
  })
);

export default router;
