import 'dotenv/config'
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'

// Configure S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
})

const BUCKET_NAME = process.env.AWS_S3_BUCKET || ''

/**
 * Upload a file to S3
 * @param file - Multer file object (from memory storage)
 * @param folder - Optional folder path in S3 bucket
 * @returns S3 object key (path)
 */
export async function uploadToS3(
  file: Express.Multer.File,
  folder = 'tool-images',
): Promise<string> {
  if (!BUCKET_NAME) {
    throw new Error('AWS_S3_BUCKET environment variable is not set')
  }

  // Generate unique filename
  const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${file.originalname}`
  const key = folder ? `${folder}/${uniqueName}` : uniqueName

  try {
    // Use Upload for better performance with larger files
    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: BUCKET_NAME,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        // Make file publicly readable (optional - remove if you want private files)
        // ACL: 'public-read',
      },
    })

    await upload.done()

    // Return the S3 URL
    // Format: https://bucket-name.s3.region.amazonaws.com/key
    const s3Url = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`
    return s3Url
  } catch (error) {
    console.error('Error uploading to S3:', error)
    throw new Error('Failed to upload file to S3')
  }
}

/**
 * Delete a file from S3
 * @param s3Url - Full S3 URL or just the key
 */
export async function deleteFromS3(s3Url: string): Promise<void> {
  if (!BUCKET_NAME) {
    throw new Error('AWS_S3_BUCKET environment variable is not set')
  }

  try {
    // Extract key from URL if full URL is provided
    let key = s3Url
    if (s3Url.includes('amazonaws.com/')) {
      key = s3Url.split('amazonaws.com/')[1]
    } else if (s3Url.includes(`${BUCKET_NAME}/`)) {
      key = s3Url.split(`${BUCKET_NAME}/`)[1]
    }

    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    })

    await s3Client.send(command)
    console.log(`Deleted file from S3: ${key}`)
  } catch (error) {
    console.error('Error deleting from S3:', error)
    throw new Error('Failed to delete file from S3')
  }
}

/**
 * Check if S3 is properly configured
 */
export function isS3Configured(): boolean {
  return !!(
    process.env.AWS_S3_BUCKET &&
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.AWS_REGION
  )
}
