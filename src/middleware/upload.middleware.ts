import multer from 'multer';
import path from 'path';
import { uploadToR2 } from '../config/r2';

// Configure storage - use memory storage for R2 uploads
const storage = multer.memoryStorage();

// File filter to allow only audio files
const fileFilter = (_req: any, file: any, cb: any) => {
  const allowedMimeTypes = [
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/ogg',
    'audio/m4a',
    'audio/x-m4a',
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only audio files are allowed.'), false);
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
 * Upload file buffer to R2 and return public URL
 * @param file - Multer file object (with buffer)
 * @returns Public URL of uploaded file
 */
export async function uploadAudioToR2(file: Express.Multer.File): Promise<string> {
  try {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const nameWithoutExt = path.basename(file.originalname, ext);
    const fileName = `audio/${nameWithoutExt}-${uniqueSuffix}${ext}`;

    // Upload to R2
    const publicUrl = await uploadToR2(file.buffer, fileName, file.mimetype);
    
    return publicUrl;
  } catch (error: any) {
    console.error('❌ Failed to upload audio to R2:', error);
    throw new Error(`Upload failed: ${error.message}`);
  }
}
