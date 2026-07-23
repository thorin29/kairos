import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7 no longer reads .env automatically, and the connection string
// no longer lives in schema.prisma. Both are handled here.
//
// process.env is read directly rather than through Prisma's env() helper
// because that helper throws when the variable is absent, and `prisma
// generate` runs during the Docker build where no database exists yet.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
