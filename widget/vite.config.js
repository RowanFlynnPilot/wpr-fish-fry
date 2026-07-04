import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Served from https://rowanflynnpilot.github.io/wpr-fish-fry/
export default defineConfig({
  base: "/wpr-fish-fry/",
  plugins: [react()],
});
