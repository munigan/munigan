import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };
export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "ui",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
          setupFiles: ["tests/setup.ts"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          exclude: [
            "tests/integration/*sim*.test.ts",
            "tests/integration/cli.test.ts",
            "tests/integration/spec-parity.test.ts",
          ],
          testTimeout: 30000,
        },
      },
      {
        resolve: { alias },
        test: {
          name: "simulator",
          environment: "node",
          include: [
            "tests/integration/*sim*.test.ts",
            "tests/integration/cli.test.ts",
            "tests/integration/spec-parity.test.ts",
          ],
          testTimeout: 120000,
        },
      },
    ],
  },
});
