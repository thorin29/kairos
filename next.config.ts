import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits a self-contained server bundle so the runtime image does not
  // need node_modules. Keeps the published image small.
  output: "standalone",

  // The pg driver and the Prisma adapter use native Node APIs and must not
  // be bundled by the server compiler. nodemailer uses dynamic requires that
  // the bundler can't follow, so it's external too.
  serverExternalPackages: ["pg", "@prisma/adapter-pg", "nodemailer"],

  experimental: {
    // Profile photos post through a server action, and the default cap is
    // 1 MB — smaller than a phone snapshot.
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
