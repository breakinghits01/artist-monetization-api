import * as ffmpeg from 'fluent-ffmpeg';
import * as ffmpegStatic from 'ffmpeg-static';
import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';

const unlink = promisify(fs.unlink);
const exists = promisify(fs.exists);

// Set FFmpeg path to bundled binary
const ffmpegPath = ffmpegStatic as unknown as string;
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
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
        command.on('progress', (progress) => {
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
      command.on('error', (err) => {
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
   * @returns Promise with output MP3 buffer
   */
  static async convertBufferToMp3(
    inputBuffer: Buffer,
    inputFormat: string
  ): Promise<Buffer> {
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

      return outputBuffer;
    } finally {
      // Cleanup temp files
      await this.cleanupFile(inputPath);
      await this.cleanupFile(outputPath);
    }
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
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          reject(new Error(`Failed to read metadata: ${err.message}`));
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
