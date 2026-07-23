import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits a self-contained server bundle so the runtime image does not
  // need node_modules. Keeps the published image small.
  output: "standalone",

  // The pg driver and the Prisma adapter use native Node APIs and must not
  // be bundled by the server compiler.
  serverExternalPackages: ["pg", "@prisma/adapter-pg"],
};

export default nextConfig;
