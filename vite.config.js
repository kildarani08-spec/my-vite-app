import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()], // automatic runtime by default
  server: {
    proxy: {
      '/ecommerce': {
        target: 'http://localhost',
        changeOrigin: true
      }
    }
  }
});
