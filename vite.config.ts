import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves this repo at https://dordinator.github.io/sets-for-ferris/
// so production assets need that base path. Dev stays at root.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === "production" ? "/sets-for-ferris/" : "/",
  build: {
    outDir: "docs",
    emptyOutDir: true,
  },
}));
