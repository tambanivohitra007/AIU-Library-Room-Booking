import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { generateToken, authenticateToken, AuthRequest } from '../middleware/auth.js';
import { authLimiter } from '../middleware/security.js';
import { validateRegister, validateLogin } from '../middleware/validation.js';
import logger from '../utils/logger.js';
import { ADMIN_EMAILS } from '../config/admins.js';

const router = Router();
const prisma = new PrismaClient();

// Allowed email domains
const STUDENT_DOMAIN = '@my.apiu.edu';
const STAFF_DOMAIN = '@apiu.edu';

// --- Microsoft SSO Routes ---

// 1. Get the Microsoft Login URL
router.get('/microsoft/url', (req: Request, res: Response) => {
  const customRedirectUri = req.query.redirect_uri as string; // Optional: allow frontend to specify redirect URI (useful for local dev vs prod)

  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const redirectUri = customRedirectUri || process.env.AZURE_REDIRECT_URI;

  if (!tenantId || !clientId || !redirectUri) {
    logger.error('Missing Microsoft SSO configuration');
    return res.status(500).json({ error: 'Server SSO configuration is missing (Tenant ID, Client ID, or Redirect URI)' });
  }

  // Construct the authorization URL
  // Scopes: User.Read (to get profile), email (to get email), openid (for id_token), offline_access (for refresh token if needed)
  const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&response_mode=query&scope=User.Read openid profile email offline_access`;

  res.json({ url });
});

// 2. Handle the Callback (Exchange code for User)
router.post('/microsoft/login', async (req: Request, res: Response) => {
  try {
    const { code, redirectUri: clientRedirectUri } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    const tenantId = process.env.AZURE_TENANT_ID;
    const clientId = process.env.AZURE_CLIENT_ID;
    const clientSecret = process.env.AZURE_CLIENT_SECRET;
    const redirectUri = clientRedirectUri || process.env.AZURE_REDIRECT_URI;

    if (!tenantId || !clientId || !clientSecret || !redirectUri) {
      return res.status(500).json({ error: 'Server SSO configuration is missing' });
    }

    // A. Exchange Auth Code for Access Token
    const tokenParams = new URLSearchParams();
    tokenParams.append('client_id', clientId);
    tokenParams.append('scope', 'User.Read openid profile email offline_access');
    tokenParams.append('code', code);
    tokenParams.append('redirect_uri', redirectUri);
    tokenParams.append('grant_type', 'authorization_code');
    tokenParams.append('client_secret', clientSecret);

    const tokenResponse = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams.toString(),
    });

    const tokenData = await tokenResponse.json() as any;

    if (!tokenResponse.ok) {
      logger.error('Microsoft Token Exchange Failed:', tokenData);
      return res.status(401).json({ error: 'Failed to authenticate with Microsoft', details: tokenData.error_description });
    }

    const { access_token } = tokenData;

    // B. Get User Profile from Microsoft Graph
    const graphResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    const graphData = await graphResponse.json() as any;

    if (!graphResponse.ok) {
       logger.error('Microsoft Graph Fetch Failed:', graphData);
       return res.status(401).json({ error: 'Failed to fetch user profile from Microsoft' });
    }

    // C. Validate Email Domain
    // Microsoft Graph returns 'mail' or 'userPrincipalName'
    const email = (graphData.mail || graphData.userPrincipalName)?.toLowerCase();
    const name = graphData.displayName || graphData.givenName;

    if (!email) {
      return res.status(400).json({ error: 'Could not retrieve email from Microsoft account' });
    }

    const isStudentEmail = email.endsWith(STUDENT_DOMAIN);
    const isStaffEmail = email.endsWith(STAFF_DOMAIN);

    // Strict Domain Check
    if (!isStudentEmail && !isStaffEmail) {
       return res.status(403).json({ 
         error: `Access restricted. Please use your ${STUDENT_DOMAIN} or ${STAFF_DOMAIN} account.` 
       });
    }

    // D. Find or Create User in Database
    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Create new user (No password)
      const isAdmin = ADMIN_EMAILS.includes(email);
      
      user = await prisma.user.create({
        data: {
          email,
          name: name || 'Microsoft User',
          provider: 'MICROSOFT',
          role: isAdmin ? 'ADMIN' : 'STUDENT',
        },
      });
      logger.info(`New SSO user created: ${email} (Role: ${isAdmin ? 'ADMIN' : 'STUDENT'})`);
    } else {
      // Update provider if switching from LOCAL (optional, or just allow login)
      if (user.provider === 'LOCAL') {
         // Maybe update to LINKED or just allow.
         // Let's update provider to note they used SSO
         await prisma.user.update({
             where: { id: user.id },
             data: { provider: 'MICROSOFT' }
         });
      }
    }

    // E. Generate App Session Token
    const token = generateToken(user.id, user.role);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        provider: user.provider,
      },
    });

  } catch (error) {
    logger.error('Microsoft Login Error:', error);
    res.status(500).json({ error: 'Internal server error during SSO login' });
  }
});

// Register new user (student only - admins created manually)
router.post('/register', authLimiter, validateRegister, async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    // Validate email domain
    const emailLower = email.toLowerCase();
    const isStudentEmail = emailLower.endsWith(STUDENT_DOMAIN);
    const isStaffEmail = emailLower.endsWith(STAFF_DOMAIN);

    if (!isStudentEmail && !isStaffEmail) {
      return res.status(400).json({ 
        error: `Only university emails are allowed. Students must use ${STUDENT_DOMAIN} and staff must use ${STAFF_DOMAIN}` 
      });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user (STUDENT role for students, could be STAFF for staff if needed)
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: 'STUDENT',
        status: 'PENDING', // Require admin approval
      },
    });

    // Does NOT return token. User must wait.
    res.status(201).json({
      message: 'Registration successful. Your account is pending admin approval.',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: 'PENDING'
      },
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// Login
router.post('/login', authLimiter, validateLogin, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.status === 'PENDING') {
      return res.status(403).json({ error: 'Your account is pending approval. Please contact the administrator.' });
    }

    if (user.status === 'SUSPENDED') {
      return res.status(403).json({ error: 'Your account has been suspended.' });
    }

    // Verify password
    if (!user.password) {
      return res.status(401).json({ error: 'Please sign in using your School Microsoft Account' });
    }
    
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate token
    const token = generateToken(user.id, user.role);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatarUrl: user.avatarUrl,
        provider: user.provider,
      },
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// Get current user (protected route)
router.get('/me', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
        provider: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    logger.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Change password (protected route)
router.post('/change-password', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user has a password set
    if (!user.password) {
      return res.status(400).json({ error: 'Account uses external authentication. Password cannot be changed here.' });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.user.update({
      where: { id: req.userId },
      data: { password: hashedPassword },
    });

    logger.info(`User ${user.email} changed their password`);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    logger.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

export { router as authRouter };
