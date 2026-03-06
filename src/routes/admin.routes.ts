import express from 'express';
import * as adminController from '../controllers/admin.controller';
import { adminOnly } from '../middleware/admin.middleware';

const router = express.Router();

// Public routes
router.post('/auth/admin/login', adminController.adminLogin);

// Protected admin routes
router.use(adminOnly); // Apply admin middleware to all routes below

// Dashboard
router.get('/admin/dashboard', adminController.getDashboardStats);

// Artists Management
router.get('/admin/artists', adminController.getArtists);
router.patch('/admin/artists/:artistId/approve', adminController.approveArtist);
router.patch('/admin/artists/:artistId/reject', adminController.rejectArtist);

// Songs Moderation
router.get('/admin/songs', adminController.getSongs);
router.delete('/admin/songs/:songId', adminController.removeSong);

// Users Management
router.get('/admin/users', adminController.getUsers);
router.patch('/admin/users/:userId/status', adminController.updateUserStatus);

// Revenue & Analytics
router.get('/admin/revenue', adminController.getRevenueStats);

// Recent Activity
router.get('/admin/activity', adminController.getRecentActivity);

export default router;
