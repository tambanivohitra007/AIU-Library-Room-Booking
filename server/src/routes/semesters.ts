import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireAdmin, requireAdminOrWorker, AuthRequest } from '../middleware/auth.js';
import { body } from 'express-validator';
import { handleValidationErrors } from '../middleware/validation.js';
import logger from '../utils/logger.js';
import { trReq } from '../services/i18n.js';
import { recordAudit } from '../services/audit.js';

const router = Router();
const prisma = new PrismaClient();

// Get active semester (Public or Authenticated)
router.get('/active', async (req, res) => {
  try {
    const activeSemester = await prisma.semester.findFirst({
      where: { isActive: true },
    });
    res.json(activeSemester);
  } catch (error) {
    logger.error('Error fetching active semester:', error);
    res.status(500).json({ error: trReq(req, 'fetchActiveSemesterFailed') });
  }
});

// ===== ADMIN ROUTES =====
router.use(authenticateToken);

// Get all semesters
router.get('/', requireAdminOrWorker, async (req: AuthRequest, res) => {
  try {
    const semesters = await prisma.semester.findMany({
      orderBy: { startDate: 'desc' },
    });
    res.json(semesters);
  } catch (error) {
    logger.error('Error fetching semesters:', error);
    res.status(500).json({ error: trReq(req, 'fetchSemestersFailed') });
  }
});

// Create semester
router.post('/', [
  requireAdmin,
  body('name').notEmpty().trim(),
  body('startDate').isISO8601(),
  body('endDate').isISO8601(),
  handleValidationErrors,
], async (req: AuthRequest, res: Response) => {
  try {
    const { name, startDate, endDate, isActive } = req.body;

    // Use a transaction if we are setting it as active, to unset others
    const semester = await prisma.$transaction(async (tx) => {
        if (isActive) {
            await tx.semester.updateMany({
                where: { isActive: true },
                data: { isActive: false }
            });
        }
        
        return await tx.semester.create({
            data: {
                name,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                isActive: isActive || false,
            }
        });
    });

    logger.info(`Semester created: ${semester.name} by ${req.userId}`);
    await recordAudit(req, {
      action: 'SEMESTER_CREATE',
      targetType: 'Semester',
      targetId: semester.id,
      targetLabel: semester.name,
      summary: `Created semester "${semester.name}"${semester.isActive ? ' (active)' : ''}`,
      metadata: {
        from: semester.startDate.toISOString().slice(0, 10),
        to: semester.endDate.toISOString().slice(0, 10),
        isActive: semester.isActive,
      },
    });

    res.status(201).json(semester);
  } catch (error) {
    logger.error('Error creating semester:', error);
    res.status(500).json({ error: trReq(req, 'createSemesterFailed') });
  }
});

// Update semester
router.put('/:id', [
  requireAdmin,
  body('name').optional().notEmpty().trim(),
  body('startDate').optional().isISO8601(),
  body('endDate').optional().isISO8601(),
  handleValidationErrors,
], async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, startDate, endDate, isActive } = req.body;

    const semester = await prisma.$transaction(async (tx) => {
        // If setting to active, deactivate others
        if (isActive === true) {
            await tx.semester.updateMany({
                where: { id: { not: id }, isActive: true },
                data: { isActive: false }
            });
        }
        
        return await tx.semester.update({
            where: { id },
            data: {
                name,
                ...(startDate && { startDate: new Date(startDate) }),
                ...(endDate && { endDate: new Date(endDate) }),
                ...(isActive !== undefined && { isActive }),
            }
        });
    });

    logger.info(`Semester updated: ${semester.name} by ${req.userId}`);
    await recordAudit(req, {
      action: 'SEMESTER_UPDATE',
      targetType: 'Semester',
      targetId: semester.id,
      targetLabel: semester.name,
      // Activating a semester silently changes which dates everyone can book
      summary: `Updated semester "${semester.name}"${semester.isActive ? ' (now active)' : ''}`,
      metadata: {
        from: semester.startDate.toISOString().slice(0, 10),
        to: semester.endDate.toISOString().slice(0, 10),
        isActive: semester.isActive,
      },
    });

    res.json(semester);
  } catch (error) {
    logger.error('Error updating semester:', error);
    res.status(500).json({ error: trReq(req, 'updateSemesterFailed') });
  }
});

// Delete semester
router.delete('/:id', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    // Read it before deleting so the trail can name what disappeared
    const existing = await prisma.semester.findUnique({ where: { id } });
    await prisma.semester.delete({ where: { id } });
    logger.info(`Semester deleted: ${id} by ${req.userId}`);
    await recordAudit(req, {
      action: 'SEMESTER_DELETE',
      targetType: 'Semester',
      targetId: id,
      targetLabel: existing?.name ?? id,
      summary: `Deleted semester "${existing?.name ?? id}"`,
      metadata: existing ? { wasActive: existing.isActive } : undefined,
    });
    res.json({ message: trReq(req, 'semesterDeleted') });
  } catch (error) {
    logger.error('Error deleting semester:', error);
    res.status(500).json({ error: trReq(req, 'deleteSemesterFailed') });
  }
});

export const semesterRouter = router;
