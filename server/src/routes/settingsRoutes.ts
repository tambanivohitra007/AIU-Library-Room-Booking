
import { Router } from 'express';
import { getSettings, updateSettings } from '../controllers/settingsController.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/', getSettings);
router.put('/', authenticateToken, requireAdmin, updateSettings);

export { router as settingsRouter };
