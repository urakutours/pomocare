import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = 'https://cjylcizaikyirdxkwpao.supabase.co';
export const supabaseAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqeWxjaXphaWt5aXJkeGt3cGFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3NTUxNzUsImV4cCI6MjA4NzMzMTE3NX0.xzdHA_HxkcpWb5EA2SWIqCmKYb524TA-rLRFjHtdRvY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Navigator Lock タイムアウト防止: PWA/マルチタブ環境で
    // lock 取得に失敗してハングするのを回避する
    lock: (_name, _acquireTimeout, fn) => fn(),
  },
});
