import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger.js';

const prisma = new PrismaClient();

/**
 * Updates booking statuses automatically:
 * - Marks bookings as COMPLETED when their end time has passed
 */
export const startBookingScheduler = () => {
  // Run every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      const now = new Date();

      // Find all CONFIRMED bookings that have ended
      const completedBookings = await prisma.booking.updateMany({
        where: {
          status: 'CONFIRMED',
          endTime: {
            lt: now,
          },
        },
        data: {
          status: 'COMPLETED',
        },
      });

      if (completedBookings.count > 0) {
        logger.info(`Marked ${completedBookings.count} booking(s) as COMPLETED`);
      }
    } catch (error) {
      logger.error('Error updating booking statuses:', error);
    }
  });

  logger.info('Booking status scheduler started (runs every 5 minutes)');
};
