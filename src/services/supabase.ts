import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Database } from '../types/database';

// Import environment variables
let SUPABASE_URL = '';
let SUPABASE_ANON_KEY = '';

try {
  const env = require('@env');
  SUPABASE_URL = env.SUPABASE_URL;
  SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY;
} catch (error) {
  console.warn('Failed to load @env:', error);
}

// Fallback to hardcoded values if env variables are not available
const supabaseUrl = SUPABASE_URL || 'https://akdkjignhmduhkuoesxt.supabase.co';
const supabaseAnonKey = SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrZGtqaWduaG1kdWhrdW9lc3h0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2ODM0NTQsImV4cCI6MjA4MzI1OTQ1NH0.FsI4SN1IGrFKlqCLP6yzQ9N4TN7eAWzJtbJo3DjSpiA';

console.log('Initializing Supabase with URL:', supabaseUrl);

let supabase: any;

try {
  supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  console.log('Supabase client created successfully');
} catch (error) {
  console.error('Failed to create Supabase client:', error);
  throw error;
}

export { supabase };

// Helper functions for common operations
export const uploadImage = async (
  bucket: string,
  path: string,
  file: Blob | File,
) => {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
    });

  if (error) {
    throw error;
  }

  const { data: publicUrlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(path);

  return publicUrlData.publicUrl;
};

export const generateJoinCode = (): string => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};