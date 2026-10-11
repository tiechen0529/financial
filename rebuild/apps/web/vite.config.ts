import vue from "@vitejs/plugin-vue";
import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(process.cwd(), "../.."), "VITE_");
  return {
    plugins: [vue()],
    server: {
      host: env.VITE_HOST || "127.0.0.1",
      port: 5173,
      proxy: {
        "/api": "http://127.0.0.1:8080",
      },
    },
    test: {
      environment: "happy-dom",
    },
  };
});
