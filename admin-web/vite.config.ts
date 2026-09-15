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
      // vmThreads cria um contexto VM e um jsdom novos por arquivo, como o pool
      // padrão (isolamento igual); o que é reaproveitado é a thread e o cache
      // dos módulos externos. Medido em 16/09/2026, cache quente, alternando os
      // pools: forks 6,9-7,4 s, threads 6,9 s, vmThreads 5,7 s.
      pool: "vmThreads",
    },
  };
});
