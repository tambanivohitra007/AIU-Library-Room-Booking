import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { authenticateToken, requireAdmin, requireAdminOrWorker, AuthRequest } from '../middleware/auth.js';
import { trReq } from '../services/i18n.js';
import { recordAudit } from '../services/audit.js';

const router = Router();
const prisma = new PrismaClient();

const DEFAULT_PASSWORD = 'Password123!';

// Appointing or managing privileged accounts is reserved for super admins
const PRIVILEGED_ROLES = ['ADMIN', 'SUPERADMIN'];
const isPrivileged = (role: string | null | undefined) => !!role && PRIVILEGED_ROLES.includes(role);

// All user routes require authentication
router.use(authenticateToken);

// Never expose password hashes
const userSelect = {
  id: true,
  email: true,
  name: true,
  provider: true,
  role: true,
  status: true,
  avatarUrl: true,
  createdAt: true,
  // Department management is a grant, not a role, so it is invisible in `role`.
  // Ship it alongside so admin screens can show who manages what.
  managedDepartments: {
    select: { department: { select: { id: true, name: true } } },
  },
};

// Flatten the DepartmentAdmin join rows to plain { id, name } departments
const shapeUser = (user: any) => ({
  ...user,
  managedDepartments: (user.managedDepartments || []).map(
    (m: any) => m.department,
  ),
});

// Get all users
router.get('/', requireAdminOrWorker, async (req, res) => {
  try {
    const users = await prisma.user.findMany({ select: userSelect });
    res.json(users.map(shapeUser));
  } catch (error) {
    res.status(500).json({ error: trReq(req, 'fetchUsersFailed') });
  }
});

// Save the caller's language preference (used for notification emails).
// Must be registered before /:id so "me" is not treated as a user id.
router.put('/me/language', async (req: AuthRequest, res) => {
  try {
    const { language } = req.body;
    if (language !== 'en' && language !== 'th') {
      return res.status(400).json({ error: trReq(req, 'unsupportedLanguage') });
    }
    await prisma.user.update({
      where: { id: req.userId },
      data: { language },
    });
    res.json({ language });
  } catch (error) {
    res.status(500).json({ error: trReq(req, 'saveLanguageFailed') });
  }
});

// Get user by ID
router.get('/:id', requireAdminOrWorker, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: userSelect,
    });
    if (!user) {
      return res.status(404).json({ error: trReq(req, 'userNotFound') });
    }
    res.json(shapeUser(user));
  } catch (error) {
    res.status(500).json({ error: trReq(req, 'fetchUserFailed') });
  }
});

// Create user
router.post('/', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({ error: trReq(req, 'userFieldsRequired') });
    }

    if (isPrivileged(role) && req.userRole !== 'SUPERADMIN') {
      return res.status(403).json({ error: trReq(req, 'superAdminCreateAdmin') });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ error: trReq(req, 'userEmailExists') });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role || 'STUDENT',
      },
    });

    await recordAudit(req, {
      action: 'USER_CREATE',
      targetType: 'User',
      targetId: user.id,
      targetLabel: user.email,
      summary: `Created user ${user.email} with role ${user.role}`,
      metadata: { role: user.role },
    });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;
    res.status(201).json(userWithoutPassword);
  } catch (error: any) {
    res.status(500).json({ error: trReq(req, 'createUserFailed'), details: error.message });
  }
});

