import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const abs = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    globalSetup: ["test/global-setup.ts"],
    // One shared test database, so files run sequentially rather than racing
    // each other's rows.
    fileParallelism: false,
    hookTimeout: 120_000,
    testTimeout: 30_000,
  },
  resolve: {
    alias: [
      // src/lib/prisma.ts imports "server-only", which throws outside a React
      // Server Component bundle; and the cores call next/cache. Stub both.
      { find: "server-only", replacement: abs("./test/stubs/empty.ts") },
      { find: "next/cache", replacement: abs("./test/stubs/next-cache.ts") },
      // Mirror the tsconfig "@/*" -> "src/*" path (regex so it never eats @scope pkgs).
      { find: /^@\//, replacement: abs("./src") + "/" },
    ],
  },
});
