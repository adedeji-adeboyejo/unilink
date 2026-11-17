import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The GUI calls /api/...; Vite forwards it to the FastAPI backend.
// Change the target if your backend runs somewhere else.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
