import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "icon-192.png", "icon-512.png", "empleados-icon.svg", "empleados-icon-192.png", "empleados-icon-512.png", "manifest.webmanifest", "empleados.webmanifest"],
      manifest: false,
      workbox: {
        navigateFallback: "/index.html",
        cleanupOutdatedCaches: true
      }
    })
  ]
});
