import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const DEFAULT_BASE_PATH = "/";
const THEME_COLOR = "#1e4d3b";
const BACKGROUND_COLOR = "#eef2ef";

export default defineConfig({
  base: process.env.BASE_PATH ?? DEFAULT_BASE_PATH,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // Adds showing notifications and opening the app on tap to the generated service worker.
      workbox: { importScripts: ["push-sw.js"] },
      pwaAssets: { config: true },
      manifest: {
        name: "Collabitat",
        short_name: "Collabitat",
        description: "Split costs, rotate chores and plan meals with the people you live with.",
        theme_color: THEME_COLOR,
        background_color: BACKGROUND_COLOR,
        display: "standalone",
      },
    }),
  ],
});
