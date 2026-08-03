import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { getManagedDepartmentIds, isGlobalAdmin } from '../services/permissions.js';
import { recordAudit } from '../services/audit.js';
import logger from '../utils/logger.js';
import { trReq } from '../services/i18n.js';

const router = Router();
const prisma = new PrismaClient();

// Validate the shared fields; returns an error string or null
const validateBody = (body: any): string | null => {
  const { name, startDate, endDate, closed, openHour, closeHour } = body;
  if (!name || !String(name).trim()) return 'Name is required';
  const s = new Date(startDate);
  const e = new Date(endDate);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return 'Valid start and end dates are required';
  if (e < s) return 'End date must not be before the start date';
  if (closed === false) {
    if (
      !Number.isInteger(openHour) ||
      !Number.isInteger(closeHour) ||
      openHour < 0 ||
      closeHour > 24 ||
      openHour >= closeHour
    ) {
      return 'Special hours need an opening time before the closing time (0-24)';
    }
  }
  return null;
};

// May this user manage an exception scoped to the given department?
const canManage = async (
  req: AuthRequest,
  departmentId: string | null
): Promise<boolean> => {
  if (isGlobalAdmin(req.userRole)) return true;
  if (departmentId === null) return false; // service-wide entries are admin-only
  const managed = await getManagedDepartmentIds(req.userId);
  return managed.includes(departmentId);
};

// List all exceptions (public: the calendar needs them to draw closed days)
router.get('/', async (req, res) => {
  try {
    const exceptions = await prisma.scheduleException.findMany({
      include: { department: { select: { id: true, name: true } } },
      orderBy: { startDate: 'asc' },
    });
    res.json(exceptions);
  } catch (error) {
    console.error('Error fetching schedule exceptions:', error);
    res.status(500).json({ error: trReq(req, 'fetchClosuresFailed') });
  }
});

// Create (global admin, or a department manager for their own department)
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const validationError = validateBody(req.body);
    if (validationError) return res.status(400).json({ error: validationError });

    const departmentId = req.body.departmentId || null;
    if (!(await canManage(req, departmentId))) {
      return res.status(403).json({ error: trReq(req, 'createOwnClosures') });
    }
    if (departmentId) {
      const dept = await prisma.department.findUnique({ where: { id: departmentId } });
      if (!dept) return res.status(400).json({ error: trReq(req, 'departmentNotFound') });
    }

    const closed = req.body.closed !== false;
    const exception = await prisma.scheduleException.create({
      data: {
        name: String(req.body.name).trim(),
        startDate: new Date(req.body.startDate),
        endDate: new Date(req.body.endDate),
        closed,
        openHour: closed ? null : req.body.openHour,
        closeHour: closed ? null : req.body.closeHour,
        departmentId,
      },
      include: { department: { select: { id: true, name: true } } },
    });

    logger.info(`Schedule exception "${exception.name}" created by user ${req.userId}`);
    await recordAudit(req, {
      action: 'CLOSURE_CREATE',
      targetType: 'ScheduleException',
      targetId: exception.id,
      targetLabel: exception.name,
      departmentId: exception.departmentId,
      summary: exception.closed
        ? `Created closure "${exception.name}"`
        : `Created special hours "${exception.name}"`,
      metadata: {
        from: exception.startDate.toISOString().slice(0, 10),
        to: exception.endDate.toISOString().slice(0, 10),
        scope: exception.departmentId ? 'department' : 'service-wide',
      },
    });

    res.status(201).json(exception);
  } catch (error) {
    console.error('Create schedule exception error:', error);
    res.status(500).json({ error: trReq(req, 'createClosureFailed') });
  }
});

// Update (same scoping as create, for both the current and the new scope)
router.put('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.scheduleException.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) return res.status(404).json({ error: trReq(req, 'closureNotFound') });

    const validationError = validateBody(req.body);
    if (validationError) return res.status(400).json({ error: validationError });

    const departmentId = req.body.departmentId || null;
    if (!(await canManage(req, existing.departmentId)) || !(await canManage(req, departmentId))) {
      return res.status(403).json({ error: trReq(req, 'manageOwnClosures') });
    }

    const closed = req.body.closed !== false;
    const exception = await prisma.scheduleException.update({
      where: { id: req.params.id },
      data: {
        name: String(req.body.name).trim(),
        startDate: new Date(req.body.startDate),
        endDate: new Date(req.body.endDate),
        closed,
        openHour: closed ? null : req.body.openHour,
        closeHour: closed ? null : req.body.closeHour,
        departmentId,
      },
      include: { department: { select: { id: true, name: true } } },
    });

    await recordAudit(req, {
      action: 'CLOSURE_UPDATE',
      targetType: 'ScheduleException',
      targetId: exception.id,
      targetLabel: exception.name,
      departmentId: exception.departmentId,
      summary: `Updated closure "${exception.name}"`,
      metadata: {
        from: exception.startDate.toISOString().slice(0, 10),
        to: exception.endDate.toISOString().slice(0, 10),
      },
    });

    res.json(exception);
  } catch (error) {
    console.error('Update schedule exception error:', error);
    res.status(500).json({ error: trReq(req, 'updateClosureFailed') });
  }
});

// Delete
router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.scheduleException.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) return res.status(404).json({ error: trReq(req, 'closureNotFound') });

    if (!(await canManage(req, existing.departmentId))) {
      return res.status(403).json({ error: trReq(req, 'manageOwnClosures') });
    }

    await prisma.scheduleException.delete({ where: { id: req.params.id } });

    await recordAudit(req, {
      action: 'CLOSURE_DELETE',
      targetType: 'ScheduleException',
      targetId: existing.id,
      targetLabel: existing.name,
      departmentId: existing.departmentId,
      summary: `Deleted closure "${existing.name}"`,
    });
    logger.info(`Schedule exception "${existing.name}" deleted by user ${req.userId}`);
    res.json({ message: trReq(req, 'closureDeleted') });
  } catch (error) {
    console.error('Delete schedule exception error:', error);
    res.status(500).json({ error: trReq(req, 'deleteClosureFailed') });
  }
});

export { router as scheduleExceptionRouter };
