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
    const user = await prisma.user.create({
      data: req.body,
    });
    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create user' });
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

export { router as userRouter };
