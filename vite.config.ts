import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["logo.png", "manifest.webmanifest"],
      manifest: false, // use public/manifest.webmanifest
      workbox: {
        // App shell + assets cached on first visit; API calls N/A (client-only).
        globPatterns: ["**/*.{js,css,html,ico,png,woff2,webmanifest}"],
        runtimeCaching: [
          {
            urlPattern: /\/mirin-intro\.mp4$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "mirin-intro-video",
              expiration: { maxEntries: 1, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api/],
      },
    }),
  ],
});
