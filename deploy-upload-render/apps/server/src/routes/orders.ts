import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import { ordersToCsv } from "../services/exportService.js";
import { createOrder, deleteOrder, listOrders, summarizeOrders, updateOrder } from "../services/orderService.js";
import type { Brand, CreateOrderInput, UpdateOrderInput } from "../types.js";

export const publicOrdersRouter = Router();
export const adminOrdersRouter = Router();

publicOrdersRouter.post("/", async (req: Request, res: Response) => {
  try {
    const order = await createOrder(req.body as CreateOrderInput);
    res.status(201).json(order);
  } catch (error) {
    res.status(resolvePublicOrderStatus(error)).json({ message: resolvePublicOrderMessage(error) });
  }
});

publicOrdersRouter.put("/:id", async (req: Request, res: Response) => {
  try {
    const order = await updateOrder(req.params.id, req.body as UpdateOrderInput);
    res.json(order);
  } catch (error) {
    res.status(resolvePublicOrderStatus(error)).json({ message: resolvePublicOrderMessage(error) });
  }
});

publicOrdersRouter.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  if (req.header("x-admin-password")) {
    next();
    return;
  }

  const result = await deleteOrder(req.params.id, {
    isAdmin: false,
    ordererName: typeof req.body?.ordererName === "string" ? req.body.ordererName : undefined
  });

  if (result === "not_found") {
    res.status(404).json({ message: "주문을 찾을 수 없습니다." });
    return;
  }

  if (result === "forbidden") {
    res.status(403).json({ message: "이름이 일치하는 내 주문만 취소할 수 있습니다." });
    return;
  }

  if (result === "closed") {
    res.status(400).json({ message: "마감된 주문목록은 취소할 수 없습니다." });
    return;
  }

  res.json({ ok: true });
});

adminOrdersRouter.get("/", async (req: Request, res: Response) => {
  try {
    const filters = readFilters(req.query);
    res.json(await listOrders(filters));
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    res.status(500).json({ message });
  }
});

adminOrdersRouter.get("/summary", async (req: Request, res: Response) => {
  try {
    const filters = readFilters(req.query);
    res.json(await summarizeOrders(filters));
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    res.status(500).json({ message });
  }
});

adminOrdersRouter.get("/export.csv", async (req: Request, res: Response) => {
  try {
    const filters = readFilters(req.query);
    const csv = ordersToCsv(await listOrders(filters));
    res.header("Content-Type", "text/csv; charset=utf-8");
    res.header("Content-Disposition", "attachment; filename=orders.csv");
    res.send(`\uFEFF${csv}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    res.status(500).json({ message });
  }
});

adminOrdersRouter.delete("/:id", async (req: Request, res: Response) => {
  const result = await deleteOrder(req.params.id, { isAdmin: true });
  if (result === "not_found") {
    res.status(404).json({ message: "주문을 찾을 수 없습니다." });
    return;
  }

  res.json({ ok: true });
});

function readFilters(query: Record<string, unknown>) {
  return {
    batchId: typeof query.batchId === "string" ? query.batchId : undefined,
    brand: typeof query.brand === "string" ? (query.brand as Brand) : undefined
  };
}

function resolvePublicOrderStatus(error: unknown) {
  const code = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  if (code === "BATCH_NOT_FOUND" || code === "ORDER_NOT_FOUND") {
    return 404;
  }

  if (code === "ORDER_FORBIDDEN") {
    return 403;
  }

  return 400;
}

function resolvePublicOrderMessage(error: unknown) {
  const code = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  const messages: Record<string, string> = {
    BATCH_REQUIRED: "주문목록을 선택해 주세요.",
    BATCH_NOT_FOUND: "주문목록을 찾을 수 없습니다.",
    BATCH_CLOSED: "마감된 주문목록입니다.",
    BATCH_CLOSED_EDIT: "마감된 주문목록은 수정할 수 없습니다.",
    ORDER_INPUT_REQUIRED: "주문자 이름과 음료를 입력해 주세요.",
    INVALID_QUANTITY: "수량은 1개 이상이어야 합니다.",
    ORDER_NOT_FOUND: "주문을 찾을 수 없습니다.",
    ORDER_FORBIDDEN: "이름이 일치하는 내 주문만 수정할 수 있습니다."
  };

  return messages[code] ?? "주문 저장에 실패했습니다.";
}
