import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Served from https://rowanflynnpilot.github.io/wpr-fish-fry/
// Two pages: index.html (full, auto-height embed) and embed.html (compact,
// fixed-height embed for articles that can't carry the height script).
export default defineConfig({
  base: "/wpr-fish-fry/",
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        embed: fileURLToPath(new URL("./embed.html", import.meta.url)),
      },
    },
  },
  server: {
    // Harness-assigned port when launched via .claude/launch.json (autoPort).
    port: Number(process.env.PORT) || 5173,
  },
});
