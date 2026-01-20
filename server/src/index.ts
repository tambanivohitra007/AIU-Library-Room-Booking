import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import { authRouter } from './routes/auth.js';
import { userRouter } from './routes/users.js';
import { roomRouter } from './routes/rooms.js';
import { bookingRouter } from './routes/bookings.js';
import { adminRouter } from './routes/admin.js';
import { semesterRouter } from './routes/semesters.js';
import { apiLimiter } from './middleware/security.js';
import { startBookingScheduler } from './services/bookingScheduler.js';
import logger from './utils/logger.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
app.use('/api/', apiLimiter);

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/users', userRouter);
app.use('/api/rooms', roomRouter);
app.use('/api/bookings', bookingRouter);
app.use('/api/admin', adminRouter);
app.use('/api/semesters', semesterRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'LibBook API is running' });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message
  });
});

app.listen(PORT, () => {
  logger.info(`Server is running on http://localhost:${PORT}`);

  // Start booking status scheduler
  startBookingScheduler();
});
