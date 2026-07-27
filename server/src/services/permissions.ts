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

// Global admins manage everything; department admins manage only their departments
export const canManageDepartment = (
  role: string | undefined,
  managedDepartmentIds: string[],
  departmentId: string | null | undefined
): boolean => {
  if (role === 'ADMIN') return true;
  return !!departmentId && managedDepartmentIds.includes(departmentId);
};
