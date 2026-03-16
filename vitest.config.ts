import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./packages/server/vitest.setup.ts"],
  },
});