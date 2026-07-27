import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tauri expects a fixed port and no obfuscated sourcemaps in dev.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: "safari15",
    minify: "esbuild",
    sourcemap: false,
    assetsInlineLimit: 0,
  },
});
