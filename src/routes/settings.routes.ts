import express from 'express';
import * as settingsController from '../controllers/settings.controller';
import { adminOnly } from '../middleware/admin.middleware';

const router = express.Router();

// All settings routes require admin authentication
router.use(adminOnly);

// Get all settings
router.get('/', settingsController.getAllSettings);

// Get single setting
router.get('/:key', settingsController.getSetting);

// Update setting
router.patch('/:key', settingsController.updateSetting);

// Create new setting
router.post('/', settingsController.createSetting);

// Clear cache
router.post('/cache/clear', settingsController.clearCache);

export default router;
