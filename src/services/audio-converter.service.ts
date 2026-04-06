import ffmpeg from 'fluent-ffmpeg';
import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';

const unlink = promisify(fs.unlink);
const exists = promisify(fs.exists);

// ─── FFmpeg / FFprobe binary resolution ──────────────────────────────────────
// Both packages ship CommonJS modules. require() always returns the true default
// export — a path string for ffmpeg-static and { path, version } for
// ffprobe-static — avoiding the ES-namespace vs CJS-default ambiguity that made
// the old typeof / duck-typing guards brittle and error-prone.
const ffmpegBin: string | null = (() => {
  try {
    return require('ffmpeg-static') as string;
  } catch {
    return null;
  }
})();

const ffprobeBin: string | null = (() => {
  try {
    const probe = require('ffprobe-static') as { path: string } | string;
    return typeof probe === 'string' ? probe : (probe.path ?? null);
  } catch {
    return null;
  }
})();

if (ffmpegBin) {
  ffmpeg.setFfmpegPath(ffmpegBin);
  console.log('✅ FFmpeg binary:', ffmpegBin);
} else {
  console.warn('⚠️ ffmpeg-static not found — falling back to system ffmpeg');
}

if (ffprobeBin) {
  ffmpeg.setFfprobePath(ffprobeBin);
  console.log('✅ FFprobe binary:', ffprobeBin);
} else {
  console.warn('⚠️ ffprobe-static not found — falling back to system ffprobe');
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

    // Hard cap on conversion — kills the ffmpeg process if it stalls
    const CONVERSION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

    return new Promise((resolve, reject) => {
      // settled flag prevents double-resolve/reject races between the timeout
      // and the ffmpeg 'end'/'error' events
      let settled = false;
      const settle = (fn: () => void): void => {
        if (settled) return;
        settled = true;
        clearTimeout(killTimer);
        fn();
      };

      const command = ffmpeg(inputPath)
        .audioBitrate(options?.bitrate || this.DEFAULT_BITRATE)
        .audioFrequency(options?.sampleRate || this.DEFAULT_SAMPLE_RATE)
        .audioChannels(options?.channels || this.DEFAULT_CHANNELS)
        .format('mp3')
        .audioCodec('libmp3lame')
        .output(finalOutputPath);

      // Kill ffmpeg and reject if the process stalls past the timeout
      const killTimer = setTimeout(() => {
        try { command.kill('SIGKILL'); } catch { /* process already exited */ }
        settle(() =>
          reject(new Error(`FFmpeg conversion timed out after ${CONVERSION_TIMEOUT_MS / 60000} minutes`)),
        );
      }, CONVERSION_TIMEOUT_MS);

      // Surface ffmpeg stderr lines in PM2 logs for observability
      command.on('stderr', (line: string) => {
        console.log(`[ffmpeg] ${line}`);
      });

      // Track progress if callback provided
      if (options?.onProgress) {
        command.on('progress', (progress: any) => {
          const percent = progress.percent || 0;
          options.onProgress!(Math.min(Math.max(percent, 0), 100));
        });
      }

      command.on('end', () => {
        console.log(`✅ Conversion complete: ${finalOutputPath}`);
        settle(() => resolve(finalOutputPath));
      });

      command.on('error', (err: any) => {
        console.error(`❌ Conversion error: ${err.message}`);
        settle(() => reject(new Error(`Audio conversion failed: ${err.message}`)));
      });

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
    // 30-second hard cap on ffprobe — hangs here are rare but catastrophic
    const FFPROBE_TIMEOUT_MS = 30_000;

    return new Promise((resolve, reject) => {
      let settled = false;
      const settle = (fn: () => void): void => {
        if (settled) return;
        settled = true;
        clearTimeout(probeTimer);
        fn();
      };

      const probeTimer = setTimeout(() => {
        settle(() =>
          reject(new Error(`FFprobe timed out after ${FFPROBE_TIMEOUT_MS / 1000}s on: ${path.basename(filePath)}`)),
        );
      }, FFPROBE_TIMEOUT_MS);

      try {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
          if (err) {
            console.error('❌ FFprobe error:', err.message);
            settle(() => reject(new Error(`Failed to read metadata: ${err.message}`)));
            return;
          }

          if (!metadata?.streams) {
            settle(() => reject(new Error('Invalid metadata structure')));
            return;
          }

          const audioStream = metadata.streams.find(
            (stream) => stream.codec_type === 'audio',
          );

          if (!audioStream) {
            settle(() => reject(new Error('No audio stream found in file')));
            return;
          }

          settle(() => resolve({
            duration: Math.floor(metadata.format.duration || 0),
            bitrate: Math.floor((metadata.format.bit_rate || 0) / 1000),
            format: metadata.format.format_name || 'unknown',
            sampleRate: audioStream.sample_rate || 44100,
            channels: audioStream.channels || 2,
            size: metadata.format.size || 0,
          }));
        });
      } catch (error: any) {
        console.error('❌ FFprobe initialization error:', error);
        settle(() => reject(new Error(`FFmpeg error: ${error.message}`)));
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
