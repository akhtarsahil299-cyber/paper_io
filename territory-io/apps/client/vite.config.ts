import { defineConfig } from 'vite';

// In dev, the Socket.IO server runs on :3001 and Vite proxies to it, so the client
// always connects to its own origin (same code path as production).
export default defineConfig({
  server: { port: 5173, proxy: { '/socket.io': { target: 'http://localhost:3001', ws: true } } },
  build: { chunkSizeWarningLimit: 1800 }
});
