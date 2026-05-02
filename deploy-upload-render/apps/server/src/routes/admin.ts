import type { NextFunction, Request, Response } from "express";
import { config } from "../config.js";

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const password = req.header("x-admin-password");
  if (!password || password !== config.adminPassword) {
    res.status(401).json({ message: "UNAUTHORIZED" });
    return;
  }

  next();
}
