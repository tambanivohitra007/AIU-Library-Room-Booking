import { Router, Response } from 'express';
import { PrismaClient, BookingStatus } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { validateBooking } from '../middleware/validation.js';
import logger from '../utils/logger.js';

const router = Router();
const prisma = new PrismaClient();

// Apply authentication to all booking routes
router.use(authenticateToken);

// Get all bookings with user and room details
router.get('/', async (req: AuthRequest, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      include: {
        user: true,
        room: true,
        attendees: true,
      },
      orderBy: {
        startTime: 'asc',
      },
    });

    // Format bookings to match client expectations
    const formattedBookings = bookings.map((booking: any) => ({
      id: booking.id,
      roomId: booking.roomId,
      userId: booking.userId,
      userDisplay: booking.user.name,
      startTime: booking.startTime.toISOString(),
      endTime: booking.endTime.toISOString(),
      purpose: booking.purpose,
      attendees: booking.attendees.map((a: any) => ({
        name: a.name,
        studentId: a.studentId,
        isCompanion: a.isCompanion,
      })),
      status: booking.status,
      cancellationReason: booking.cancellationReason,
      createdAt: booking.createdAt.toISOString(),
    }));

    res.json(formattedBookings);
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// Check for booking conflicts (real-time validation)
router.post('/check-conflicts', async (req: AuthRequest, res) => {
  try {
    const { roomId, startTime, endTime } = req.body;

    if (!roomId || !startTime || !endTime) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Find all overlapping bookings
    const conflicts = await prisma.booking.findMany({
      where: {
        roomId,
        status: BookingStatus.CONFIRMED,
        OR: [
          {
            AND: [
              { startTime: { lte: new Date(startTime) } },
              { endTime: { gt: new Date(startTime) } },
            ],
          },
          {
            AND: [
              { startTime: { lt: new Date(endTime) } },
              { endTime: { gte: new Date(endTime) } },
            ],
          },
          {
            AND: [
              { startTime: { gte: new Date(startTime) } },
              { endTime: { lte: new Date(endTime) } },
            ],
          },
        ],
      },
      include: {
        user: true,
      },
    });

    res.json({
      hasConflict: conflicts.length > 0,
      conflicts: conflicts.map((c: any) => ({
        id: c.id,
        startTime: c.startTime.toISOString(),
        endTime: c.endTime.toISOString(),
        userDisplay: c.user.name,
      })),
    });
  } catch (error) {
    console.error('Error checking conflicts:', error);
    res.status(500).json({ error: 'Failed to check conflicts' });
  }
});

// Get booking by ID
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: {
        user: true,
        room: true,
        attendees: true,
      },
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.json({
      id: booking.id,
      roomId: booking.roomId,
      userId: booking.userId,
      userDisplay: booking.user.name,
      startTime: booking.startTime.toISOString(),
      endTime: booking.endTime.toISOString(),
      purpose: booking.purpose,
      attendees: booking.attendees,
      status: booking.status,
      cancellationReason: booking.cancellationReason,
      createdAt: booking.createdAt.toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

// Create booking
router.post('/', validateBooking, async (req: AuthRequest, res: Response) => {
  try {
    const { roomId, startTime, endTime, purpose, attendees } = req.body;
    const userId = req.userId!; // From JWT token

    // Validate booking is not in the past
    const now = new Date();
    const bookingStart = new Date(startTime);
    const bookingEnd = new Date(endTime);

    if (bookingStart <= now) {
      return res.status(400).json({
        error: 'Cannot book a time slot in the past. Please select a future time.',
      });
    }

    if (bookingEnd <= now) {
      return res.status(400).json({
        error: 'Booking end time cannot be in the past.',
      });
    }

    // Check for overlapping bookings
    const overlapping = await prisma.booking.findFirst({
      where: {
        roomId,
        status: BookingStatus.CONFIRMED,
        OR: [
          {
            AND: [
              { startTime: { lte: new Date(startTime) } },
              { endTime: { gt: new Date(startTime) } },
            ],
          },
          {
            AND: [
              { startTime: { lt: new Date(endTime) } },
              { endTime: { gte: new Date(endTime) } },
            ],
          },
          {
            AND: [
              { startTime: { gte: new Date(startTime) } },
              { endTime: { lte: new Date(endTime) } },
            ],
          },
        ],
      },
      include: {
        user: true,
      },
    });

    if (overlapping) {
      logger.warn(`Booking conflict detected for room ${roomId} at ${startTime}-${endTime}`);
      return res.status(409).json({
        error: 'This time slot conflicts with an existing booking',
        conflict: {
          startTime: overlapping.startTime.toISOString(),
          endTime: overlapping.endTime.toISOString(),
          bookedBy: overlapping.user.name,
        }
      });
    }

    // Create booking with attendees
    const booking = await prisma.booking.create({
      data: {
        roomId,
        userId,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        purpose,
        attendees: {
          create: attendees,
        },
      },
      include: {
        user: true,
        attendees: true,
      },
    });

    res.status(201).json({
      id: booking.id,
      roomId: booking.roomId,
      userId: booking.userId,
      userDisplay: booking.user.name,
      startTime: booking.startTime.toISOString(),
      endTime: booking.endTime.toISOString(),
      purpose: booking.purpose,
      attendees: booking.attendees,
      status: booking.status,
      createdAt: booking.createdAt.toISOString(),
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// Cancel booking
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const { reason } = req.body; // Optional cancellation reason
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Check if user owns the booking or is admin
    if (booking.userId !== req.userId && req.userRole !== 'ADMIN') {
      return res.status(403).json({ error: 'You can only cancel your own bookings' });
    }

    // Only allow canceling CONFIRMED bookings
    if (booking.status !== BookingStatus.CONFIRMED) {
      return res.status(400).json({
        error: `Cannot cancel a ${booking.status.toLowerCase()} booking`,
      });
    }

    // Check if booking has already ended
    const now = new Date();
    if (booking.endTime <= now) {
      return res.status(400).json({
        error: 'Cannot cancel a booking that has already ended',
      });
    }

    const updated = await prisma.booking.update({
      where: { id: req.params.id },
      data: { 
        status: BookingStatus.CANCELLED,
        cancellationReason: reason || null,
      },
      include: {
        user: true,
        attendees: true,
      },
    });

    logger.info(`Booking ${updated.id} cancelled by user ${req.userId}. Reason: ${reason || 'None'}`);

    res.json({
      id: updated.id,
      roomId: updated.roomId,
      userId: updated.userId,
      userDisplay: updated.user.name,
      startTime: updated.startTime.toISOString(),
      endTime: updated.endTime.toISOString(),
      purpose: updated.purpose,
      attendees: updated.attendees,
      status: updated.status,
      cancellationReason: updated.cancellationReason,
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

export { router as bookingRouter };
