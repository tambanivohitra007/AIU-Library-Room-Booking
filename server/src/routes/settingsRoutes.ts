
import { Router } from 'express';
import { getSettings, updateSettings } from '../controllers/settingsController.js';
import { authenticateToken, requireSuperAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/', getSettings);
router.put('/', authenticateToken, requireSuperAdmin, updateSettings);

export { router as settingsRouter };
