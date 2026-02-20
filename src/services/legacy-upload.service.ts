import * as path from 'path';
import { uploadToR2 } from '../config/r2';

/**
 * Legacy Upload Service
 * Maintains backward compatibility with old upload flow
 * This service uses the old flat storage structure: audio/{name}-{timestamp}.{ext}
 * 
 * For new uploads with conversion, use R2StorageManager instead
 */
export class LegacyUploadService {
  /**
   * Upload file buffer to R2 using legacy flat structure
   * @param file - Multer file object (with buffer)
   * @returns Public URL of uploaded file
   */
  static async uploadAudioToR2(file: Express.Multer.File): Promise<string> {
    try {
      // Generate unique filename (legacy format)
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);
      const nameWithoutExt = path.basename(file.originalname, ext);
      const fileName = `audio/${nameWithoutExt}-${uniqueSuffix}${ext}`;

      // Upload to R2
      const publicUrl = await uploadToR2(file.buffer, fileName, file.mimetype);
      
      console.log(`✅ Legacy upload: ${fileName}`);
      
      return publicUrl;
    } catch (error: any) {
      console.error('❌ Failed to upload audio to R2:', error);
      throw new Error(`Upload failed: ${error.message}`);
    }
  }

  /**
   * Upload buffer to R2 with custom filename
   * @param buffer - File buffer
   * @param fileName - Custom filename
   * @param mimeType - MIME type
   * @returns Public URL of uploaded file
   */
  static async uploadBuffer(
    buffer: Buffer,
    fileName: string,
    mimeType: string
  ): Promise<string> {
    try {
      const publicUrl = await uploadToR2(buffer, fileName, mimeType);
      console.log(`✅ Legacy buffer upload: ${fileName}`);
      return publicUrl;
    } catch (error: any) {
      console.error('❌ Failed to upload buffer to R2:', error);
      throw new Error(`Upload failed: ${error.message}`);
    }
  }
}
