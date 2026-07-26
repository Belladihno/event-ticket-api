import { S3Client } from '@aws-sdk/client-s3';
import { config } from './app.config';

const r2Endpoint = `https://${config.r2.accountId}.r2.cloudflarestorage.com`;

export const s3 = new S3Client({
  region: 'auto',
  endpoint: r2Endpoint,
  credentials: {
    accessKeyId: config.r2.accessKeyId,
    secretAccessKey: config.r2.secretAccessKey,
  },
});

export const r2BucketName = config.r2.bucketName;

export function getPublicUrl(key: string): string {
  const base = config.r2.publicUrl
    ? config.r2.publicUrl.replace(/\/$/, '')
    : `https://${config.r2.bucketName}.${new URL(r2Endpoint).hostname}`;
  return `${base}/${key}`;
}
