import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cjylcizaikyirdxkwpao.supabase.co';
const supabaseAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqeWxjaXphaWt5aXJkeGt3cGFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3NTUxNzUsImV4cCI6MjA4NzMzMTE3NX0.xzdHA_HxkcpWb5EA2SWIqCmKYb524TA-rLRFjHtdRvY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
