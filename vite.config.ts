import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://72.60.228.212:3001',
        changeOrigin: true,
        secure: false,
      },
      '/auth': {
        target: 'http://72.60.228.212:3001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});