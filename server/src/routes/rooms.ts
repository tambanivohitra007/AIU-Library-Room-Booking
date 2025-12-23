import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

// Get all rooms
router.get('/', async (req, res) => {
  try {
    const rooms = await prisma.room.findMany();
    // Parse features JSON string to array
    const roomsWithParsedFeatures = rooms.map(room => ({
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

// Create new room (admin only)
router.post('/', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { name, description, capacity, features } = req.body;

    if (!name || !description || !capacity) {
      return res.status(400).json({ error: 'Name, description, and capacity are required' });
    }

    if (capacity < 1) {
      return res.status(400).json({ error: 'Capacity must be at least 1' });
    }

    // Create room with features as JSON string
    const room = await prisma.room.create({
      data: {
        name,
        description,
        capacity: parseInt(capacity),
        features: JSON.stringify(features || []),
      },
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

// Update room (admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { name, description, capacity, features } = req.body;

    if (!name || !description || !capacity) {
      return res.status(400).json({ error: 'Name, description, and capacity are required' });
    }

    if (capacity < 1) {
      return res.status(400).json({ error: 'Capacity must be at least 1' });
    }

    // Check if room exists
    const existingRoom = await prisma.room.findUnique({
      where: { id: req.params.id },
    });

    if (!existingRoom) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Update room
    const room = await prisma.room.update({
      where: { id: req.params.id },
      data: {
        name,
        description,
        capacity: parseInt(capacity),
        features: JSON.stringify(features || []),
      },
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

// Delete room (admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    // Check if room exists
    const existingRoom = await prisma.room.findUnique({
      where: { id: req.params.id },
    });

    if (!existingRoom) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Check if there are any bookings for this room
    const bookingsCount = await prisma.booking.count({
      where: { roomId: req.params.id },
    });

    if (bookingsCount > 0) {
      return res.status(400).json({
        error: `Cannot delete room with existing bookings. This room has ${bookingsCount} booking(s).`
      });
    }

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
