import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Separate demo entry: no API proxy, no inclusion in the product panel build.
export default defineConfig({
  plugins: [react()],
  server: { host: "127.0.0.1", port: 5174, strictPort: true, open: false },
  build: { outDir: "dist-demo", rollupOptions: { input: "demo.html" } },
});
