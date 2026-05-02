import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const templateDirCandidates = [
  join(process.cwd(), "src", "templates"),
  join(process.cwd(), "apps", "server", "src", "templates"),
  join(__dirname, "../src/templates"),
  join(__dirname, "templates")
];
const templatesDir = templateDirCandidates.find((path) => existsSync(path)) ?? templateDirCandidates[0];

function readTemplate(name: string) {
  return readFileSync(join(templatesDir, name), "utf-8");
}

let stylesCache: string | undefined;

function sharedStyles() {
  if (!stylesCache) {
    stylesCache = readTemplate("shared-styles.html");
  }
  return stylesCache;
}

function renderTemplate(name: string) {
  return readTemplate(name).replace("$styles", sharedStyles());
}

export function getBatchListPage() {
  return renderTemplate("batch-list.html");
}

export function getOrderPage() {
  return renderTemplate("order.html");
}

export function getAdminPage() {
  return renderTemplate("admin.html");
}
