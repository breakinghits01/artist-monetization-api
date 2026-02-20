import multer from 'multer';

/**
 * Audio Upload Middleware
 * Configures Multer for audio file uploads with validation
 * 
 * Supported Formats:
 * - MP3 (audio/mpeg, audio/mp3)
 * - WAV (audio/wav, audio/x-wav)
 * - FLAC (audio/flac)
 * - OGG (audio/ogg)
 * - M4A (audio/m4a, audio/x-m4a, audio/mp4)
 * - AAC (audio/aac)
 */

// Configure storage - use memory storage for R2 uploads
const storage = multer.memoryStorage();

// File filter to allow only audio files
const fileFilter = (_req: any, file: any, cb: any) => {
  const allowedMimeTypes = [
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/ogg',
    'audio/m4a',
    'audio/x-m4a',
    'audio/mp4', // M4A can be audio/mp4
    'audio/flac',
    'audio/aac',
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        'Invalid file type. Only audio files are allowed (MP3, WAV, FLAC, OGG, M4A, AAC).'
      ),
      false
    );
  }
};

// Configure multer upload
export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
});

/**
 * Supported audio formats for upload
 */
export const SUPPORTED_AUDIO_FORMATS = [
  'mp3',
  'wav',
  'flac',
  'ogg',
  'm4a',
  'aac',
] as const;

export type SupportedAudioFormat = typeof SUPPORTED_AUDIO_FORMATS[number];
