import { Router } from 'express';
import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth.js';
import { body } from 'express-validator';
import { handleValidationErrors } from '../middleware/validation.js';
import logger from '../utils/logger.js';

const router = Router();
const prisma = new PrismaClient();

// Apply authentication and admin check to all routes
router.use(authenticateToken);
router.use(requireAdmin);

// ===== USER MANAGEMENT =====

// Update user role
router.patch('/users/:id/role', [
  body('role').isIn(['STUDENT', 'ADMIN']).withMessage('Invalid role'),
  handleValidationErrors,
], async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

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
    res.json(user);
  } catch (error) {
    logger.error('Error updating user role:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// Delete user
router.delete('/users/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    // Prevent deleting self
    if (id === req.userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
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
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    logger.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Create admin user
router.post('/users/admin', [
  body('email').isEmail().withMessage('Invalid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('name').trim().notEmpty().withMessage('Name is required'),
  handleValidationErrors,
], async (req: AuthRequest, res) => {
  try {
    const { email, password, name } = req.body;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
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
    res.status(500).json({ error: 'Failed to create admin user' });
  }
});

// ===== ROOM MANAGEMENT =====

// Create room
router.post('/rooms', [
  body('name').trim().notEmpty().withMessage('Room name is required'),
  body('capacity').isInt({ min: 1 }).withMessage('Capacity must be at least 1'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('features').isArray().withMessage('Features must be an array'),
  handleValidationErrors,
], async (req: AuthRequest, res) => {
  try {
    const { name, capacity, description, features } = req.body;

    const room = await prisma.room.create({
      data: {
        name,
        capacity,
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
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// Update room
router.put('/rooms/:id', [
  body('name').optional().trim().notEmpty().withMessage('Room name cannot be empty'),
  body('capacity').optional().isInt({ min: 1 }).withMessage('Capacity must be at least 1'),
  body('description').optional().trim().notEmpty().withMessage('Description cannot be empty'),
  body('features').optional().isArray().withMessage('Features must be an array'),
  handleValidationErrors,
], async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { name, capacity, description, features } = req.body;

    const updateData: any = {};
    if (name) updateData.name = name;
    if (capacity) updateData.capacity = capacity;
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
    res.status(500).json({ error: 'Failed to update room' });
  }
});

// Delete room
router.delete('/rooms/:id', async (req: AuthRequest, res) => {
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
        error: 'Cannot delete room with active bookings',
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
    res.json({ message: 'Room deleted successfully' });
  } catch (error) {
    logger.error('Error deleting room:', error);
    res.status(500).json({ error: 'Failed to delete room' });
  }
});

// ===== STATISTICS =====

// Get admin statistics
router.get('/stats', async (req: AuthRequest, res) => {
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
      recentBookings: recentBookings.map(b => ({
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
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

export { router as adminRouter };
