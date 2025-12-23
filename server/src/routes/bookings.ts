import { Router } from 'express';
import { PrismaClient, BookingStatus } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

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
    const formattedBookings = bookings.map(booking => ({
      id: booking.id,
      roomId: booking.roomId,
      userId: booking.userId,
      userDisplay: booking.user.name,
      startTime: booking.startTime.toISOString(),
      endTime: booking.endTime.toISOString(),
      purpose: booking.purpose,
      attendees: booking.attendees.map(a => ({
        name: a.name,
        studentId: a.studentId,
        isCompanion: a.isCompanion,
      })),
      status: booking.status,
      createdAt: booking.createdAt.toISOString(),
    }));

    res.json(formattedBookings);
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
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
      createdAt: booking.createdAt.toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

// Create booking
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { roomId, startTime, endTime, purpose, attendees } = req.body;
    const userId = req.userId!; // From JWT token

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
    });

    if (overlapping) {
      return res.status(409).json({ error: 'Time slot is already booked' });
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

    const updated = await prisma.booking.update({
      where: { id: req.params.id },
      data: { status: BookingStatus.CANCELLED },
      include: {
        user: true,
        attendees: true,
      },
    });

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
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

export { router as bookingRouter };
