import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { generateToken, authenticateToken, AuthRequest } from '../middleware/auth.js';
import { authLimiter } from '../middleware/security.js';
import { validateRegister, validateLogin } from '../middleware/validation.js';
import logger from '../utils/logger.js';
import { getAdminEmails } from '../config/admins.js';
import { getServiceSettings, isEmailAllowed, allowedDomainsMessage } from '../services/settings.js';
import { getManagedDepartmentIds } from '../services/permissions.js';
import { trReq } from '../services/i18n.js';

const router = Router();
const prisma = new PrismaClient();

// --- Microsoft SSO Routes ---

// 1. Get the Microsoft Login URL
router.get('/microsoft/url', (req: Request, res: Response) => {
  const customRedirectUri = req.query.redirect_uri as string; // Optional: allow frontend to specify redirect URI (useful for local dev vs prod)

  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const redirectUri = customRedirectUri || process.env.AZURE_REDIRECT_URI;

  if (!tenantId || !clientId || !redirectUri) {
    logger.error('Missing Microsoft SSO configuration');
    return res.status(500).json({ error: trReq(req, 'ssoConfigMissingDetail') });
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
      return res.status(400).json({ error: trReq(req, 'authCodeRequired') });
    }

    const tenantId = process.env.AZURE_TENANT_ID;
    const clientId = process.env.AZURE_CLIENT_ID;
    const clientSecret = process.env.AZURE_CLIENT_SECRET;
    const redirectUri = clientRedirectUri || process.env.AZURE_REDIRECT_URI;

    if (!tenantId || !clientId || !clientSecret || !redirectUri) {
      return res.status(500).json({ error: trReq(req, 'ssoConfigMissing') });
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
      return res.status(401).json({ error: trReq(req, 'msAuthFailed'), details: tokenData.error_description });
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
       return res.status(401).json({ error: trReq(req, 'msProfileFailed') });
    }

    // C. Validate Email Domain
    // Microsoft Graph returns 'mail' or 'userPrincipalName'
    const email = (graphData.mail || graphData.userPrincipalName)?.toLowerCase();
    const name = graphData.displayName || graphData.givenName;

    if (!email) {
      return res.status(400).json({ error: trReq(req, 'msEmailMissing') });
    }

    // Domain check (configurable; empty allowlist = any domain)
    const settings = await getServiceSettings();
    if (!isEmailAllowed(email, settings)) {
       return res.status(403).json({ error: allowedDomainsMessage(settings) });
    }

    // D. Find or Create User in Database
    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Create new user (No password). ADMIN_EMAILS entries bootstrap as SUPERADMIN.
      const isSuperAdmin = getAdminEmails().includes(email);

      user = await prisma.user.create({
        data: {
          email,
          name: name || 'Microsoft User',
          provider: 'MICROSOFT',
          role: isSuperAdmin ? 'SUPERADMIN' : 'STUDENT',
        },
      });
      logger.info(`New SSO user created: ${email} (Role: ${isSuperAdmin ? 'SUPERADMIN' : 'STUDENT'})`);
    } else {
      const updates: { provider?: string; role?: 'SUPERADMIN' } = {};

      // Note that they used SSO if the account was created locally
      if (user.provider === 'LOCAL') {
        updates.provider = 'MICROSOFT';
      }

      // ADMIN_EMAILS is authoritative: re-assert SUPERADMIN on every SSO login
      if (getAdminEmails().includes(email) && user.role !== 'SUPERADMIN') {
        updates.role = 'SUPERADMIN';
        logger.info(`Re-asserted SUPERADMIN for ${email} (listed in ADMIN_EMAILS)`);
      }

      if (Object.keys(updates).length > 0) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: updates,
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
        language: user.language,
        managedDepartmentIds: await getManagedDepartmentIds(user.id),
      },
    });

  } catch (error) {
    logger.error('Microsoft Login Error:', error);
    res.status(500).json({ error: trReq(req, 'ssoServerError') });
  }
});

// Register new user (student only - admins created manually)
router.post('/register', authLimiter, validateRegister, async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: trReq(req, 'registerFieldsRequired') });
    }

    const settings = await getServiceSettings();

    // Self-registration can be disabled entirely (SSO / admin-created accounts only)
    if (!settings.allowSelfRegistration) {
      return res.status(403).json({
        error: trReq(req, 'selfRegistrationDisabled'),
      });
    }

    // Validate email domain (configurable; empty allowlist = any domain)
    if (!isEmailAllowed(email, settings)) {
      return res.status(400).json({ error: allowedDomainsMessage(settings) });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ error: trReq(req, 'emailExists') });
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
      message: trReq(req, 'registerPending'),
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
    res.status(500).json({ error: trReq(req, 'registerFailed') });
  }
});

// Login
router.post('/login', authLimiter, validateLogin, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: trReq(req, 'loginFieldsRequired') });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({ error: trReq(req, 'invalidCredentials') });
    }

    if (user.status === 'PENDING') {
      return res.status(403).json({ error: trReq(req, 'accountPendingContact') });
    }

    if (user.status === 'SUSPENDED') {
      return res.status(403).json({ error: trReq(req, 'accountSuspended') });
    }

    // Verify password
    if (!user.password) {
      return res.status(401).json({ error: trReq(req, 'useMicrosoftSignIn') });
    }
    
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ error: trReq(req, 'invalidCredentials') });
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
        language: user.language,
        managedDepartmentIds: await getManagedDepartmentIds(user.id),
      },
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: trReq(req, 'loginFailed') });
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
        language: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: trReq(req, 'userNotFound') });
    }

    res.json({
      ...user,
      managedDepartmentIds: await getManagedDepartmentIds(user.id),
    });
  } catch (error) {
    logger.error('Get user error:', error);
    res.status(500).json({ error: trReq(req, 'fetchMeFailed') });
  }
});

// Change password (protected route)
router.post('/change-password', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: trReq(req, 'passwordFieldsRequired') });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: trReq(req, 'passwordTooShort') });
    }

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
    });

    if (!user) {
      return res.status(404).json({ error: trReq(req, 'userNotFound') });
    }

    // Check if user has a password set
    if (!user.password) {
      return res.status(400).json({ error: trReq(req, 'externalAuthPassword') });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ error: trReq(req, 'currentPasswordWrong') });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.user.update({
      where: { id: req.userId },
      data: { password: hashedPassword },
    });

    logger.info(`User ${user.email} changed their password`);

    res.json({ message: trReq(req, 'passwordChanged') });
  } catch (error) {
    logger.error('Change password error:', error);
    res.status(500).json({ error: trReq(req, 'changePasswordFailed') });
  }
});

export { router as authRouter };
