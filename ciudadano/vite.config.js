import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// base '/ciudadano/': la app se despliega bajo esa ruta, junto al panel. Sin ella los assets
// se piden desde la raíz y el despliegue da 404.
//
// El proxy '/mock' lleva a http://127.0.0.1:8080. Con él, la app y el backend de pruebas salen
// por UN solo origen: un túnel HTTPS al puerto 5174 basta para probar la geolocalización en
// un teléfono real (el navegador la exige solo en HTTPS o localhost) sin que haya contenido mixto.
//
// La biblioteca del mapa se decide al compilar: Mapbox GL si hay VITE_MAPBOX_TOKEN, MapLibre si no.
// Se importa fija (alias 'biblioteca-mapa') y en su propio archivo: así el navegador la descarga a la
// vez que el código de la app. Antes se importaba dinámicamente, y solo se pedía cuando la app ya
// había llegado y arrancado: un paso más en cadena (~1.3 s con una red lenta).
export default defineConfig(({ mode }) => {
  const conMapbox = Boolean(loadEnv(mode, process.cwd(), 'VITE_').VITE_MAPBOX_TOKEN);
  const lib = conMapbox ? 'mapbox-gl' : 'maplibre-gl';
  return {
    base: '/ciudadano/',
    plugins: [react()],
    resolve: {
      alias: {
        'biblioteca-mapa.css': lib + '/dist/' + lib + '.css',
        'biblioteca-mapa': lib,
      },
    },
    build: {
      rollupOptions: {
        output: { manualChunks: (id) => (id.includes('/node_modules/' + lib + '/') ? 'biblioteca-mapa' : undefined) },
      },
      chunkSizeWarningLimit: 1600,   // la biblioteca del mapa pesa eso sin comprimir; es una sola descarga
    },
    server: {
      port: 5174,
      host: true,
      allowedHosts: true,
      proxy: {
        '/mock': { target: 'http://127.0.0.1:8080', rewrite: (p) => p.replace(/^\/mock/, '') },
      },
    },
  };
});
