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
    serverActions: {
      bodySizeLimit: "6mb",
      // CSRF defense-in-depth for a public deployment: restrict which origins
      // may invoke server actions. Set ALLOWED_ORIGINS to your host(s),
      // comma-separated (e.g. "app.example.com"). Unset = same-origin only.
      ...(process.env.ALLOWED_ORIGINS
        ? {
            allowedOrigins: process.env.ALLOWED_ORIGINS.split(",")
              .map((o) => o.trim())
              .filter(Boolean),
          }
        : {}),
    },
  },
};

export default nextConfig;
