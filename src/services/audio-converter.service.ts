import ffmpeg from 'fluent-ffmpeg';
import * as ffmpegStatic from 'ffmpeg-static';
// @ts-ignore - Type declaration exists in src/types but ts-node watch mode doesn't pick it up
import * as ffprobeStatic from 'ffprobe-static';
import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';

const unlink = promisify(fs.unlink);
const exists = promisify(fs.exists);

// Set FFmpeg path to bundled binary
// Handle both string and object returns from ffmpeg-static
let ffmpegPath: string | null = null;
if (typeof ffmpegStatic === 'string') {
  ffmpegPath = ffmpegStatic;
} else if (ffmpegStatic && typeof ffmpegStatic === 'object') {
  // Handle case where ffmpeg-static returns an object
  ffmpegPath = (ffmpegStatic as any).path || (ffmpegStatic as any).default || null;
}

if (ffmpegPath && typeof ffmpegPath === 'string') {
  ffmpeg.setFfmpegPath(ffmpegPath);
  console.log('✅ FFmpeg path configured:', ffmpegPath);
} else {
  console.warn('⚠️ FFmpeg path not found, using system FFmpeg');
}

// Set FFprobe path to bundled binary
let ffprobePath: string | null = null;
if (typeof ffprobeStatic === 'string') {
  ffprobePath = ffprobeStatic;
} else if (ffprobeStatic && typeof ffprobeStatic === 'object') {
  // Handle case where ffprobe-static returns an object
  ffprobePath = (ffprobeStatic as any).path || (ffprobeStatic as any).default || null;
}

if (ffprobePath && typeof ffprobePath === 'string') {
  ffmpeg.setFfprobePath(ffprobePath);
  console.log('✅ FFprobe path configured:', ffprobePath);
} else {
  console.warn('⚠️ FFprobe path not found, using system FFprobe');
}

/**
 * Audio Conversion Service
 * Handles conversion of various audio formats to MP3
 */
export class AudioConverterService {
  private static readonly DEFAULT_BITRATE = '320k'; // High quality MP3
  private static readonly DEFAULT_SAMPLE_RATE = 44100; // CD quality
  private static readonly DEFAULT_CHANNELS = 2; // Stereo

