import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      base: './', 
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname),
        }
      },
      build: {
        outDir: 'dist',
        assetsDir: 'assets',
        emptyOutDir: true,
        rollupOptions: {
          // ブラウザ bundle に Node.js 専用のモジュールが混入するのを防ぐ
          external: ['path', 'url', 'fs', 'events', 'http', 'https', 'stream', 'os', 'crypto', 'zlib', 'util'],
          output: {
            // GAS/CDN運用のためにハッシュ値を付けない固定名にする
            entryFileNames: `assets/index.js`,
            chunkFileNames: `assets/[name].js`,
            assetFileNames: `assets/[name].[ext]`
          }
        },
        chunkSizeWarningLimit: 100000000, 
      }
    };
});
