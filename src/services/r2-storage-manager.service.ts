import * as path from 'path';
import { uploadToR2, deleteFromR2 } from '../config/r2';

/**
 * R2 Storage Manager Service
 * Manages organized file storage structure in Cloudflare R2
 * 
 * Storage Structure:
 * audio/
 *   ├── streaming/YYYY/MM/song-{id}-{timestamp}.mp3  (MP3 for playback)
 *   └── original/YYYY/MM/song-{id}-{timestamp}.{ext} (Original uploads)
 */
export class R2StorageManager {
  /**
   * Generate organized path for streaming audio (MP3)
   * @param songId - Song ID
   * @param timestamp - Timestamp for uniqueness
   * @returns Path like "audio/streaming/2026/02/song-123-1234567890.mp3"
   */
  static generateStreamingPath(songId: string, timestamp?: number): string {
    const ts = timestamp || Date.now();
    const date = new Date(ts);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    
    return `audio/streaming/${year}/${month}/song-${songId}-${ts}.mp3`;
  }

  /**
   * Generate organized path for original audio file
   * @param songId - Song ID
   * @param format - File extension (e.g., 'wav', 'flac')
   * @param timestamp - Timestamp for uniqueness
   * @returns Path like "audio/original/2026/02/song-123-1234567890.wav"
   */
  static generateOriginalPath(
    songId: string,
    format: string,
    timestamp?: number
  ): string {
    const ts = timestamp || Date.now();
    const date = new Date(ts);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    
    // Ensure format doesn't have leading dot
    const ext = format.startsWith('.') ? format.slice(1) : format;
    
    return `audio/original/${year}/${month}/song-${songId}-${ts}.${ext}`;
  }

  /**
   * Generate temporary path for conversion
   * @param jobId - Conversion job ID or unique identifier
   * @param format - File extension
   * @returns Path like "audio/temp/job-123-1234567890.wav"
   */
  static generateTempPath(jobId: string, format: string): string {
    const timestamp = Date.now();
    const ext = format.startsWith('.') ? format.slice(1) : format;
    return `audio/temp/job-${jobId}-${timestamp}.${ext}`;
  }

  /**
   * Upload streaming audio file (MP3)
   * @param buffer - Audio file buffer
   * @param songId - Song ID
   * @param timestamp - Optional timestamp
   * @returns Public URL of uploaded file
   */
  static async uploadStreaming(
    buffer: Buffer,
    songId: string,
    timestamp?: number
  ): Promise<string> {
    try {
      const filePath = this.generateStreamingPath(songId, timestamp);
      const mimeType = 'audio/mpeg';
      
      const publicUrl = await uploadToR2(buffer, filePath, mimeType);
      console.log(`✅ Uploaded streaming audio: ${filePath}`);
      
      return publicUrl;
    } catch (error: any) {
      console.error('❌ Failed to upload streaming audio:', error);
      throw new Error(`Streaming upload failed: ${error.message}`);
    }
  }

  /**
   * Upload original audio file
   * @param buffer - Audio file buffer
   * @param songId - Song ID
   * @param format - File format/extension
   * @param mimeType - MIME type
   * @param timestamp - Optional timestamp
   * @returns Public URL of uploaded file
   */
  static async uploadOriginal(
    buffer: Buffer,
    songId: string,
    format: string,
    mimeType: string,
    timestamp?: number
  ): Promise<string> {
    try {
      const filePath = this.generateOriginalPath(songId, format, timestamp);
      
      const publicUrl = await uploadToR2(buffer, filePath, mimeType);
      console.log(`✅ Uploaded original audio: ${filePath}`);
      
      return publicUrl;
    } catch (error: any) {
      console.error('❌ Failed to upload original audio:', error);
      throw new Error(`Original upload failed: ${error.message}`);
    }
  }

  /**
   * Upload temporary file (for processing)
   * @param buffer - File buffer
   * @param jobId - Job identifier
   * @param format - File format
   * @param mimeType - MIME type
   * @returns Public URL of uploaded file
   */
  static async uploadTemp(
    buffer: Buffer,
    jobId: string,
    format: string,
    mimeType: string
  ): Promise<string> {
    try {
      const filePath = this.generateTempPath(jobId, format);
      
      const publicUrl = await uploadToR2(buffer, filePath, mimeType);
      console.log(`📦 Uploaded temp file: ${filePath}`);
      
      return publicUrl;
    } catch (error: any) {
      console.error('❌ Failed to upload temp file:', error);
      throw new Error(`Temp upload failed: ${error.message}`);
    }
  }

  /**
   * Delete file from R2
   * @param url - Full URL or file path
   * @returns True if deleted successfully
   */
  static async deleteFile(url: string): Promise<boolean> {
    try {
      await deleteFromR2(url);
      console.log(`🗑️  Deleted file: ${url}`);
      return true;
    } catch (error: any) {
      console.error(`❌ Failed to delete file ${url}:`, error);
      return false;
    }
  }

  /**
   * Extract file format from filename or URL
   * @param filename - Filename or URL
   * @returns File extension without dot (e.g., 'mp3', 'wav')
   */
  static extractFormat(filename: string): string {
    const ext = path.extname(filename);
    return ext.startsWith('.') ? ext.slice(1) : ext;
  }

  /**
   * Generate unique song ID (can be replaced with actual ID after song creation)
   * @returns Unique identifier
   */
  static generateTempSongId(): string {
    return `temp-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  }

  /**
   * Cleanup old temporary files (utility for cron jobs)
   * @param olderThanMs - Delete files older than this (default: 24 hours)
   * @returns Number of files deleted
   */
  static async cleanupTempFiles(olderThanMs: number = 24 * 60 * 60 * 1000): Promise<number> {
    // Note: This would require listing R2 files, which is not implemented yet
    // Placeholder for future implementation
    console.log(`🧹 Cleanup temp files older than ${olderThanMs}ms`);
    return 0;
  }
}