  /**
   * Convert audio file to MP3 format
   * @param inputPath - Path to input audio file
   * @param outputPath - Path for output MP3 file
   * @param options - Conversion options
   * @returns Promise that resolves when conversion is complete
   */
  static async convertToMp3(
    inputPath: string,
    outputPath?: string,
    options?: {
      bitrate?: string;
      sampleRate?: number;
      channels?: number;
      onProgress?: (progress: number) => void;
    }
  ): Promise<string> {
    // Generate output path if not provided
    const finalOutputPath = outputPath || this.generateOutputPath(inputPath);

    // Ensure output directory exists
    const outputDir = path.dirname(finalOutputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    return new Promise((resolve, reject) => {
      const command = ffmpeg(inputPath)
        .audioBitrate(options?.bitrate || this.DEFAULT_BITRATE)
        .audioFrequency(options?.sampleRate || this.DEFAULT_SAMPLE_RATE)
        .audioChannels(options?.channels || this.DEFAULT_CHANNELS)
        .format('mp3')
        .audioCodec('libmp3lame')
        .output(finalOutputPath);

      // Track progress if callback provided
      if (options?.onProgress) {
        command.on('progress', (progress: any) => {
          // FFmpeg returns time-based progress, convert to percentage
          const percent = progress.percent || 0;
          options.onProgress!(Math.min(Math.max(percent, 0), 100));
        });
      }

      // Handle completion
      command.on('end', () => {
        console.log(`✅ Conversion complete: ${finalOutputPath}`);
        resolve(finalOutputPath);
      });

      // Handle errors
      command.on('error', (err: any) => {
        console.error(`❌ Conversion error: ${err.message}`);
        reject(new Error(`Audio conversion failed: ${err.message}`));
      });

      // Start conversion
      command.run();
    });
  }

  /**
   * Convert buffer to MP3 and return buffer
   * @param inputBuffer - Input audio buffer
   * @param inputFormat - Input audio format (e.g., 'wav', 'flac')
   * @returns Promise with output MP3 buffer and metadata
   */
  static async convertBufferToMp3(
    inputBuffer: Buffer,
    inputFormat: string
  ): Promise<{ buffer: Buffer; bitrate?: number; duration?: number }> {
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const timestamp = Date.now();
    const inputPath = path.join(tempDir, `input-${timestamp}.${inputFormat}`);
    const outputPath = path.join(tempDir, `output-${timestamp}.mp3`);

    try {
      // Write buffer to temp file
      fs.writeFileSync(inputPath, inputBuffer);

      // Convert file
      await this.convertToMp3(inputPath, outputPath);

      // Read converted file
      const outputBuffer = fs.readFileSync(outputPath);

      // Get metadata of converted file
      let metadata: { bitrate?: number; duration?: number } = {};
      try {
        const meta = await this.getMetadata(outputPath);
        metadata.bitrate = meta.bitrate;
        metadata.duration = meta.duration;
      } catch (metaError) {
        console.warn('⚠️ Could not extract output metadata:', metaError);
      }

      return {
        buffer: outputBuffer,
        ...metadata,
      };
    } finally {
      // Cleanup temp files
      await this.cleanupFile(inputPath);
      await this.cleanupFile(outputPath);
    }
  }

  /**
   * Get metadata from buffer
   * @param buffer - Audio buffer
   * @param format - Audio format (e.g., 'mp3', 'wav')
   * @returns Promise with audio metadata
   */
  static async getMetadataFromBuffer(
    buffer: Buffer,
    format: string
  ): Promise<{
    duration: number;
    bitrate: number;
    format: string;
    sampleRate: number;
    channels: number;
    size: number;
  }> {
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const timestamp = Date.now();
    const tempPath = path.join(tempDir, `meta-${timestamp}.${format}`);

    try {
      // Write buffer to temp file
      fs.writeFileSync(tempPath, buffer);

      // Get metadata
      const metadata = await this.getMetadata(tempPath);

      return metadata;
    } catch (error: any) {
      console.warn('⚠️ Metadata extraction failed, using estimates:', error.message);
      
      // Return estimated metadata based on file size and format
      // Fallback ensures upload continues even if ffprobe fails
      const estimatedDuration = this.estimateDuration(buffer.byteLength, format);
      
      return {
        duration: estimatedDuration,
        bitrate: 320, // Assume high quality
        format: format || 'mp3',
        sampleRate: 44100, // CD quality
        channels: 2, // Stereo
        size: buffer.byteLength,
      };
    } finally {
      // Cleanup temp file
      await this.cleanupFile(tempPath);
    }
  }

  /**
   * Estimate audio duration from file size
   * @param fileSize - File size in bytes
   * @param format - Audio format
   * @returns Estimated duration in seconds
   */
  private static estimateDuration(fileSize: number, format: string): number {
    // Average bitrates for different formats (kbps)
    const avgBitrates: { [key: string]: number } = {
      mp3: 192,
      m4a: 256,
      wav: 1411,
      flac: 800,
      ogg: 160,
      aac: 256,
    };

    const bitrate = avgBitrates[format.toLowerCase()] || 192;
    const durationSeconds = Math.floor((fileSize * 8) / (bitrate * 1000));
    
    // Ensure reasonable duration (30 seconds to 10 minutes)
    return Math.max(30, Math.min(durationSeconds, 600));
  }

  /**
   * Get audio metadata (duration, bitrate, format, etc.)
   * @param filePath - Path to audio file
   * @returns Promise with audio metadata
   */
  static async getMetadata(filePath: string): Promise<{
    duration: number;
    bitrate: number;
    format: string;
    sampleRate: number;
    channels: number;
    size: number;
  }> {
    return new Promise((resolve, reject) => {
      try {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
          if (err) {
            console.error('❌ FFprobe error:', err.message);
            reject(new Error(`Failed to read metadata: ${err.message}`));
            return;
          }

          if (!metadata || !metadata.streams) {
            reject(new Error('Invalid metadata structure'));
            return;
          }

          const audioStream = metadata.streams.find(
            (stream) => stream.codec_type === 'audio'
          );

          if (!audioStream) {
            reject(new Error('No audio stream found in file'));
            return;
          }

          resolve({
            duration: Math.floor(metadata.format.duration || 0),
            bitrate: Math.floor((metadata.format.bit_rate || 0) / 1000),
            format: metadata.format.format_name || 'unknown',
            sampleRate: audioStream.sample_rate || 44100,
            channels: audioStream.channels || 2,
            size: metadata.format.size || 0,
          });
        });
      } catch (error: any) {
        console.error('❌ FFprobe initialization error:', error);
        reject(new Error(`FFmpeg error: ${error.message}`));
      }
    });
  }

  /**
   * Check if file needs conversion (is not already MP3)
   * @param filePath - Path to audio file
   * @returns True if conversion needed
   */
  static async needsConversion(filePath: string): Promise<boolean> {
    try {
      const metadata = await this.getMetadata(filePath);
      // Check if already MP3 format
      return !metadata.format.includes('mp3');
    } catch (error) {
      console.error('Error checking if conversion needed:', error);
      return true; // Assume conversion needed if can't read metadata
    }
  }

  /**
   * Generate output path for converted file
   * @param inputPath - Input file path
   * @returns Output path with .mp3 extension
   */
  private static generateOutputPath(inputPath: string): string {
    const dir = path.dirname(inputPath);
    const basename = path.basename(inputPath, path.extname(inputPath));
    return path.join(dir, `${basename}.mp3`);
  }

  /**
   * Cleanup temporary file
   * @param filePath - Path to file to delete
   */
  private static async cleanupFile(filePath: string): Promise<void> {
    try {
      if (await exists(filePath)) {
        await unlink(filePath);
        console.log(`🧹 Cleaned up: ${filePath}`);
      }
    } catch (error) {
      console.error(`Failed to cleanup ${filePath}:`, error);
    }
  }

  /**
   * Estimate output file size for MP3 conversion
   * @param durationSeconds - Duration in seconds
   * @param bitrate - Bitrate in kbps (e.g., '320k')
   * @returns Estimated file size in bytes
   */
  static estimateOutputSize(
    durationSeconds: number,
    bitrate: string = this.DEFAULT_BITRATE
  ): number {
    // Extract numeric value from bitrate string (e.g., '320k' -> 320)
    const bitrateKbps = parseInt(bitrate.replace('k', ''));
    // Calculate: (bitrate in kbps * duration in seconds * 1024) / 8
    return Math.floor((bitrateKbps * durationSeconds * 1024) / 8);
  }
}
