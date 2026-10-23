import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In local dev, run `vercel dev` so /api functions work alongside Vite.
export default defineConfig({
  plugins: [react()],
  build: { chunkSizeWarningLimit: 900 },
});
