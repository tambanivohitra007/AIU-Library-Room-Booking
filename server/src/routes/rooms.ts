import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

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

export { router as roomRouter };
