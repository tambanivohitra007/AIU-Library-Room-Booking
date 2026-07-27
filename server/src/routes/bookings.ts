import { Router, Response } from 'express';
import { PrismaClient, BookingStatus } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { validateBooking } from '../middleware/validation.js';
import logger from '../utils/logger.js';
import { sendCancellationEmail, sendReminderEmail, sendApprovalEmail, sendApprovalRequestEmail, parseEmails } from '../services/email.js';
import { getServiceSettings, getEffectiveOperatingHours, checkWithinOperatingHours } from '../services/settings.js';
import { getManagedDepartmentIds, isGlobalAdmin } from '../services/permissions.js';

const router = Router();
const prisma = new PrismaClient();

// Apply authentication to all booking routes
router.use(authenticateToken);

// PENDING requests hold their slot, so both statuses block overlapping bookings
const BLOCKING_STATUSES = [BookingStatus.CONFIRMED, BookingStatus.PENDING];

// Staff, or a department admin of the room's department, may approve/reject/cancel
const canModerateBooking = async (req: AuthRequest, departmentId: string | null): Promise<boolean> => {
  if (isGlobalAdmin(req.userRole) || req.userRole === 'STUDENT_WORKER') return true;
  const managed = await getManagedDepartmentIds(req.userId);
  return !!departmentId && managed.includes(departmentId);
};

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

    const isStudent = req.userRole === 'STUDENT';
    // Department admins see full details for their departments' rooms
    const managedDepartmentIds = isStudent ? await getManagedDepartmentIds(req.userId) : [];

    // Format bookings to match client expectations
    const formattedBookings = bookings.map((booking: any) => {
      const isOwner = booking.userId === req.userId;
      const managesRoom = !!booking.room.departmentId && managedDepartmentIds.includes(booking.room.departmentId);
      const canViewDetails = !isStudent || isOwner || managesRoom;

      return {
        id: booking.id,
        roomId: booking.roomId,
        userId: booking.userId,
        userDisplay: canViewDetails ? booking.user.name : null,
        userEmail: canViewDetails ? booking.user.email : null,
        startTime: booking.startTime.toISOString(),
        endTime: booking.endTime.toISOString(),
        purpose: canViewDetails ? booking.purpose : null,
        attendees: canViewDetails ? booking.attendees.map((a: any) => ({
          name: a.name,
          studentId: a.studentId,
          isCompanion: a.isCompanion,
        })) : [],
        status: booking.status,
        cancellationReason: canViewDetails ? booking.cancellationReason : null,
        createdAt: booking.createdAt.toISOString(),
      };
    });

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
        status: { in: BLOCKING_STATUSES },
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

    // Full details only for the owner, staff, or a department admin of the room
    const isOwner = booking.userId === req.userId;
    const isStaff = isGlobalAdmin(req.userRole) || req.userRole === 'STUDENT_WORKER';
    if (!isOwner && !isStaff) {
      const managed = await getManagedDepartmentIds(req.userId);
      if (!booking.room.departmentId || !managed.includes(booking.room.departmentId)) {
        return res.status(403).json({ error: 'Permission denied' });
      }
    }

    res.json({
      id: booking.id,
      roomId: booking.roomId,
      userId: booking.userId,
      userDisplay: booking.user.name,
      userEmail: booking.user.email,
      startTime: booking.startTime.toISOString(),
      endTime: booking.endTime.toISOString(),
      purpose: booking.purpose,
      attendees: booking.attendees,
      status: booking.status,
      cancellationReason: booking.cancellationReason,
      termsAcceptedAt: booking.termsAcceptedAt ? booking.termsAcceptedAt.toISOString() : null,
      createdAt: booking.createdAt.toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

// Create booking
router.post('/', validateBooking, async (req: AuthRequest, res: Response) => {
  try {
    const { roomId, startTime, endTime, purpose, attendees, termsAccepted } = req.body;
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

    // Check operating hours: the room's department schedule wins, else the global one
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: { department: true },
    });

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Enforce the room's capacity range (attendees list includes the booker)
    const attendeeCount = Array.isArray(attendees) ? attendees.length : 0;
    if (attendeeCount < room.minCapacity || attendeeCount > room.maxCapacity) {
      return res.status(400).json({
        error: `This room requires between ${room.minCapacity} and ${room.maxCapacity} people (including you).`,
      });
    }

    // Rooms with terms & conditions require explicit acceptance
    if (room.bookingTerms && termsAccepted !== true) {
      return res.status(400).json({
        error: "You must accept this room's terms and conditions to book it.",
      });
    }

    const settings = await getServiceSettings();
    const effectiveHours = getEffectiveOperatingHours(settings, room.department?.operatingHours);
    const hoursCheck = checkWithinOperatingHours(bookingStart, bookingEnd, effectiveHours);
    if (!hoursCheck.ok) {
      return res.status(400).json({ error: hoursCheck.error });
    }

    // Check Semester Validity
    const activeSemester = await prisma.semester.findFirst({
       where: { isActive: true },
    });

    if (activeSemester) {
       if (bookingStart < activeSemester.startDate || bookingEnd > activeSemester.endDate) {
           return res.status(400).json({
               error: `Bookings are only allowed within the current semester: ${activeSemester.name} (${activeSemester.startDate.toLocaleDateString()} - ${activeSemester.endDate.toLocaleDateString()})`
           });
       }
    }

    // Check for overlapping bookings
    const overlapping = await prisma.booking.findFirst({
      where: {
        roomId,
        status: { in: BLOCKING_STATUSES },
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

    // Create booking with attendees; approval-gated rooms start as PENDING
    const initialStatus = room.requiresApproval ? BookingStatus.PENDING : BookingStatus.CONFIRMED;
    const booking = await prisma.booking.create({
      data: {
        roomId,
        userId,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        purpose,
        status: initialStatus,
        termsAcceptedAt: room.bookingTerms ? new Date() : null,
        attendees: {
          create: attendees,
        },
      },
      include: {
        user: true,
        attendees: true,
      },
    });

    // Notify everyone responsible: the department's admins and its contact address(es).
    // Fall back to the service contact(s) so requests are never silently unwatched.
    if (initialStatus === BookingStatus.PENDING) {
      const departmentAdmins = room.departmentId
        ? await prisma.departmentAdmin.findMany({
            where: { departmentId: room.departmentId },
            include: { user: { select: { email: true } } },
          })
        : [];

      const recipients = [...new Set([
        ...parseEmails(room.department?.contactEmail),
        ...departmentAdmins.map((a: any) => a.user.email).filter(Boolean),
      ])];

      if (recipients.length === 0) {
        recipients.push(...parseEmails(settings.contactEmail));
      }

      await sendApprovalRequestEmail(recipients, {
        roomName: room.name,
        userName: booking.user.name,
        startTime: booking.startTime,
        endTime: booking.endTime,
      });
    }

    res.status(201).json({
      id: booking.id,
      roomId: booking.roomId,
      userId: booking.userId,
      userDisplay: booking.user.name,
      userEmail: booking.user.email,
      startTime: booking.startTime.toISOString(),
      endTime: booking.endTime.toISOString(),
      purpose: booking.purpose,
      attendees: booking.attendees,
      status: booking.status,
      termsAcceptedAt: booking.termsAcceptedAt ? booking.termsAcceptedAt.toISOString() : null,
      createdAt: booking.createdAt.toISOString(),
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// Approve a pending booking (staff or the room's department admin)
router.post('/:id/approve', async (req: AuthRequest, res) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: { user: true, room: true },
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (!(await canModerateBooking(req, booking.room.departmentId))) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    if (booking.status !== BookingStatus.PENDING) {
      return res.status(400).json({ error: 'Only pending bookings can be approved' });
    }

    if (booking.endTime <= new Date()) {
      return res.status(400).json({ error: 'This booking request has already passed' });
    }

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: { status: BookingStatus.CONFIRMED },
    });

    if (booking.user.email) {
      await sendApprovalEmail(booking.user.email, booking.user.name, {
        roomName: booking.room.name,
        startTime: booking.startTime,
        endTime: booking.endTime,
      });
    }

    logger.info(`Booking ${booking.id} approved by user ${req.userId}`);
    res.json({ id: updated.id, status: updated.status });
  } catch (error) {
    logger.error('Error approving booking:', error);
    res.status(500).json({ error: 'Failed to approve booking' });
  }
});

// Reject a pending booking (staff or the room's department admin)
router.post('/:id/reject', async (req: AuthRequest, res) => {
  try {
    const { reason } = req.body;
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: { user: true, room: true },
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (!(await canModerateBooking(req, booking.room.departmentId))) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    if (booking.status !== BookingStatus.PENDING) {
      return res.status(400).json({ error: 'Only pending bookings can be rejected' });
    }

    const rejectionReason = (reason && String(reason).trim()) || 'Booking request rejected';
    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: BookingStatus.CANCELLED,
        cancellationReason: rejectionReason,
      },
    });

    if (booking.user.email) {
      await sendCancellationEmail(booking.user.email, booking.user.name, {
        roomName: booking.room.name,
        startTime: booking.startTime,
        reason: rejectionReason,
      });
    }

    logger.info(`Booking ${booking.id} rejected by user ${req.userId}. Reason: ${rejectionReason}`);
    res.json({ id: updated.id, status: updated.status, cancellationReason: updated.cancellationReason });
  } catch (error) {
    logger.error('Error rejecting booking:', error);
    res.status(500).json({ error: 'Failed to reject booking' });
  }
});

// Send manual reminder
router.post('/:id/remind', async (req: AuthRequest, res) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: { user: true, room: true },
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Check permissions (Admin, Student Worker, Owner, or Department Admin of the room)
    if (booking.userId !== req.userId && !isGlobalAdmin(req.userRole) && req.userRole !== 'STUDENT_WORKER') {
      const managed = await getManagedDepartmentIds(req.userId);
      if (!booking.room.departmentId || !managed.includes(booking.room.departmentId)) {
        return res.status(403).json({ error: 'Permission denied' });
      }
    }

    if (booking.status !== BookingStatus.CONFIRMED) {
      return res.status(400).json({ error: 'Can only remind for confirmed bookings' });
    }
    
    // Check if in past (allow if starts within 5 mins ago? No, strictly future or ongoing)
    // Actually, "Upcoming" implies future.
    if (booking.endTime < new Date()) {
       return res.status(400).json({ error: 'Cannot remind for completed bookings' });
    }

    if (booking.user.email) {
      await sendReminderEmail(booking.user.email, booking.user.name, {
        roomName: booking.room.name,
        startTime: booking.startTime,
        endTime: booking.endTime,
      });

      // Update flag
      await prisma.booking.update({
        where: { id: booking.id },
        data: { reminderSent: true },
      });
      
      return res.json({ message: 'Reminder sent successfully' });
    } else {
      return res.status(400).json({ error: 'User has no email address' });
    }

  } catch (error) {
    logger.error('Error sending manual reminder:', error);
    res.status(500).json({ error: 'Failed to send reminder' });
  }
});

