import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const devApiUrl = process.env.VITE_DEV_API_URL || env.VITE_DEV_API_URL || 'http://localhost:5000';
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'motion-vendor': ['motion'],
            'icons-vendor': ['lucide-react'],
            'realtime-vendor': ['socket.io-client'],
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/api': {
          target: devApiUrl,
          changeOrigin: true,
          timeout: 600000, // 10 minutes
          proxyTimeout: 600000,
          configure: (proxy, _options) => {
            proxy.on('error', (err, _req, _res) => {
              console.log('[Vite Proxy] Error:', err);
            });
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              console.log('[Vite Proxy] Request:', req.method, req.url, '->', proxyReq.path);
            });
            proxy.on('proxyRes', (proxyRes, req, _res) => {
              console.log('[Vite Proxy] Response:', proxyRes.statusCode, req.url);
            });
          }
        },
        '/uploads': {
          target: devApiUrl,
          changeOrigin: true,
        }
      }
    },
  };
});
