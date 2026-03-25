import { Router } from 'express';
import * as playlistController from '../controllers/playlist.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

// Public routes - No authentication required
// Get user's playlists (public - view anyone's playlists)
router.get('/user/:userId', playlistController.getUserPlaylists);

// Get playlist by ID (public - view any playlist)
router.get('/:playlistId', playlistController.getPlaylistById);

// Protected routes - Authentication required
// Create playlist (protected - must be logged in)
router.post('/', protect, playlistController.createPlaylist);

// Update playlist (protected - owner verification in controller)
router.put('/:playlistId', protect, playlistController.updatePlaylist);

// Delete playlist (protected - owner verification in controller)
router.delete('/:playlistId', protect, playlistController.deletePlaylist);

// Add song to playlist (protected - owner verification in controller)
router.post('/:playlistId/songs/:songId', protect, playlistController.addSongToPlaylist);

// Remove song from playlist (protected - owner verification in controller)
router.delete('/:playlistId/songs/:songId', protect, playlistController.removeSongFromPlaylist);

export default router;