// Cancel booking
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const { reason } = req.body; // Optional cancellation reason
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: { room: true },
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Check if user owns the booking, is admin/worker, or manages the room's department
    if (booking.userId !== req.userId && !isGlobalAdmin(req.userRole) && req.userRole !== 'STUDENT_WORKER') {
      const managed = await getManagedDepartmentIds(req.userId);
      if (!booking.room.departmentId || !managed.includes(booking.room.departmentId)) {
        return res.status(403).json({ error: 'You can only cancel your own bookings' });
      }
    }

    // Only confirmed bookings and pending requests can be cancelled/withdrawn
    if (booking.status !== BookingStatus.CONFIRMED && booking.status !== BookingStatus.PENDING) {
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
        room: true,
      },
    });

    // Send cancellation email (only if cancelled by someone valid)
    if (updated.user.email) {
      await sendCancellationEmail(updated.user.email, updated.user.name, {
        roomName: updated.room.name,
        startTime: updated.startTime,
        reason: reason,
      });
    }

    logger.info(`Booking ${updated.id} cancelled by user ${req.userId}. Reason: ${reason || 'None'}`);

    res.json({
      id: updated.id,
      roomId: updated.roomId,
      userId: updated.userId,
      userDisplay: updated.user.name,
      userEmail: updated.user.email,
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
