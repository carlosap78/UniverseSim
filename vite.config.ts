import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: ['zvomini.local'],
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: ['zvomini.local'],
  },
});
