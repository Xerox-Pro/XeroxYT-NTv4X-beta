
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {

      base: 'https://cdn.jsdelivr.net/gh/Xerox-Pro/XeroxYT-NTv4X-beta@main/dist/',
      
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          // FIX: '__dirname' is not available in ESM modules. Using 'process.cwd()' to get the project root.
          '@': path.resolve(__dirname),
        }
      },
      build: {
        outDir: 'dist',
        assetsDir: 'assets',
        emptyOutDir: true,
      }
    };
});
