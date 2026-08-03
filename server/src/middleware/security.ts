import rateLimit from 'express-rate-limit';
import type { Request } from 'express';
import { trReq, type MessageKey } from '../services/i18n.js';

// The default handler sends `message` as the response body. Return an object so
// the client can read `body.error` like every other API error (a bare string
// left it showing "HTTP 429"), and resolve the language per request.
const limitMessage = (key: MessageKey) => (req: Request) => ({
  error: trReq(req, key),
});

// Rate limiter for authentication routes
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 5 : 100, // 5 in production, 100 in development
  message: limitMessage('tooManyLogins'),
  standardHeaders: true,
  legacyHeaders: false,
});

// General API rate limiter
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3000, // Increased to 3000 to accommodate client-side polling (approx 2 requests every 5s = ~360 requests/15min per client tab)
  message: limitMessage('tooManyRequests'),
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiter for sensitive operations
export const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 requests per hour
  message: limitMessage('tooManyRequests'),
  standardHeaders: true,
  legacyHeaders: false,
});
