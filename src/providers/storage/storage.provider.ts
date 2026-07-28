import { SupabaseStorageProvider } from './supabase-storage.provider';
import type { StorageProvider } from './storage.interface';

export const storageProvider: StorageProvider = new SupabaseStorageProvider();