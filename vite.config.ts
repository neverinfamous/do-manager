import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/")
          ) {
            return "react-vendor";
          }
          if (id.includes("@radix-ui")) {
            return "radix-ui";
          }
          if (id.includes("lucide-react")) {
            return "lucide";
          }
          if (id.includes("sql-formatter") || id.includes("prismjs")) {
            return "sql-tools";
          }
          if (id.includes("node_modules/fflate/")) {
            return "fflate";
          }
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: false, // Keep original origin
        headers: {
          Origin: "http://localhost:5173",
        },
      },
    },
  },
});
