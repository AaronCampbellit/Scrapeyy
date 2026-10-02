import { defineConfig } from "vitest/config";

export default defineConfig({
  cacheDir: "work/vitest-cache",
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    clearMocks: true,
  },
});
