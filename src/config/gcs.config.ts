import { Storage } from '@google-cloud/storage';
import { config } from './app.config';

export const storage = new Storage({
  projectId: config.gcs.projectId,
  keyFilename: config.gcs.credentials,
});

export const bucket = storage.bucket(config.gcs.bucketName);
