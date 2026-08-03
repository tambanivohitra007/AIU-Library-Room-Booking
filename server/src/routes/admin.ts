import { Router, Response } from 'express';
import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { authenticateToken, requireAdmin, requireAdminOrWorker, requireSuperAdmin, AuthRequest } from '../middleware/auth.js';
import { body } from 'express-validator';
import { handleValidationErrors } from '../middleware/validation.js';
import logger from '../utils/logger.js';
import { trReq } from '../services/i18n.js';
import { recordAudit } from '../services/audit.js';

const router = Router();
const prisma = new PrismaClient();

// Apply authentication to all routes; individual routes enforce role requirements
router.use(authenticateToken);

// ===== USER MANAGEMENT =====

// Update user role (super admin only: role changes are privilege escalation)
router.patch('/users/:id/role', requireSuperAdmin, [
  body('role').isIn(['STUDENT', 'STUDENT_WORKER', 'ADMIN', 'SUPERADMIN']).withMessage('invalidRole'),
  handleValidationErrors,
], async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const before = await prisma.user.findUnique({ where: { id }, select: { role: true } });

    const user = await prisma.user.update({
      where: { id },
      data: { role: role as UserRole },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    logger.info(`User role updated: ${id} to ${role} by admin ${req.userId}`);
    await recordAudit(req, {
      action: 'USER_ROLE_CHANGE',
      targetType: 'User',
      targetId: user.id,
      targetLabel: user.email,
      summary: `Changed role of ${user.email}: ${before?.role ?? 'unknown'} -> ${user.role}`,
      metadata: { from: before?.role ?? null, to: user.role },
    });
    res.json(user);
  } catch (error) {
    logger.error('Error updating user role:', error);
    res.status(500).json({ error: trReq(req, 'updateRoleFailed') });
  }
});

// Delete user
router.delete('/users/:id', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    // Prevent deleting self
    if (id === req.userId) {
      return res.status(400).json({ error: trReq(req, 'cannotDeleteSelf') });
    }

    const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
    if (target && ['ADMIN', 'SUPERADMIN'].includes(target.role) && req.userRole !== 'SUPERADMIN') {
      return res.status(403).json({ error: trReq(req, 'superAdminDeleteAdmin') });
    }

    // Delete user's bookings first (cascade should handle this, but being explicit)
    await prisma.attendee.deleteMany({
      where: {
        booking: {
          userId: id,
        },
      },
    });

    await prisma.booking.deleteMany({
      where: { userId: id },
    });

    await prisma.user.delete({
      where: { id },
    });

    logger.info(`User deleted: ${id} by admin ${req.userId}`);
    res.json({ message: trReq(req, 'userDeleted') });
  } catch (error) {
    logger.error('Error deleting user:', error);
    res.status(500).json({ error: trReq(req, 'deleteUserFailed') });
  }
});

// Create admin user (super admin only)
router.post('/users/admin', requireSuperAdmin, [
  body('email').isEmail().withMessage('invalidEmail'),
  body('password').isLength({ min: 6 }).withMessage('passwordMin6'),
  body('name').trim().notEmpty().withMessage('nameRequired'),
  handleValidationErrors,
], async (req: AuthRequest, res: Response) => {
  try {
    const { email, password, name } = req.body;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ error: trReq(req, 'userExists') });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: UserRole.ADMIN,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    logger.info(`Admin user created: ${user.id} by admin ${req.userId}`);
    res.status(201).json(user);
  } catch (error) {
    logger.error('Error creating admin user:', error);
    res.status(500).json({ error: trReq(req, 'createAdminFailed') });
  }
});

// ===== ROOM MANAGEMENT =====

