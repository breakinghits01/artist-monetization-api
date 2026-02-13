import { Router } from 'express';
import * as songController from '../controllers/song.controller';
import { protect } from '../middleware/auth.middleware';
import { upload } from '../middleware/upload.middleware';

const router = Router();

// Public routes - No authentication required
router.get('/discover', songController.discoverSongs);
router.get('/genres', songController.getGenres);
router.get('/:songId', songController.getSongById);
router.get('/artist/:artistId', songController.getArtistSongs);
router.post('/:songId/play', songController.incrementPlayCount);

// Protected routes - Temporarily disabled authentication for testing
router.post('/upload', upload.single('audio'), songController.uploadAudioFile);
router.post('/', songController.createSong); // TODO: Re-enable protect middleware
router.patch('/:songId', protect, songController.updateSong);
router.delete('/:songId', protect, songController.deleteSong);

export default router;
