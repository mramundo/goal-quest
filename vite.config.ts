import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Base path per GitHub Pages: /<repo-name>/
// Sostituito in build se si usa Vercel/Netlify (imposta VITE_BASE=/)
const base = process.env.VITE_BASE ?? "/goal-quest/";

export default defineConfig({
  base,
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
