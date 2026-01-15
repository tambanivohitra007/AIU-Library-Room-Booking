import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger.js';
import { sendReminderEmail } from './email.js';

const prisma = new PrismaClient();

/**
 * Updates booking statuses automatically and sends reminders
 */
export const startBookingScheduler = () => {
  // Run every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      const now = new Date();

      // 1. Mark completed bookings
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

      // 2. Send Reminders (15 to 30 minutes before start)
      const fifteenMinutesFromNow = new Date(now.getTime() + 15 * 60000);
      const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60000);

      const remindersToSend = await prisma.booking.findMany({
        where: {
          status: 'CONFIRMED',
          reminderSent: false,
          startTime: {
            gte: fifteenMinutesFromNow,
            lte: thirtyMinutesFromNow,
          },
        },
        include: {
          user: true,
          room: true,
        },
      });

      for (const booking of remindersToSend) {
        if (booking.user.email) {
          await sendReminderEmail(booking.user.email, booking.user.name, {
            roomName: booking.room.name,
            startTime: booking.startTime,
            endTime: booking.endTime,
          });

          // Mark as sent
          await prisma.booking.update({
            where: { id: booking.id },
            data: { reminderSent: true },
          });
          
          logger.info(`Reminder sent for booking ${booking.id} to ${booking.user.email}`);
        }
      }

    } catch (error) {
      logger.error('Error in booking scheduler:', error);
    }
  });

  logger.info('Booking status scheduler started (runs every 5 minutes)');
};
