import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits a self-contained server bundle so the runtime image does not
  // need node_modules. Keeps the published image small.
  output: "standalone",

  // The pg driver and the Prisma adapter use native Node APIs and must not
  // be bundled by the server compiler.
  serverExternalPackages: ["pg", "@prisma/adapter-pg"],

  experimental: {
    // Profile photos post through a server action, and the default cap is
    // 1 MB — smaller than a phone snapshot.
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
