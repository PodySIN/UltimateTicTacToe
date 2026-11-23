import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Для GitHub Pages: замените base на '/ИМЯ_РЕПОЗИТОРИЯ/'
// Если сайт будет на корне домена (username.github.io), оставьте '/'
export default defineConfig({
  plugins: [react()],
  base: './', // относительные пути — работает и в корне, и в подпапке
  server: {
    port: 5173,
    host: true,
  },
  build: {
    outDir: 'dist',
  },
});
