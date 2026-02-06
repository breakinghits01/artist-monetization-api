import { Router } from 'express';
import * as songController from '../controllers/song.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

// Public routes - No authentication required
router.get('/discover', songController.discoverSongs);
router.get('/genres', songController.getGenres);
router.get('/:songId', songController.getSongById);
router.get('/artist/:artistId', songController.getArtistSongs);
router.post('/:songId/play', songController.incrementPlayCount);

// Protected routes - Authentication required
router.post('/', protect, songController.createSong);
router.patch('/:songId', protect, songController.updateSong);
router.delete('/:songId', protect, songController.deleteSong);

export default router;
