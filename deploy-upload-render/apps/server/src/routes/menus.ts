import { Router } from "express";
import { listMenus } from "../services/menuService.js";
import type { Brand } from "../types.js";

export const menusRouter = Router();

menusRouter.get("/", (req, res) => {
  const brand = typeof req.query.brand === "string" ? (req.query.brand as Brand) : undefined;
  const category = typeof req.query.category === "string" ? req.query.category : undefined;
  const query = typeof req.query.query === "string" ? req.query.query : undefined;

  res.json(listMenus({ brand, category, query }));
});
