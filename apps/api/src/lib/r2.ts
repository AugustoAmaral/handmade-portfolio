import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getEnv } from '../env.js'

function client() {
  const env = getEnv()
  return new S3Client({
    region: 'auto',
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
  })
}

export async function putObject(key: string, body: Buffer): Promise<void> {
  await client().send(new PutObjectCommand({ Bucket: getEnv().R2_BUCKET, Key: key, Body: body, ContentType: 'image/webp' }))
}

export async function deleteObject(key: string): Promise<void> {
  await client().send(new DeleteObjectCommand({ Bucket: getEnv().R2_BUCKET, Key: key }))
}
