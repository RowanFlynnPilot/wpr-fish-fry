import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Served from https://rowanflynnpilot.github.io/wpr-fish-fry/
export default defineConfig({
  base: "/wpr-fish-fry/",
  plugins: [react()],
  server: {
    // Harness-assigned port when launched via .claude/launch.json (autoPort).
    port: Number(process.env.PORT) || 5173,
  },
});
