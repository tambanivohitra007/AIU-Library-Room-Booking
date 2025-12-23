import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const router = Router();
const prisma = new PrismaClient();

const DEFAULT_PASSWORD = 'Password123!';

// Get all users
router.get('/', async (req, res) => {
  try {
    const users = await prisma.user.findMany();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get user by ID
router.get('/:id', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
    });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Create user
router.post('/', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
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

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;
    res.status(201).json(userWithoutPassword);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create user', details: error.message });
  }
});

// Bulk import users
router.post('/import', async (req, res) => {
  try {
    const { users } = req.body;
    
    if (!Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ error: 'Invalid users data. Expected an array of users.' });
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

    res.status(200).json({
      message: `Import completed: ${results.success.length} successful, ${results.failed.length} failed`,
      defaultPassword: DEFAULT_PASSWORD,
      results,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to import users', details: error.message });
  }
});

// Update user
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, password } = req.body;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // If email is being changed, check if new email is already in use
    if (email && email !== existingUser.email) {
      const emailInUse = await prisma.user.findUnique({
        where: { email },
      });

      if (emailInUse) {
        return res.status(400).json({ error: 'Email already in use' });
      }
    }

    // Prepare update data
    const updateData: any = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (role) updateData.role = role;
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
    });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = updatedUser;
    res.json(userWithoutPassword);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update user', details: error.message });
  }
});

// Delete user
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Delete user (this will cascade delete their bookings due to foreign key)
    await prisma.user.delete({
      where: { id },
    });

    res.json({ message: 'User deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete user', details: error.message });
  }
});

export { router as userRouter };
