import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Brand, Menu } from "../types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const candidateDataPaths = [
  join(process.cwd(), "src/data/menu-data.json"),
  join(process.cwd(), "apps/server/src/data/menu-data.json"),
  join(__dirname, "../data/menu-data.json")
];
const menuDataPath = candidateDataPaths.find((path) => existsSync(path)) ?? candidateDataPaths[0];
const menus = JSON.parse(readFileSync(menuDataPath, "utf-8")) as Menu[];

export function listMenus(filters: { brand?: Brand; category?: string; query?: string }) {
  const query = filters.query?.trim().toLowerCase();

  return menus.filter((menu) => {
    if (filters.brand && menu.brand !== filters.brand) return false;
    if (filters.category && menu.category !== filters.category) return false;
    if (query && !menu.name.toLowerCase().includes(query)) return false;
    return true;
  });
}

export function getMenu(menuId: string) {
  return menus.find((menu) => menu.id === menuId);
}
