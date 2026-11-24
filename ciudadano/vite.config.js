import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base '/ciudadano/': la app se despliega bajo esa ruta, junto al panel. Sin ella los assets
// se piden desde la raíz y el despliegue da 404.
//
// El proxy '/mock' lleva a http://127.0.0.1:8080. Con él, la app y el backend de pruebas salen
// por UN solo origen: un túnel HTTPS al puerto 5174 basta para probar la geolocalización en
// un teléfono real (el navegador la exige solo en HTTPS o localhost) sin que haya contenido mixto.
export default defineConfig({
  base: '/ciudadano/',
  plugins: [react()],
  server: {
    port: 5174,
    host: true,
    allowedHosts: true,
    proxy: {
      '/mock': { target: 'http://127.0.0.1:8080', rewrite: (p) => p.replace(/^\/mock/, '') },
    },
  },
});
