import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 部署到 GitHub Pages 时，网站会跑在 https://你的用户名.github.io/prep-tracker/
// 这个 base 必须和你的仓库名一致，否则加载出来的 JS/CSS 会 404
export default defineConfig({
  plugins: [react()],
  base: '/prep-tracker/',
});
