import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const DEFAULT_BASE_PATH = "/";

export default defineConfig({
  base: process.env.BASE_PATH ?? DEFAULT_BASE_PATH,
  plugins: [react()],
});
