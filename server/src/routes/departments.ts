import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth.js';
import { parseOperatingHoursJson } from '../services/settings.js';
import logger from '../utils/logger.js';

const router = Router();
const prisma = new PrismaClient();

// Get all departments (public, like rooms)
router.get('/', async (req, res) => {
  try {
    const departments = await prisma.department.findMany({
      include: { _count: { select: { rooms: true } } },
      orderBy: { name: 'asc' },
    });

    res.json(departments.map((d: any) => ({
      id: d.id,
      name: d.name,
      contactEmail: d.contactEmail,
      operatingHours: d.operatingHours,
      roomCount: d._count.rooms,
    })));
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

// Create department (admin only)
router.post('/', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { name, contactEmail, operatingHours } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Department name is required' });
    }

    if (operatingHours && !parseOperatingHoursJson(operatingHours)) {
      return res.status(400).json({ error: 'Invalid operating hours format' });
    }

    const department = await prisma.department.create({
      data: {
        name: name.trim(),
        contactEmail: contactEmail || null,
        operatingHours: operatingHours || null,
      },
    });

    res.status(201).json(department);
  } catch (error) {
    console.error('Create department error:', error);
    res.status(500).json({ error: 'Failed to create department' });
  }
});

// Update department (admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { name, contactEmail, operatingHours } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Department name is required' });
    }

    if (operatingHours && !parseOperatingHoursJson(operatingHours)) {
      return res.status(400).json({ error: 'Invalid operating hours format' });
    }

    const existing = await prisma.department.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: 'Department not found' });
    }

    const department = await prisma.department.update({
      where: { id: req.params.id },
      data: {
        name: name.trim(),
        contactEmail: contactEmail || null,
        operatingHours: operatingHours || null,
      },
    });

    res.json(department);
  } catch (error) {
    console.error('Update department error:', error);
    res.status(500).json({ error: 'Failed to update department' });
  }
});

// Delete department (admin only). Rooms are kept and become unassigned (onDelete: SetNull).
router.delete('/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.department.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: 'Department not found' });
    }

    await prisma.department.delete({ where: { id: req.params.id } });

    logger.info(`Department ${existing.name} deleted by user ${req.userId}`);
    res.json({ message: 'Department deleted successfully. Its rooms are now unassigned.' });
  } catch (error) {
    console.error('Delete department error:', error);
    res.status(500).json({ error: 'Failed to delete department' });
  }
});

export { router as departmentRouter };