// Create room
router.post('/rooms', requireAdmin, [
  body('name').trim().notEmpty().withMessage('roomNameRequired'),
  body('minCapacity').isInt({ min: 1 }).withMessage('minCapacityMin'),
  body('maxCapacity').isInt({ min: 1 }).withMessage('maxCapacityMin'),
  body('description').trim().notEmpty().withMessage('descriptionRequired'),
  body('features').isArray().withMessage('featuresArray'),
  handleValidationErrors,
], async (req: AuthRequest, res: Response) => {
  try {
    const { name, minCapacity, maxCapacity, description, features } = req.body;

    const room = await prisma.room.create({
      data: {
        name,
        minCapacity,
        maxCapacity,
        description,
        features: JSON.stringify(features),
      },
    });

    logger.info(`Room created: ${room.id} by admin ${req.userId}`);

    res.status(201).json({
      ...room,
      features: JSON.parse(room.features),
    });
  } catch (error) {
    logger.error('Error creating room:', error);
    res.status(500).json({ error: trReq(req, 'createRoomFailed') });
  }
});

// Update room
router.put('/rooms/:id', requireAdmin, [
  body('name').optional().trim().notEmpty().withMessage('roomNameNotEmpty'),
  body('minCapacity').optional().isInt({ min: 1 }).withMessage('minCapacityMin'),
  body('maxCapacity').optional().isInt({ min: 1 }).withMessage('maxCapacityMin'),
  body('description').optional().trim().notEmpty().withMessage('descriptionNotEmpty'),
  body('features').optional().isArray().withMessage('featuresArray'),
  handleValidationErrors,
], async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, minCapacity, maxCapacity, description, features } = req.body;

    const updateData: any = {};
    if (name) updateData.name = name;
    if (minCapacity) updateData.minCapacity = minCapacity;
    if (maxCapacity) updateData.maxCapacity = maxCapacity;
    if (description) updateData.description = description;
    if (features) updateData.features = JSON.stringify(features);

    const room = await prisma.room.update({
      where: { id },
      data: updateData,
    });

    logger.info(`Room updated: ${id} by admin ${req.userId}`);

    res.json({
      ...room,
      features: JSON.parse(room.features),
    });
  } catch (error) {
    logger.error('Error updating room:', error);
    res.status(500).json({ error: trReq(req, 'updateRoomFailed') });
  }
});

// Delete room
router.delete('/rooms/:id', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    // Check if room has any active bookings
    const activeBookings = await prisma.booking.count({
      where: {
        roomId: id,
        status: 'CONFIRMED',
        endTime: {
          gte: new Date(),
        },
      },
    });

    if (activeBookings > 0) {
      return res.status(400).json({
        error: trReq(req, 'roomHasBookings'),
      });
    }

    // Delete associated data
    await prisma.attendee.deleteMany({
      where: {
        booking: {
          roomId: id,
        },
      },
    });

    await prisma.booking.deleteMany({
      where: { roomId: id },
    });

    await prisma.room.delete({
      where: { id },
    });

    logger.info(`Room deleted: ${id} by admin ${req.userId}`);
    res.json({ message: trReq(req, 'roomDeleted') });
  } catch (error) {
    logger.error('Error deleting room:', error);
    res.status(500).json({ error: trReq(req, 'deleteRoomFailed') });
  }
});

// ===== STATISTICS =====

// Get admin statistics
router.get('/stats', requireAdminOrWorker, async (req: AuthRequest, res) => {
  try {
    const [
      totalUsers,
      totalBookings,
      activeBookings,
      totalRooms,
      recentBookings,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.booking.count(),
      prisma.booking.count({
        where: {
          status: 'CONFIRMED',
          startTime: { lte: new Date() },
          endTime: { gte: new Date() },
        },
      }),
      prisma.room.count(),
      prisma.booking.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
          room: {
            select: {
              name: true,
            },
          },
        },
      }),
    ]);

    res.json({
      totalUsers,
      totalBookings,
      activeBookings,
      totalRooms,
      recentBookings: recentBookings.map((b: any) => ({
        id: b.id,
        userName: b.user.name,
        roomName: b.room.name,
        startTime: b.startTime.toISOString(),
        endTime: b.endTime.toISOString(),
        status: b.status,
        createdAt: b.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    logger.error('Error fetching admin stats:', error);
    res.status(500).json({ error: trReq(req, 'fetchStatsFailed') });
  }
});

export { router as adminRouter };
