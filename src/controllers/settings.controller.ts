import { Request, Response } from 'express';
import SystemSettings from '../models/SystemSettings.model';
import AdminAction from '../models/AdminAction.model';

/**
 * Get all system settings (organized by category)
 */
export const getAllSettings = async (_req: Request, res: Response): Promise<void> => {
  try {
    const settings = await SystemSettings.find()
      .select('key value type description category updatedAt updatedBy')
      .populate('updatedBy', 'username email')
      .sort({ category: 1, key: 1 });

    // Group by category
    const grouped = settings.reduce((acc: any, setting) => {
      if (!acc[setting.category]) {
        acc[setting.category] = [];
      }
      acc[setting.category].push(setting);
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        settings,
        grouped,
      },
    });
  } catch (error: any) {
    console.error('Get settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch settings',
      error: error.message,
    });
  }
};

/**
 * Get single setting by key
 */
export const getSetting = async (req: Request, res: Response): Promise<void> => {
  try {
    const { key } = req.params;

    const setting = await SystemSettings.findOne({ key })
      .populate('updatedBy', 'username email');

    if (!setting) {
      res.status(404).json({
        success: false,
        message: `Setting '${key}' not found`,
      });
      return;
    }

    res.json({
      success: true,
      data: { setting },
    });
  } catch (error: any) {
    console.error('Get setting error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch setting',
      error: error.message,
    });
  }
};

/**
 * Update setting value
 */
export const updateSetting = async (req: Request, res: Response): Promise<void> => {
  try {
    const { key } = req.params;
    const { value, reason } = req.body;
    const adminId = (req as any).user?._id || (req as any).user?.userId;

    if (value === undefined || value === null) {
      res.status(400).json({
        success: false,
        message: 'Value is required',
      });
      return;
    }

    const setting = await SystemSettings.findOne({ key });

    if (!setting) {
      res.status(404).json({
        success: false,
        message: `Setting '${key}' not found`,
      });
      return;
    }

    // Validate value type
    if (!validateSettingValue(value, setting.type)) {
      res.status(400).json({
        success: false,
        message: `Invalid value type. Expected ${setting.type}`,
      });
      return;
    }

    // Store previous value for audit
    const previousValue = setting.value;

    // Update setting
    const updated = await SystemSettings.updateSetting(key, value, adminId);

    if (!updated) {
      res.status(500).json({
        success: false,
        message: 'Failed to update setting',
      });
      return;
    }

    // Log admin action
    await AdminAction.create({
      adminId,
      action: 'other',
      targetType: 'system',
      reason: reason || `Updated system setting: ${key}`,
      details: {
        settingKey: key,
        previousValue,
        newValue: value,
        timestamp: new Date(),
      },
    });

    res.json({
      success: true,
      message: `Setting '${key}' updated successfully`,
      data: { setting: updated },
    });
  } catch (error: any) {
    console.error('Update setting error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update setting',
      error: error.message,
    });
  }
};

/**
 * Create new setting
 */
export const createSetting = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      key,
      value,
      type,
      description,
      category,
    } = req.body;
    const adminId = (req as any).user?._id || (req as any).user?.userId;

    // Validation
    if (!key || value === undefined || !type || !description) {
      res.status(400).json({
        success: false,
        message: 'Key, value, type, and description are required',
      });
      return;
    }

    // Check if setting already exists
    const existing = await SystemSettings.findOne({ key });
    if (existing) {
      res.status(409).json({
        success: false,
        message: `Setting '${key}' already exists`,
      });
      return;
    }

    // Create setting
    const setting = await SystemSettings.create({
      key,
      value,
      type,
      description,
      category: category || 'general',
      updatedBy: adminId,
    });

    // Log admin action
    await AdminAction.create({
      adminId,
      action: 'other',
      targetType: 'system',
      reason: `Created system setting: ${key}`,
      details: {
        settingKey: key,
        value,
        timestamp: new Date(),
      },
    });

    res.status(201).json({
      success: true,
      message: 'Setting created successfully',
      data: { setting },
    });
  } catch (error: any) {
    console.error('Create setting error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create setting',
      error: error.message,
    });
  }
};

/**
 * Clear settings cache
 */
export const clearCache = async (_req: Request, res: Response): Promise<void> => {
  try {
    (SystemSettings as any).clearCache();

    res.json({
      success: true,
      message: 'Settings cache cleared successfully',
    });
  } catch (error: any) {
    console.error('Clear cache error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear cache',
      error: error.message,
    });
  }
};

/**
 * Validate setting value based on type
 */
function validateSettingValue(value: any, type: string): boolean {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && !isNaN(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'json':
      return typeof value === 'object';
    default:
      return false;
  }
}
