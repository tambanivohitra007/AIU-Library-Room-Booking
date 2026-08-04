import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Departments the user manages via DepartmentAdmin assignments
export const getManagedDepartmentIds = async (userId: string | undefined): Promise<string[]> => {
  if (!userId) return [];
  const rows = await prisma.departmentAdmin.findMany({
    where: { userId },
    select: { departmentId: true },
  });
  return rows.map((r) => r.departmentId);
};

export const isGlobalAdmin = (role: string | undefined): boolean =>
  role === 'ADMIN' || role === 'SUPERADMIN';

// Roles with unrestricted operational visibility: they may see every booking's
// details and moderate anywhere.
//
// This is deliberately an ALLOWLIST. Asking "is this user a student?" instead
// silently promotes every base role added later - FACULTY was exposed that way,
// seeing every booker's name, email and attendees system-wide. Anyone not named
// here sees only their own bookings plus the departments they were granted.
export const isStaff = (role: string | undefined): boolean =>
  isGlobalAdmin(role) || role === 'STUDENT_WORKER';

// Global admins manage everything; department admins manage only their departments
export const canManageDepartment = (
  role: string | undefined,
  managedDepartmentIds: string[],
  departmentId: string | null | undefined
): boolean => {
  if (isGlobalAdmin(role)) return true;
  return !!departmentId && managedDepartmentIds.includes(departmentId);
};
