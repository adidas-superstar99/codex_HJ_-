import dotenv from "dotenv";
import { resolve } from "node:path";

dotenv.config();

export const config = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL ?? resolve(process.cwd(), "coffee-orders.sqlite"),
  adminPassword: process.env.ADMIN_PASSWORD ?? "change-me",
  nodeEnv: process.env.NODE_ENV ?? "development"
};

export function isPostgresUrl(databaseUrl = config.databaseUrl) {
  return databaseUrl.startsWith("postgres://") || databaseUrl.startsWith("postgresql://");
}
