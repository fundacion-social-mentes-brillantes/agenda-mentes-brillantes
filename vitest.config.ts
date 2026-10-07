import { defineConfig } from "vitest/config";

// Pruebas sin navegador ni Firebase real: funciones del servidor (api/) y
// logica pura de la app (src/). La PWA y React no hacen falta aqui.
export default defineConfig({
  test: {
    environment: "node",
    include: ["api/**/*.test.js", "src/**/*.test.{ts,tsx}"],
    // Mismo reloj que Vercel: UTC. Una fecha de Colombia mal calculada debe fallar aqui.
    env: { TZ: "UTC" },
  },
});
