import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '缺少 VITE_SUPABASE_URL 或 VITE_SUPABASE_ANON_KEY 环境变量。\n' +
    '本地开发请在项目根目录创建 .env.local 文件并填入这两个值（参考 .env.example）。\n' +
    '部署到 Vercel 时，请在项目 Settings → Environment Variables 里添加同名变量。'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
