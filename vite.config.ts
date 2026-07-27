import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";

const { version } = JSON.parse(readFileSync("./package.json", "utf8")) as { version: string };

// Tauri expects a fixed port and no obfuscated sourcemaps in dev.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  // The health beacon reports which version is actually running, which is how
  // you find out whether an update reached her machine at all.
  define: { __APP_VERSION__: JSON.stringify(version) },
  server: { port: 1420, strictPort: true },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: "safari15",
    minify: "esbuild",
    sourcemap: false,
    assetsInlineLimit: 0,
  },
});
