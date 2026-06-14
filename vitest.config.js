import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: "./tests/setup/globalSetup.js",
    setupFiles: ["./tests/setup/testSetup.js"],
    pool: "forks",
    forks: { singleFork: true },
  },
});
