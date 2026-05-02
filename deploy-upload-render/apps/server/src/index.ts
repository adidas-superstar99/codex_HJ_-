import cors from "cors";
import express from "express";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { migrate } from "./db.js";
import { requireAdmin } from "./routes/admin.js";
import { menusRouter } from "./routes/menus.js";
import { adminOrderBatchesRouter, publicOrderBatchesRouter } from "./routes/orderBatches.js";
import { adminOrdersRouter, publicOrdersRouter } from "./routes/orders.js";
import { getAdminPage, getBatchListPage, getOrderPage } from "./serverPages.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const candidateWebDistPaths = [
  join(process.cwd(), "apps/web/dist"),
  join(process.cwd(), "../web/dist"),
  join(__dirname, "../../web/dist")
];
const webDistPath = candidateWebDistPaths.find((path) => existsSync(path));
const publicAssetCandidates = [
  join(process.cwd(), "apps/server/public"),
  join(process.cwd(), "public"),
  join(__dirname, "../public")
];
const publicAssetPath = publicAssetCandidates.find((path) => existsSync(path));

const app = express();

app.use(cors());
app.use(express.json());

if (publicAssetPath) {
  app.use("/assets", express.static(publicAssetPath));
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "coffee-order-api" });
});

app.use("/api/menus", menusRouter);
app.use("/api/order-batches", publicOrderBatchesRouter);
app.use("/api/orders", publicOrdersRouter);
app.use("/api/orders", requireAdmin, adminOrdersRouter);
app.use("/api/admin/order-batches", requireAdmin, adminOrderBatchesRouter);

app.get("/", (_req, res) => {
  res.type("html").send(getBatchListPage());
});

app.get("/order/:id", (_req, res) => {
  res.type("html").send(getOrderPage());
});

app.get("/admin", (_req, res) => {
  res.type("html").send(getAdminPage());
});

if (webDistPath) {
  app.use(express.static(webDistPath));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(join(webDistPath, "index.html"));
  });
}

async function start() {
  await migrate();
  app.listen(config.port, "0.0.0.0", () => {
    console.log(`Coffee order app listening on http://0.0.0.0:${config.port}`);
  });
}

start().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
