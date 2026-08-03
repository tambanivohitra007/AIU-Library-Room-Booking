import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth.js';
import logger from '../utils/logger.js';

const prisma = new PrismaClient();

// Every privileged action worth answering "who did this?" about.
export type AuditAction =
  // Bookings
  | 'BOOKING_APPROVE'
  | 'BOOKING_REJECT'
  | 'BOOKING_CANCEL'
  | 'BOOKING_REMIND'
  | 'BOOKING_AUTO_CANCEL'
  | 'BOOKING_AUTO_COMPLETE'
  // Rooms
  | 'ROOM_CREATE'
  | 'ROOM_UPDATE'
  | 'ROOM_DELETE'
  // Departments
  | 'DEPARTMENT_CREATE'
  | 'DEPARTMENT_UPDATE'
  | 'DEPARTMENT_DELETE'
  | 'DEPARTMENT_MANAGERS_UPDATE'
  // Closures
  | 'CLOSURE_CREATE'
  | 'CLOSURE_UPDATE'
  | 'CLOSURE_DELETE'
  // Semesters
  | 'SEMESTER_CREATE'
  | 'SEMESTER_UPDATE'
  | 'SEMESTER_DELETE'
  // Users
  | 'USER_CREATE'
  | 'USER_UPDATE'
  | 'USER_DELETE'
  | 'USER_IMPORT'
  | 'USER_ROLE_CHANGE'
  | 'USER_STATUS_CHANGE'
  // Platform
  | 'SETTINGS_UPDATE';

export type AuditTargetType =
  | 'Booking'
  | 'Room'
  | 'Department'
  | 'ScheduleException'
  | 'Semester'
  | 'User'
  | 'ServiceSettings';

export interface AuditEntry {
  action: AuditAction;
  targetType: AuditTargetType;
  targetId?: string | null;
  /** Human-readable identity captured AT THE TIME, so later renames don't rewrite history */
  targetLabel?: string | null;
  /** Lets a department admin see their own trail; null = service-wide */
  departmentId?: string | null;
  summary?: string | null;
  metadata?: Record<string, unknown> | null;
}

// MySQL maps Prisma String to VARCHAR(191); keep free text inside that.
const CAP = 190;
const clip = (s: string | null | undefined): string | null => {
  if (s === null || s === undefined) return null;
  return s.length > CAP ? `${s.slice(0, CAP - 1)}…` : s;
};

const serialiseMetadata = (meta: Record<string, unknown> | null | undefined): string | null => {
  if (!meta) return null;
  try {
    return clip(JSON.stringify(meta));
  } catch {
    return null;
  }
};

// An audit write must NEVER fail the operation it is describing. A failed insert
// is logged and swallowed - losing one trail row is bad, but rolling back a
// legitimate approval because of it is worse.
const persist = async (data: Parameters<typeof prisma.auditLog.create>[0]['data']) => {
  try {
    await prisma.auditLog.create({ data });
  } catch (error) {
    logger.error('Failed to write audit log entry', { error, action: data.action });
  }
};

/** Record an action performed by an authenticated user. */
export const recordAudit = async (req: AuthRequest, entry: AuditEntry): Promise<void> => {
  await persist({
    actorId: req.userId ?? null,
    actorEmail: clip(req.userEmail) ?? 'unknown',
    actorName: clip(req.userName) ?? 'Unknown',
    actorRole: req.userRole ?? 'UNKNOWN',
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId ?? null,
    targetLabel: clip(entry.targetLabel),
    departmentId: entry.departmentId ?? null,
    summary: clip(entry.summary),
    metadata: serialiseMetadata(entry.metadata),
  });
};

/** Record an action performed by the server itself (e.g. the booking scheduler). */
export const recordSystemAudit = async (entry: AuditEntry): Promise<void> => {
  await persist({
    actorId: null,
    actorEmail: 'system',
    actorName: 'System',
    actorRole: 'SYSTEM',
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId ?? null,
    targetLabel: clip(entry.targetLabel),
    departmentId: entry.departmentId ?? null,
    summary: clip(entry.summary),
    metadata: serialiseMetadata(entry.metadata),
  });
};
