import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { getManagedDepartmentIds, canManageDepartment, isGlobalAdmin } from '../services/permissions.js';
import { parseOperatingHoursJson } from '../services/settings.js';
import { trReq } from '../services/i18n.js';
import { recordAudit } from '../services/audit.js';

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
    res.status(500).json({ error: trReq(req, 'fetchRoomsFailed') });
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
      return res.status(404).json({ error: trReq(req, 'roomNotFound') });
    }
    res.json({
      ...room,
      features: JSON.parse(room.features),
    });
  } catch (error) {
    res.status(500).json({ error: trReq(req, 'fetchRoomFailed') });
  }
});

// Create new room (global admin, or a department admin within their department)
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { name, description, minCapacity, maxCapacity, features, departmentId, bookingTerms, requiresApproval, operatingHours } = req.body;

    if (!isGlobalAdmin(req.userRole)) {
      const managed = await getManagedDepartmentIds(req.userId);
      if (managed.length === 0) {
        return res.status(403).json({ error: trReq(req, 'adminRequired') });
      }
      if (!canManageDepartment(req.userRole, managed, departmentId)) {
        return res.status(403).json({ error: trReq(req, 'createOwnRooms') });
      }
    }

    if (!name || !description || minCapacity === undefined || maxCapacity === undefined) {
      return res.status(400).json({ error: trReq(req, 'roomFieldsRequired') });
    }

    const minCap = parseInt(minCapacity);
    const maxCap = parseInt(maxCapacity);

    if (minCap < 1) {
      return res.status(400).json({ error: trReq(req, 'minCapacityMin') });
    }

    if (maxCap < 1) {
      return res.status(400).json({ error: trReq(req, 'maxCapacityMin') });
    }

    if (minCap > maxCap) {
      return res.status(400).json({ error: trReq(req, 'minGreaterThanMax') });
    }

    if (departmentId) {
      const department = await prisma.department.findUnique({ where: { id: departmentId } });
      if (!department) {
        return res.status(400).json({ error: trReq(req, 'departmentNotFound') });
      }
    }

    if (operatingHours && !parseOperatingHoursJson(operatingHours)) {
      return res.status(400).json({ error: trReq(req, 'invalidOperatingHours') });
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
        // null = inherit the department's schedule (or the global one)
        operatingHours: operatingHours || null,
      },
      include: { department: true },
    });

    await recordAudit(req, {
      action: 'ROOM_CREATE',
      targetType: 'Room',
      targetId: room.id,
      targetLabel: room.name,
      departmentId: room.departmentId,
      summary: `Created room "${room.name}"`,
      metadata: { capacity: `${room.minCapacity}-${room.maxCapacity}`, requiresApproval: room.requiresApproval },
    });

    res.status(201).json({
      ...room,
      features: JSON.parse(room.features),
    });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ error: trReq(req, 'createRoomFailed') });
  }
});

// Update room (global admin, or a department admin for rooms in their department)
router.put('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { name, description, minCapacity, maxCapacity, features, departmentId, bookingTerms, requiresApproval, operatingHours } = req.body;

    if (!isGlobalAdmin(req.userRole)) {
      const managed = await getManagedDepartmentIds(req.userId);
      const current = await prisma.room.findUnique({ where: { id: req.params.id } });
      if (!current) {
        return res.status(404).json({ error: trReq(req, 'roomNotFound') });
      }
      if (!canManageDepartment(req.userRole, managed, current.departmentId)) {
        return res.status(403).json({ error: trReq(req, 'manageOwnRooms') });
      }
      // A department admin cannot move a room outside their own departments
      if (!canManageDepartment(req.userRole, managed, departmentId)) {
        return res.status(403).json({ error: trReq(req, 'assignOwnDepartment') });
      }
    }

    if (!name || !description || minCapacity === undefined || maxCapacity === undefined) {
      return res.status(400).json({ error: trReq(req, 'roomFieldsRequired') });
    }

    const minCap = parseInt(minCapacity);
    const maxCap = parseInt(maxCapacity);

    if (minCap < 1) {
      return res.status(400).json({ error: trReq(req, 'minCapacityMin') });
    }

    if (maxCap < 1) {
      return res.status(400).json({ error: trReq(req, 'maxCapacityMin') });
    }

    if (minCap > maxCap) {
      return res.status(400).json({ error: trReq(req, 'minGreaterThanMax') });
    }

    // Check if room exists
    const existingRoom = await prisma.room.findUnique({
      where: { id: req.params.id },
    });

    if (!existingRoom) {
      return res.status(404).json({ error: trReq(req, 'roomNotFound') });
    }

    if (departmentId) {
      const department = await prisma.department.findUnique({ where: { id: departmentId } });
      if (!department) {
        return res.status(400).json({ error: trReq(req, 'departmentNotFound') });
      }
    }

    if (operatingHours && !parseOperatingHoursJson(operatingHours)) {
      return res.status(400).json({ error: trReq(req, 'invalidOperatingHours') });
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
        // null = inherit the department's schedule (or the global one)
        operatingHours: operatingHours || null,
      },
      include: { department: true },
    });

    await recordAudit(req, {
      action: 'ROOM_UPDATE',
      targetType: 'Room',
      targetId: room.id,
      targetLabel: room.name,
      departmentId: room.departmentId,
      summary: `Updated room "${room.name}"`,
      metadata: {
        renamedFrom: existingRoom.name !== room.name ? existingRoom.name : undefined,
        movedDepartment: existingRoom.departmentId !== room.departmentId || undefined,
        hoursChanged: existingRoom.operatingHours !== room.operatingHours || undefined,
      },
    });

    res.json({
      ...room,
      features: JSON.parse(room.features),
    });
  } catch (error) {
    console.error('Update room error:', error);
    res.status(500).json({ error: trReq(req, 'updateRoomFailed') });
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
      return res.status(404).json({ error: trReq(req, 'roomNotFound') });
    }

    if (!isGlobalAdmin(req.userRole)) {
      const managed = await getManagedDepartmentIds(req.userId);
      if (!canManageDepartment(req.userRole, managed, existingRoom.departmentId)) {
        return res.status(403).json({ error: trReq(req, 'manageOwnRooms') });
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
        error: trReq(req, 'roomHasActiveBookingsCount', { count: activeBookingsCount })
      });
    }

    // Delete all bookings associated with this room first (including CANCELLED and COMPLETED)
    // This is necessary because there is no CASCADE delete on the database schema
    const removedBookings = await prisma.booking.deleteMany({
      where: { roomId: req.params.id }
    });

    // Delete room
    await prisma.room.delete({
      where: { id: req.params.id },
    });

    // Deleting a room silently destroys its whole booking history - record how much
    await recordAudit(req, {
      action: 'ROOM_DELETE',
      targetType: 'Room',
      targetId: existingRoom.id,
      targetLabel: existingRoom.name,
      departmentId: existingRoom.departmentId,
      summary: `Deleted room "${existingRoom.name}" and ${removedBookings.count} booking record(s)`,
      metadata: { deletedBookings: removedBookings.count },
    });

    res.json({ message: trReq(req, 'roomDeleted') });
  } catch (error) {
    console.error('Delete room error:', error);
    res.status(500).json({ error: trReq(req, 'deleteRoomFailed') });
  }
});

export { router as roomRouter };
