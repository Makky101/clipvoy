import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Auth UI installs React 18 internally; hooks must use the app's React instance.
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        timeout: 15 * 60 * 1000,
      },
    },
  },
});
