import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger.js';
import { sendReminderEmail } from './email.js';
import { asLang, tr } from './i18n.js';
import { recordSystemAudit } from './audit.js';

const prisma = new PrismaClient();

/**
 * Updates booking statuses automatically and sends reminders
 */
export const startBookingScheduler = () => {
  // Run every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      const now = new Date();

      // 1. Mark completed bookings.
      // Select the ids first so the audit trail can report a count that matches
      // exactly the rows this run changed.
      const toComplete = await prisma.booking.findMany({
        where: { status: 'CONFIRMED', endTime: { lt: now } },
        select: { id: true },
      });

      if (toComplete.length > 0) {
        await prisma.booking.updateMany({
          where: { id: { in: toComplete.map((b) => b.id) } },
          data: { status: 'COMPLETED' },
        });
        logger.info(`Marked ${toComplete.length} booking(s) as COMPLETED`);
        // Routine lifecycle - recorded as one aggregate row so it cannot drown
        // out the entries someone is actually looking for.
        await recordSystemAudit({
          action: 'BOOKING_AUTO_COMPLETE',
          targetType: 'Booking',
          targetLabel: `${toComplete.length} booking(s)`,
          summary: `Marked ${toComplete.length} finished booking(s) as completed`,
          metadata: { count: toComplete.length },
        });
      }

      // 1b. Cancel PENDING requests whose start time passed without a decision
      const expiredPending = await prisma.booking.findMany({
        where: { status: 'PENDING', startTime: { lt: now } },
        include: { user: true, room: true },
      });

      for (const booking of expiredPending) {
        // Stored and later shown to the booker, so write it in THEIR language -
        // matching how a manual rejection reason is recorded.
        await prisma.booking.update({
          where: { id: booking.id },
          data: {
            status: 'CANCELLED',
            cancellationReason: tr(asLang(booking.user.language), 'autoCancelledUnapproved'),
          },
        });

        // One row each: an auto-cancellation destroys someone's booking with no
        // human involved, so it needs to be individually answerable for.
        await recordSystemAudit({
          action: 'BOOKING_AUTO_CANCEL',
          targetType: 'Booking',
          targetId: booking.id,
          targetLabel: `${booking.room.name} - ${booking.user.name}`,
          departmentId: booking.room.departmentId,
          summary: 'Auto-cancelled: not approved before the start time',
          metadata: {
            start: booking.startTime.toISOString(),
            booker: booking.user.email,
          },
        });
      }

      if (expiredPending.length > 0) {
        logger.info(`Auto-cancelled ${expiredPending.length} unapproved pending booking(s)`);
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
