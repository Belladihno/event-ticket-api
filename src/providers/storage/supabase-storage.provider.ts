import { supabase } from '../../config/supabase';
import type { StorageProvider } from './storage.interface';

export class SupabaseStorageProvider implements StorageProvider {
  async upload(bucket: string, file: Buffer, path: string, contentType: string): Promise<string> {
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      contentType,
      upsert: true,
    });
    if (error) {
      throw new Error(`Supabase storage upload failed: ${error.message}`);
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  async delete(bucket: string, path: string): Promise<void> {
    const { error } = await supabase.storage.from(bucket).remove([path]);
    if (error) {
      throw new Error(`Supabase storage delete failed: ${error.message}`);
    }
  }

  async getSignedUrl(bucket: string, path: string, expiresIn: number = 300): Promise<string> {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
    if (error) {
      throw new Error(`Supabase signed URL generation failed: ${error.message}`);
    }
    return data.signedUrl;
  }
}