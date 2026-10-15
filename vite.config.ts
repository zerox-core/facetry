import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const target =
    process.env.API_PROXY_TARGET ||
    env.API_PROXY_TARGET ||
    `http://127.0.0.1:${process.env.APP_PORT || env.APP_PORT || 8080}`;

  return {
    root: fileURLToPath(new URL(".", import.meta.url)),
    base: "./",
    plugins: [react(), tailwindcss()],
    build: {
      outDir: "dist",
      emptyOutDir: true,
    },
    server: {
      host: "0.0.0.0",
      port: 5173,
      proxy: {
        "/api": {
          target,
          changeOrigin: true,
        },
        "/files": {
          target,
          changeOrigin: true,
        },
      },
    },
  };
});
