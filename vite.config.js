import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// base: './' para que el bundle funcione servido desde cualquier carpeta via SSH/Nginx,
// igual que el dashboard-template.html actual (rutas relativas, nada absoluto).
export default defineConfig({
  plugins: [vue()],
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
});
