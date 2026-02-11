import { Router } from 'express';
import * as playlistController from '../controllers/playlist.controller';
// import { protect } from '../middleware/auth.middleware'; // TODO: Add auth when ready

const router = Router();

// Get user's playlists (public for now, will add auth later)
router.get('/user/:userId', playlistController.getUserPlaylists);

// Get playlist by ID
router.get('/:playlistId', playlistController.getPlaylistById);

// Create playlist (temporarily without auth for testing)
router.post('/', playlistController.createPlaylist);

// Update playlist (temporarily without auth for testing)
router.put('/:playlistId', playlistController.updatePlaylist);

// Delete playlist (temporarily without auth for testing)
router.delete('/:playlistId', playlistController.deletePlaylist);

// Add song to playlist (temporarily without auth for testing)
router.post('/:playlistId/songs/:songId', playlistController.addSongToPlaylist);

// Remove song from playlist (temporarily without auth for testing)
router.delete('/:playlistId/songs/:songId', playlistController.removeSongFromPlaylist);

export default router;
