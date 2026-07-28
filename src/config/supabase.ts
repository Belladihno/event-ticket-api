import { createClient } from '@supabase/supabase-js';
import { config } from './app.config';

export const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);