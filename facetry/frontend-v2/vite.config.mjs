import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

export default defineConfig(({ mode }) => {
  // Read only the backend port into the proxy; never expose backend credentials to the client.
  const backendEnv = loadEnv(
    mode,
    fileURLToPath(new URL("../backend", import.meta.url)),
    "APP_PORT",
  );
  const target =
    process.env.API_PROXY_TARGET ||
    `http://127.0.0.1:${process.env.APP_PORT || process.env.PORT || backendEnv.APP_PORT || 8080}`;
  return {
    root: fileURLToPath(new URL(".", import.meta.url)),
    base: "./",
    plugins: [react(), tailwindcss()],
    build: { outDir: "../dist", emptyOutDir: true },
    server: {
      proxy: {
        "/api": target,
        "/files": target,
      },
    },
  };
});