// Bulk import users
router.post('/import', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { users } = req.body;
    
    if (!Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ error: trReq(req, 'invalidUsersData') });
    }

    const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    const results = {
      success: [] as any[],
      failed: [] as any[],
    };

    for (const userData of users) {
      try {
        // Validate required fields
        if (!userData.email || !userData.name) {
          results.failed.push({
            email: userData.email || 'unknown',
            reason: 'Missing required fields (email or name)',
          });
          continue;
        }

        if (isPrivileged(userData.role) && req.userRole !== 'SUPERADMIN') {
          results.failed.push({
            email: userData.email,
            reason: 'Only a super admin can import admin accounts',
          });
          continue;
        }

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
          where: { email: userData.email },
        });

        if (existingUser) {
          results.failed.push({
            email: userData.email,
            reason: 'User with this email already exists',
          });
          continue;
        }

        // Create new user with default password
        const newUser = await prisma.user.create({
          data: {
            email: userData.email,
            name: userData.name,
            password: hashedPassword,
            role: userData.role || 'STUDENT',
          },
        });

        results.success.push({
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
        });
      } catch (error: any) {
        results.failed.push({
          email: userData.email || 'unknown',
          reason: error.message || 'Unknown error',
        });
      }
    }

    await recordAudit(req, {
      action: 'USER_IMPORT',
      targetType: 'User',
      targetLabel: `${results.success.length} user(s)`,
      summary: `Imported ${results.success.length} user(s), ${results.failed.length} failed`,
      metadata: { succeeded: results.success.length, failed: results.failed.length },
    });

    res.status(200).json({
      message: trReq(req, 'importCompleted', {
        success: results.success.length,
        failed: results.failed.length,
      }),
      defaultPassword: DEFAULT_PASSWORD,
      results,
    });
  } catch (error: any) {
    res.status(500).json({ error: trReq(req, 'importUsersFailed'), details: error.message });
  }
});

// Update user
router.put('/:id', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, password, status } = req.body;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return res.status(404).json({ error: trReq(req, 'userNotFound') });
    }

    // Only super admins may grant privileged roles or modify privileged accounts
    if ((isPrivileged(role) || isPrivileged(existingUser.role)) && req.userRole !== 'SUPERADMIN') {
      return res.status(403).json({ error: trReq(req, 'superAdminManageAdmin') });
    }

    // If email is being changed, check if new email is already in use
    if (email && email !== existingUser.email) {
      const emailInUse = await prisma.user.findUnique({
        where: { email },
      });

      if (emailInUse) {
        return res.status(400).json({ error: trReq(req, 'emailInUse') });
      }
    }

    // Prepare update data
    const updateData: any = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (role) updateData.role = role;
    if (status) updateData.status = status;
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
    });

    const roleChanged = existingUser.role !== updatedUser.role;
    const statusChanged = existingUser.status !== updatedUser.status;
    await recordAudit(req, {
      action: roleChanged
        ? 'USER_ROLE_CHANGE'
        : statusChanged
          ? 'USER_STATUS_CHANGE'
          : 'USER_UPDATE',
      targetType: 'User',
      targetId: updatedUser.id,
      targetLabel: updatedUser.email,
      summary: roleChanged
        ? `Changed role of ${updatedUser.email}: ${existingUser.role} -> ${updatedUser.role}`
        : statusChanged
          ? `Changed status of ${updatedUser.email}: ${existingUser.status} -> ${updatedUser.status}`
          : `Updated account ${updatedUser.email}`,
      metadata: {
        roleFrom: roleChanged ? existingUser.role : undefined,
        roleTo: roleChanged ? updatedUser.role : undefined,
        statusFrom: statusChanged ? existingUser.status : undefined,
        statusTo: statusChanged ? updatedUser.status : undefined,
        passwordReset: req.body.password ? true : undefined,
      },
    });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = updatedUser;
    res.json(userWithoutPassword);
  } catch (error: any) {
    res.status(500).json({ error: trReq(req, 'updateUserFailed'), details: error.message });
  }
});

// Delete user
router.delete('/:id', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return res.status(404).json({ error: trReq(req, 'userNotFound') });
    }

    if (isPrivileged(user.role) && req.userRole !== 'SUPERADMIN') {
      return res.status(403).json({ error: trReq(req, 'superAdminDeleteAdmin') });
    }

    // Delete user (this will cascade delete their bookings due to foreign key)
    const lostBookings = await prisma.booking.count({ where: { userId: id } });
    await prisma.user.delete({
      where: { id },
    });

    await recordAudit(req, {
      action: 'USER_DELETE',
      targetType: 'User',
      targetId: id,
      targetLabel: user.email,
      summary: `Deleted user ${user.email} (${user.role}) and ${lostBookings} booking(s)`,
      metadata: { role: user.role, cascadedBookings: lostBookings },
    });

    res.json({ message: trReq(req, 'userDeleted') });
  } catch (error: any) {
    res.status(500).json({ error: trReq(req, 'deleteUserFailed'), details: error.message });
  }
});

export { router as userRouter };
