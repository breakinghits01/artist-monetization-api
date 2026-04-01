import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import dotenv from 'dotenv';

dotenv.config();

// Cloudflare R2 Configuration
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'artist-monetization-audio';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || '';

// S3 Client configured for Cloudflare R2
// NodeHttpHandler adds hard timeouts so a slow/unreachable R2 never hangs the process
export const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
  requestHandler: new NodeHttpHandler({
    connectionTimeout: 15000,  // 15s to establish TCP connection
    socketTimeout: 300000,     // 5min for data transfer (large files)
  }),
});

/**
 * Upload file to R2
 * @param fileBuffer - File buffer to upload
 * @param fileName - Name of the file (with path if needed)
 * @param contentType - MIME type of the file
 * @returns Public URL of the uploaded file
 */
export async function uploadToR2(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string
): Promise<string> {
  try {
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: fileName,
      Body: fileBuffer,
      ContentType: contentType,
      // Make object publicly readable
      // Note: R2 doesn't use ACL, bucket must be configured for public access
    });

    await r2Client.send(command);

    // Return public URL
    // Format: https://pub-xxxxx.r2.dev/filename
    const publicUrl = `${R2_PUBLIC_URL}/${fileName}`;
    
    console.log(`✅ Uploaded to R2: ${publicUrl}`);
    return publicUrl;
  } catch (error: any) {
    console.error('❌ R2 upload failed:', error);
    throw new Error(`Failed to upload to R2: ${error.message}`);
  }
}

/**
 * Delete file from R2
 * @param fileName - Name of the file to delete
 */
export async function deleteFromR2(fileName: string): Promise<void> {
  try {
    const command = new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: fileName,
    });

    await r2Client.send(command);
    console.log(`✅ Deleted from R2: ${fileName}`);
  } catch (error: any) {
    console.error('❌ R2 delete failed:', error);
    throw new Error(`Failed to delete from R2: ${error.message}`);
  }
}

/**
 * Get signed URL for private object (if needed for future use)
 * @param fileName - Name of the file
 * @param expiresIn - Expiration time in seconds (default: 1 hour)
 * @returns Signed URL
 */
export async function getSignedUrlFromR2(
  fileName: string,
  expiresIn: number = 3600
): Promise<string> {
  try {
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: fileName,
    });

    const signedUrl = await getSignedUrl(r2Client, command, { expiresIn });
    return signedUrl;
  } catch (error: any) {
    console.error('❌ R2 signed URL generation failed:', error);
    throw new Error(`Failed to generate signed URL: ${error.message}`);
  }
}

/**
 * Extract filename from R2 URL
 * @param url - R2 public URL
 * @returns Filename
 */
export function extractFileNameFromR2Url(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    return pathname.startsWith('/') ? pathname.substring(1) : pathname;
  } catch (error) {
    console.error('❌ Invalid R2 URL:', url);
    return '';
  }
}

export default {
  uploadToR2,
  deleteFromR2,
  getSignedUrlFromR2,
  extractFileNameFromR2Url,
  r2Client,
};
