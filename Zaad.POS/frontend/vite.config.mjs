// pyramids-mart/frontend/vite.config.mjs
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: "dist",
    sourcemap: true, // مهم: يُظهر أسماء الملفات والسطور الحقيقية في Console
  },
});
