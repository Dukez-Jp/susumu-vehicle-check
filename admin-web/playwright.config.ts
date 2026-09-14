import { defineConfig, devices } from "@playwright/test";

/* Automação do Chrome para a demonstração Tenken.

   Usa o Chrome instalado na máquina (`channel: "chrome"`), não o Chromium
   empacotado: é o mesmo navegador em que o mecânico vai ver a demonstração,
   e é o que o ABRIR_DEMO_TENKEN.cmd abre.

   O servidor servido aqui é o build de produção (`dist-demo`), não o modo de
   desenvolvimento — é o artefato que realmente vai para o tablet. */
const PORTA = 5174;

export default defineConfig({
  testDir: "./e2e",
  // O tablet é um Galaxy Tab Active5 Pro de 10,1", 1920x1200.
  use: {
    baseURL: `http://127.0.0.1:${PORTA}`,
    channel: "chrome",
    viewport: { width: 1280, height: 800 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chrome",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
  ],
  // Um servidor já no ar é reaproveitado; em CI, sobe e derruba sozinho.
  webServer: {
    command: "npm run build:demo && npx vite preview --config vite.demo.config.ts --host 127.0.0.1 --port 5174 --strictPort",
    url: `http://127.0.0.1:${PORTA}/demo.html`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  reporter: [["list"]],
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
});
