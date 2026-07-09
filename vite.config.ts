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
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api/, /^\/mirin-intro\.mp4$/],
      },
    }),
  ],
});
