import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { getManagedDepartmentIds, canManageDepartment, isGlobalAdmin } from '../services/permissions.js';

const router = Router();
const prisma = new PrismaClient();

// Get all rooms
router.get('/', async (req, res) => {
  try {
    const rooms = await prisma.room.findMany({
      include: { department: true },
    });
    // Parse features JSON string to array
    const roomsWithParsedFeatures = rooms.map((room: any) => ({
      ...room,
      features: JSON.parse(room.features),
    }));
    res.json(roomsWithParsedFeatures);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

// Get room by ID
router.get('/:id', async (req, res) => {
  try {
    const room = await prisma.room.findUnique({
      where: { id: req.params.id },
      include: { department: true },
    });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    res.json({
      ...room,
      features: JSON.parse(room.features),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch room' });
  }
});

// Create new room (global admin, or a department admin within their department)
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { name, description, minCapacity, maxCapacity, features, departmentId, bookingTerms, requiresApproval } = req.body;

    if (!isGlobalAdmin(req.userRole)) {
      const managed = await getManagedDepartmentIds(req.userId);
      if (managed.length === 0) {
        return res.status(403).json({ error: 'Admin access required' });
      }
      if (!canManageDepartment(req.userRole, managed, departmentId)) {
        return res.status(403).json({ error: 'You can only create rooms in your own department' });
      }
    }

    if (!name || !description || minCapacity === undefined || maxCapacity === undefined) {
      return res.status(400).json({ error: 'Name, description, minimum capacity, and maximum capacity are required' });
    }

    const minCap = parseInt(minCapacity);
    const maxCap = parseInt(maxCapacity);

    if (minCap < 1) {
      return res.status(400).json({ error: 'Minimum capacity must be at least 1' });
    }

    if (maxCap < 1) {
      return res.status(400).json({ error: 'Maximum capacity must be at least 1' });
    }

    if (minCap > maxCap) {
      return res.status(400).json({ error: 'Minimum capacity cannot be greater than maximum capacity' });
    }

    if (departmentId) {
      const department = await prisma.department.findUnique({ where: { id: departmentId } });
      if (!department) {
        return res.status(400).json({ error: 'Department not found' });
      }
    }

    // Create room with features as JSON string
    const room = await prisma.room.create({
      data: {
        name,
        description,
        minCapacity: minCap,
        maxCapacity: maxCap,
        features: JSON.stringify(features || []),
        departmentId: departmentId || null,
        bookingTerms: (typeof bookingTerms === 'string' && bookingTerms.trim()) || null,
        requiresApproval: requiresApproval === true,
      },
      include: { department: true },
    });

    res.status(201).json({
      ...room,
      features: JSON.parse(room.features),
    });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// Update room (global admin, or a department admin for rooms in their department)
router.put('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { name, description, minCapacity, maxCapacity, features, departmentId, bookingTerms, requiresApproval } = req.body;

    if (!isGlobalAdmin(req.userRole)) {
      const managed = await getManagedDepartmentIds(req.userId);
      const current = await prisma.room.findUnique({ where: { id: req.params.id } });
      if (!current) {
        return res.status(404).json({ error: 'Room not found' });
      }
      if (!canManageDepartment(req.userRole, managed, current.departmentId)) {
        return res.status(403).json({ error: 'You can only manage rooms in your own department' });
      }
      // A department admin cannot move a room outside their own departments
      if (!canManageDepartment(req.userRole, managed, departmentId)) {
        return res.status(403).json({ error: 'You can only assign rooms to your own department' });
      }
    }

    if (!name || !description || minCapacity === undefined || maxCapacity === undefined) {
      return res.status(400).json({ error: 'Name, description, minimum capacity, and maximum capacity are required' });
    }

    const minCap = parseInt(minCapacity);
    const maxCap = parseInt(maxCapacity);

    if (minCap < 1) {
      return res.status(400).json({ error: 'Minimum capacity must be at least 1' });
    }

    if (maxCap < 1) {
      return res.status(400).json({ error: 'Maximum capacity must be at least 1' });
    }

    if (minCap > maxCap) {
      return res.status(400).json({ error: 'Minimum capacity cannot be greater than maximum capacity' });
    }

    // Check if room exists
    const existingRoom = await prisma.room.findUnique({
      where: { id: req.params.id },
    });

    if (!existingRoom) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (departmentId) {
      const department = await prisma.department.findUnique({ where: { id: departmentId } });
      if (!department) {
        return res.status(400).json({ error: 'Department not found' });
      }
    }

    // Update room
    const room = await prisma.room.update({
      where: { id: req.params.id },
      data: {
        name,
        description,
        minCapacity: minCap,
        maxCapacity: maxCap,
        features: JSON.stringify(features || []),
        departmentId: departmentId || null,
        bookingTerms: (typeof bookingTerms === 'string' && bookingTerms.trim()) || null,
        requiresApproval: requiresApproval === true,
      },
      include: { department: true },
    });

    res.json({
      ...room,
      features: JSON.parse(room.features),
    });
  } catch (error) {
    console.error('Update room error:', error);
    res.status(500).json({ error: 'Failed to update room' });
  }
});

// Delete room (global admin, or a department admin for rooms in their department)
router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    // Check if room exists
    const existingRoom = await prisma.room.findUnique({
      where: { id: req.params.id },
    });

    if (!existingRoom) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (!isGlobalAdmin(req.userRole)) {
      const managed = await getManagedDepartmentIds(req.userId);
      if (!canManageDepartment(req.userRole, managed, existingRoom.departmentId)) {
        return res.status(403).json({ error: 'You can only manage rooms in your own department' });
      }
    }

    // Check if there are any active bookings for this room
    const activeBookingsCount = await prisma.booking.count({
      where: { 
        roomId: req.params.id,
        status: 'CONFIRMED'
      },
    });

    if (activeBookingsCount > 0) {
      return res.status(400).json({
        error: `Cannot delete room with active bookings. This room has ${activeBookingsCount} active booking(s). Please cancel them first.`
      });
    }

    // Delete all bookings associated with this room first (including CANCELLED and COMPLETED)
    // This is necessary because there is no CASCADE delete on the database schema
    await prisma.booking.deleteMany({
      where: { roomId: req.params.id }
    });

    // Delete room
    await prisma.room.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Room deleted successfully' });
  } catch (error) {
    console.error('Delete room error:', error);
    res.status(500).json({ error: 'Failed to delete room' });
  }
});

export { router as roomRouter };
