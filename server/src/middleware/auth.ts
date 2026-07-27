import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Read lazily: dotenv.config() runs after modules are imported, so a
// module-level read would always see undefined and use the fallback.
const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production');
  }
  return 'dev-only-insecure-secret';
};

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
}

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  let decoded: { userId: string; role: string };
  try {
    decoded = jwt.verify(token, getJwtSecret()) as { userId: string; role: string };
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }

  try {
    // Re-check the user on every request so suspensions and role changes
    // take effect immediately instead of when the 7-day token expires.
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { role: true, status: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'Account no longer exists' });
    }
    if (user.status === 'SUSPENDED') {
      return res.status(403).json({ error: 'Your account has been suspended.' });
    }
    if (user.status === 'PENDING') {
      return res.status(403).json({ error: 'Your account is pending approval.' });
    }

    req.userId = decoded.userId;
    req.userRole = user.role; // current role from DB, not the one baked into the token
    next();
  } catch (error) {
    return res.status(500).json({ error: 'Authentication check failed' });
  }
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.userRole !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

export const requireAdminOrWorker = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.userRole !== 'ADMIN' && req.userRole !== 'STUDENT_WORKER') {
    return res.status(403).json({ error: 'Access required' });
  }
  next();
};

export const generateToken = (userId: string, role: string): string => {
  return jwt.sign({ userId, role }, getJwtSecret(), { expiresIn: '7d' });
};
