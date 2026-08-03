import { Router } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { getManagedDepartmentIds, isGlobalAdmin } from '../services/permissions.js';
import { trReq } from '../services/i18n.js';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

const MAX_PAGE_SIZE = 200;

// Read-only trail. There is deliberately no write, update or delete endpoint:
// an audit log you can edit from the app is not an audit log.
router.get('/', async (req: AuthRequest, res) => {
  try {
    const managed = await getManagedDepartmentIds(req.userId);
    const globalAdmin = isGlobalAdmin(req.userRole);

    // Global admins see everything; a department admin sees only entries scoped to
    // a department they manage. Anyone else has no business here.
    if (!globalAdmin && managed.length === 0) {
      return res.status(403).json({ error: trReq(req, 'permissionDenied') });
    }

    const { action, targetType, actorId, departmentId, from, to } = req.query;
    const take = Math.min(
      Math.max(parseInt(String(req.query.limit ?? '50'), 10) || 50, 1),
      MAX_PAGE_SIZE,
    );
    const skip = Math.max(parseInt(String(req.query.offset ?? '0'), 10) || 0, 0);

    const where: Prisma.AuditLogWhereInput = {};

    if (!globalAdmin) {
      // Scoped users never see service-wide (departmentId null) entries
      where.departmentId = { in: managed };
    } else if (typeof departmentId === 'string' && departmentId) {
      where.departmentId = departmentId;
    }

    if (typeof action === 'string' && action) where.action = action;
    if (typeof targetType === 'string' && targetType) where.targetType = targetType;
    if (typeof actorId === 'string' && actorId) where.actorId = actorId;

    if (typeof from === 'string' && from) {
      const d = new Date(from);
      if (!isNaN(d.getTime())) {
        d.setHours(0, 0, 0, 0);
        where.createdAt = { ...(where.createdAt as object), gte: d };
      }
    }
    if (typeof to === 'string' && to) {
      const d = new Date(to);
      if (!isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        where.createdAt = { ...(where.createdAt as object), lte: d };
      }
    }

    const [entries, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      prisma.auditLog.count({ where }),
    ]);

    // Resolve department names for display without a relation on the model
    const deptIds = [...new Set(entries.map((e) => e.departmentId).filter(Boolean))] as string[];
    const departments = deptIds.length
      ? await prisma.department.findMany({
          where: { id: { in: deptIds } },
          select: { id: true, name: true },
        })
      : [];
    const deptName = new Map(departments.map((d) => [d.id, d.name]));

    res.json({
      total,
      limit: take,
      offset: skip,
      entries: entries.map((e) => ({
        ...e,
        departmentName: e.departmentId ? deptName.get(e.departmentId) ?? null : null,
        metadata: e.metadata ? safeParse(e.metadata) : null,
        createdAt: e.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Fetch audit log error:', error);
    res.status(500).json({ error: trReq(req, 'fetchAuditFailed') });
  }
});

const safeParse = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
};

export { router as auditRouter };
