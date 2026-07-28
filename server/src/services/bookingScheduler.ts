import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger.js';
import { sendReminderEmail } from './email.js';
import { asLang } from './i18n.js';

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

      // 1b. Cancel PENDING requests whose start time passed without a decision
      const expiredPending = await prisma.booking.updateMany({
        where: {
          status: 'PENDING',
          startTime: {
            lt: now,
          },
        },
        data: {
          status: 'CANCELLED',
          cancellationReason: 'Not approved before the booking start time',
        },
      });

      if (expiredPending.count > 0) {
        logger.info(`Auto-cancelled ${expiredPending.count} unapproved pending booking(s)`);
      }

      // 2. Send Reminders (Start checking 30 minutes before)
      const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60000);
      const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60000);

      const remindersToSend = await prisma.booking.findMany({
        where: {
          status: 'CONFIRMED',
          reminderSent: false,
          startTime: {
            gte: fiveMinutesFromNow,
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
          }, asLang(booking.user.language));

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
