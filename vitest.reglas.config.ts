import { defineConfig } from "vitest/config";

// Pruebas de firestore.rules: necesitan el emulador de Firestore corriendo
// (npm run test:reglas lo levanta y lo apaga solo).
export default defineConfig({
  test: {
    environment: "node",
    include: ["reglas/**/*.test.ts"],
    testTimeout: 20000,
    hookTimeout: 30000,
    fileParallelism: false
  }
});
