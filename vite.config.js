import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// base: './' para que el bundle funcione servido desde cualquier carpeta via SSH/Nginx,
// igual que el dashboard-template.html actual (rutas relativas, nada absoluto).
export default defineConfig({
  plugins: [vue()],
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Dos páginas que comparten estilos y componentes: el dashboard de costos (index.html)
    // y el radar de recursos (radar.html). El deploy publica cada una en su carpeta.
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        radar: resolve(__dirname, 'radar.html')
      }
    }
  }
});
