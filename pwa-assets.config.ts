import { defineConfig, minimal2023Preset } from "@vite-pwa/assets-generator/config";

const ICON_BACKGROUND = "#1f6f5c";
const fullBleedIcon = { padding: 0, resizeOptions: { background: ICON_BACKGROUND } };

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, ...fullBleedIcon },
    apple: { ...minimal2023Preset.apple, ...fullBleedIcon },
  },
  images: ["public/favicon.svg"],
});
