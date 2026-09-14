import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        "/api": {
          target: env.API_PROXY_TARGET || "http://localhost:5080",
          changeOrigin: true,
        },
      },
    },
    test: {
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
      clearMocks: true,
      // Os testes de e2e/ rodam no Chrome pelo Playwright, não no jsdom.
      // Sem esta exclusão o vitest os recolhe e falha em `test is not a
      // function`, com uma mensagem que não explica nada.
      exclude: ["**/node_modules/**", "**/dist/**", "**/dist-demo/**", "e2e/**"],
    },
  };
});
