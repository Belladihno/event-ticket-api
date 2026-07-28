export interface StorageProvider {
  upload(bucket: string, file: Buffer, path: string, contentType: string): Promise<string>;
  delete(bucket: string, path: string): Promise<void>;
  getSignedUrl(bucket: string, path: string, expiresIn?: number): Promise<string>;
}