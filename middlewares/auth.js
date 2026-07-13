import jwt from 'jsonwebtoken';

const DEFAULT_EXPIRES_IN = '1h';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is required but not set in environment variables');
  }
  return secret;
}

/**
 * Sign a JWT for an authenticated user/service account.
 * @param {Object} payload - Claims to embed (e.g., { sub: username, role }).
 * @returns {string} Signed JWT.
 */
export function signToken(payload) {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || DEFAULT_EXPIRES_IN
  });
}

/**
 * Express middleware that requires a valid "Authorization: Bearer <token>" header.
 * Populates req.user with the decoded token payload on success.
 */
export function requireAuth(req, res, next) {
  const header = req.headers['authorization'] || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Missing or malformed Authorization header. Expected: Bearer <token>' });
  }

  try {
    req.user = jwt.verify(token, getJwtSecret());
    return next();
  } catch (err) {
    const message = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
    return res.status(401).json({ message });
  }
}
