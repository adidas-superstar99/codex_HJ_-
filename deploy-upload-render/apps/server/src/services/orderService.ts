import { nanoid } from "nanoid";
import { isPostgres, pgAll, pgOne, sqliteDb, withPgTransaction } from "../db.js";
import type {
  Brand,
  CreateOrderBatchInput,
  CreateOrderInput,
  Order,
  OrderBatch,
  OrderBatchStatus,
  OrderItem,
  OrderStatus,
  SummaryRow,
  UpdateOrderBatchInput,
  UpdateOrderInput
} from "../types.js";

const statuses: OrderStatus[] = ["submitted", "confirmed", "ordered", "completed", "cancelled"];

type BatchRow = {
  id: string;
  title: string;
  department: string | null;
  memo: string | null;
  status: OrderBatchStatus;
  created_at: string;
  closed_at: string | null;
};

type OrderRow = {
  id: string;
  batch_id: string;
  batch_title: string;
  ordered_at: string;
  orderer_name: string;
  status: OrderStatus;
};

type OrderItemRow = {
  id: string;
  order_id: string;
  brand: Brand;
  menu_id: string;
  menu_name: string;
  category: string;
  size: string;
  quantity: number;
  custom_request: string | null;
};

type BatchWithCountsRow = BatchRow & {
  order_count?: number | string;
  cup_count?: number | string;
};

export function isOrderStatus(value: string): value is OrderStatus {
  return statuses.includes(value as OrderStatus);
}

export async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<Order | undefined> {
  if (isPostgres()) {
    const updated = await pgOne<{ id: string }>("UPDATE orders SET status = $1 WHERE id = $2 RETURNING id", [status, orderId]);
    return updated ? getOrderById(orderId) : undefined;
  }

  const result = sqliteDb!.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, orderId);
  if (!result.changes) return undefined;
  return getOrderById(orderId);
}

export async function bulkUpdateOrderStatus(
  filters: { batchId?: string; brand?: Brand; status?: OrderStatus },
  nextStatus: OrderStatus
): Promise<{ updatedCount: number }> {
  const orders = await listOrders(filters);
  const targets = orders.filter((order) => order.status !== "cancelled" && order.status !== nextStatus);

  if (!targets.length) {
    return { updatedCount: 0 };
  }

  if (isPostgres()) {
    for (const order of targets) {
      await pgAll("UPDATE orders SET status = $1 WHERE id = $2", [nextStatus, order.id]);
    }
    return { updatedCount: targets.length };
  }

  const statement = sqliteDb!.prepare("UPDATE orders SET status = ? WHERE id = ?");
  sqliteDb!.transaction(() => {
    for (const order of targets) {
      statement.run(nextStatus, order.id);
    }
  })();
  return { updatedCount: targets.length };
}

export async function listPublicOrderBatches(): Promise<OrderBatch[]> {
  const batches = await listOrderBatches({ status: "open", includeCounts: false });
  return batches.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listAdminOrderBatches(): Promise<OrderBatch[]> {
  const batches = await listOrderBatches({ includeCounts: true });
  return batches.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getOrderBatchById(batchId: string): Promise<OrderBatch | undefined> {
  if (isPostgres()) {
    const row = await pgOne<BatchRow>("SELECT * FROM order_batches WHERE id = $1", [batchId]);
    return row ? mapBatchRow(row) : undefined;
  }

  const row = sqliteDb!.prepare("SELECT * FROM order_batches WHERE id = ?").get(batchId) as BatchRow | undefined;
  return row ? mapBatchRow(row) : undefined;
}

export async function createOrderBatch(input: CreateOrderBatchInput): Promise<OrderBatch> {
  const title = input.title.trim();
  const department = input.department?.trim() || "AX팀";
  if (!title) {
    throw new Error("BATCH_TITLE_REQUIRED");
  }

  const batch: OrderBatch = {
    id: nanoid(),
    title,
    department,
    memo: input.memo?.trim() || undefined,
    status: "open",
    createdAt: new Date().toISOString(),
    closedAt: undefined
  };

  if (isPostgres()) {
    await pgAll(
      `INSERT INTO order_batches (id, title, department, memo, status, created_at, closed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [batch.id, batch.title, batch.department, batch.memo ?? null, batch.status, batch.createdAt, null]
    );
    return batch;
  }

  sqliteDb!
    .prepare(`
      INSERT INTO order_batches (id, title, department, memo, status, created_at, closed_at)
      VALUES (@id, @title, @department, @memo, @status, @createdAt, @closedAt)
    `)
    .run({
      id: batch.id,
      title: batch.title,
      department: batch.department,
      memo: batch.memo ?? null,
      status: batch.status,
      createdAt: batch.createdAt,
      closedAt: null
    });

  return batch;
}

export async function updateOrderBatch(batchId: string, input: UpdateOrderBatchInput): Promise<OrderBatch | undefined> {
  const current = await getOrderBatchById(batchId);
  if (!current) {
    return undefined;
  }

  const nextStatus = input.status ?? current.status;
  const updated: OrderBatch = {
    ...current,
    title: input.title?.trim() || current.title,
    department: input.department?.trim() || current.department || "AX팀",
    memo: input.memo !== undefined ? input.memo.trim() || undefined : current.memo,
    status: nextStatus,
    closedAt: nextStatus === "closed" ? new Date().toISOString() : undefined
  };

  if (isPostgres()) {
    await pgAll(
      `UPDATE order_batches
       SET title = $1, department = $2, memo = $3, status = $4, closed_at = $5
       WHERE id = $6`,
      [updated.title, updated.department, updated.memo ?? null, updated.status, updated.closedAt ?? null, batchId]
    );
  } else {
    sqliteDb!
      .prepare(`
        UPDATE order_batches
        SET title = @title, department = @department, memo = @memo, status = @status, closed_at = @closedAt
        WHERE id = @id
      `)
      .run({
        id: batchId,
        title: updated.title,
        department: updated.department,
        memo: updated.memo ?? null,
        status: updated.status,
        closedAt: updated.closedAt ?? null
      });
  }

  return updated;
}

export async function deleteOrderBatch(batchId: string): Promise<boolean> {
  if (isPostgres()) {
    const deleted = await pgOne<{ id: string }>("DELETE FROM order_batches WHERE id = $1 RETURNING id", [batchId]);
    return Boolean(deleted);
  }

  const result = sqliteDb!.prepare("DELETE FROM order_batches WHERE id = ?").run(batchId);
  return result.changes > 0;
}

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const batch = await getOrderBatchById(input.batchId);
  validateOrderInput(input, batch, false);

  const orderId = nanoid();
  const orderedAt = new Date().toISOString();

  if (isPostgres()) {
    await withPgTransaction(async (client) => {
      await client.query(
        `INSERT INTO orders (id, batch_id, batch_title, ordered_at, orderer_name, status)
         VALUES ($1, $2, $3, $4, $5, 'submitted')`,
        [orderId, batch!.id, batch!.title, orderedAt, input.ordererName.trim()]
      );

      for (const item of input.items) {
        await client.query(
          `INSERT INTO order_items (
            id, order_id, brand, menu_id, menu_name, category, size, quantity, custom_request
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            nanoid(),
            orderId,
            item.brand,
            item.menuId,
            item.menuName,
            item.category,
            item.size,
            item.quantity,
            item.customRequest?.trim() || null
          ]
        );
      }
    });
  } else {
    const insertOrder = sqliteDb!.prepare(`
      INSERT INTO orders (id, batch_id, batch_title, ordered_at, orderer_name, status)
      VALUES (@id, @batchId, @batchTitle, @orderedAt, @ordererName, 'submitted')
    `);
    const insertItem = sqliteDb!.prepare(`
      INSERT INTO order_items (
        id, order_id, brand, menu_id, menu_name, category, size, quantity, custom_request
      ) VALUES (
        @id, @orderId, @brand, @menuId, @menuName, @category, @size, @quantity, @customRequest
      )
    `);

    sqliteDb!.transaction(() => {
      insertOrder.run({
        id: orderId,
        batchId: batch!.id,
        batchTitle: batch!.title,
        orderedAt,
        ordererName: input.ordererName.trim()
      });

      for (const item of input.items) {
        insertItem.run({
          id: nanoid(),
          orderId,
          brand: item.brand,
          menuId: item.menuId,
          menuName: item.menuName,
          category: item.category,
          size: item.size,
          quantity: item.quantity,
          customRequest: item.customRequest?.trim() || null
        });
      }
    })();
  }

  return (await getOrderById(orderId))!;
}

export async function updateOrder(orderId: string, input: UpdateOrderInput): Promise<Order> {
  const current = await getOrderById(orderId);
  if (!current) {
    throw new Error("ORDER_NOT_FOUND");
  }
  if (current.ordererName !== input.ordererName.trim()) {
    throw new Error("ORDER_FORBIDDEN");
  }

  const batch = await getOrderBatchById(current.batchId);
  validateOrderInput(input, batch, true);

  const orderedAt = new Date().toISOString();

  if (isPostgres()) {
    await withPgTransaction(async (client) => {
      await client.query(
        `UPDATE orders
         SET batch_id = $1, batch_title = $2, ordered_at = $3, orderer_name = $4
         WHERE id = $5`,
        [batch!.id, batch!.title, orderedAt, input.ordererName.trim(), orderId]
      );
      await client.query("DELETE FROM order_items WHERE order_id = $1", [orderId]);

      for (const item of input.items) {
        await client.query(
          `INSERT INTO order_items (
            id, order_id, brand, menu_id, menu_name, category, size, quantity, custom_request
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            nanoid(),
            orderId,
            item.brand,
            item.menuId,
            item.menuName,
            item.category,
            item.size,
            item.quantity,
            item.customRequest?.trim() || null
          ]
        );
      }
    });
  } else {
    sqliteDb!.transaction(() => {
      sqliteDb!
        .prepare(`
          UPDATE orders
          SET batch_id = @batchId, batch_title = @batchTitle, ordered_at = @orderedAt, orderer_name = @ordererName
          WHERE id = @id
        `)
        .run({
          id: orderId,
          batchId: batch!.id,
          batchTitle: batch!.title,
          orderedAt,
          ordererName: input.ordererName.trim()
        });

      sqliteDb!.prepare("DELETE FROM order_items WHERE order_id = ?").run(orderId);

      const insertItem = sqliteDb!.prepare(`
        INSERT INTO order_items (
          id, order_id, brand, menu_id, menu_name, category, size, quantity, custom_request
        ) VALUES (
          @id, @orderId, @brand, @menuId, @menuName, @category, @size, @quantity, @customRequest
        )
      `);

      for (const item of input.items) {
        insertItem.run({
          id: nanoid(),
          orderId,
          brand: item.brand,
          menuId: item.menuId,
          menuName: item.menuName,
          category: item.category,
          size: item.size,
          quantity: item.quantity,
          customRequest: item.customRequest?.trim() || null
        });
      }
    })();
  }

  return (await getOrderById(orderId))!;
}

export async function deleteOrder(orderId: string, options: { isAdmin: boolean; ordererName?: string }): Promise<"deleted" | "forbidden" | "closed" | "not_found"> {
  const current = await getOrderById(orderId);
  if (!current) {
    return "not_found";
  }

  if (!options.isAdmin) {
    if (!options.ordererName?.trim() || current.ordererName !== options.ordererName.trim()) {
      return "forbidden";
    }

    const batch = await getOrderBatchById(current.batchId);
    if (!batch || batch.status !== "open") {
      return "closed";
    }
  }

  if (isPostgres()) {
    await pgAll("DELETE FROM orders WHERE id = $1", [orderId]);
  } else {
    sqliteDb!.prepare("DELETE FROM orders WHERE id = ?").run(orderId);
  }

  return "deleted";
}

export async function getPublicOrdersByBatchId(batchId: string): Promise<Order[]> {
  const orders = await listOrders({ batchId });
  return orders.sort((a, b) => a.orderedAt.localeCompare(b.orderedAt));
}

export async function listOrders(filters: { batchId?: string; brand?: Brand; status?: OrderStatus }) {
  const clauses: string[] = [];
  const values: unknown[] = [];

  if (filters.batchId) {
    clauses.push(`o.batch_id = $${values.push(filters.batchId)}`);
  }

  if (filters.brand) {
    clauses.push(`EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.brand = $${values.push(filters.brand)})`);
  }

  if (filters.status) {
    clauses.push(`o.status = $${values.push(filters.status)}`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  if (isPostgres()) {
    const rows = await pgAll<OrderRow>(`SELECT * FROM orders o ${where} ORDER BY o.ordered_at DESC`, values);
    return Promise.all(rows.map(mapOrderRowAsync));
  }

  const sqliteParams: Record<string, string> = {};
  const sqliteClauses: string[] = [];
  if (filters.batchId) {
    sqliteParams.batchId = filters.batchId;
    sqliteClauses.push("o.batch_id = @batchId");
  }
  if (filters.brand) {
    sqliteParams.brand = filters.brand;
    sqliteClauses.push("EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.brand = @brand)");
  }
  if (filters.status) {
    sqliteParams.status = filters.status;
    sqliteClauses.push("o.status = @status");
  }

  const sqliteWhere = sqliteClauses.length ? `WHERE ${sqliteClauses.join(" AND ")}` : "";
  const rows = sqliteDb!.prepare(`SELECT * FROM orders o ${sqliteWhere} ORDER BY o.ordered_at DESC`).all(sqliteParams) as OrderRow[];
  return rows.map(mapOrderRowSync);
}

export async function summarizeOrders(filters: { batchId?: string; brand?: Brand; status?: OrderStatus }): Promise<SummaryRow[]> {
  const orders = await listOrders(filters);
  const groups = new Map<string, SummaryRow>();

  for (const order of orders) {
    for (const item of order.items) {
      const key = `${item.brand}|${item.category}|${item.menuName}|${item.size}`;
      const group: SummaryRow = groups.get(key) ?? {
        brand: item.brand,
        menuName: item.menuName,
        category: item.category,
        size: item.size,
        quantity: 0,
        requests: []
      };

      group.quantity += item.quantity;
      if (item.customRequest) {
        group.requests.push({ ordererName: order.ordererName, customRequest: item.customRequest });
      }
      groups.set(key, group);
    }
  }

  return [...groups.values()].sort((a, b) =>
    `${a.brand}${a.category}${a.menuName}${a.size}`.localeCompare(`${b.brand}${b.category}${b.menuName}${b.size}`)
  );
}

export async function listPopularMenus(filters: { batchId?: string; brand?: Brand; limit?: number }) {
  const orders = await listOrders({ batchId: filters.batchId, brand: filters.brand });
  const groups = new Map<string, { menuId: string; menuName: string; category: string; quantity: number }>();

  for (const order of orders) {
    if (order.status === "cancelled") continue;

    for (const item of order.items) {
      const current = groups.get(item.menuId) ?? {
        menuId: item.menuId,
        menuName: item.menuName,
        category: item.category,
        quantity: 0
      };
      current.quantity += item.quantity;
      groups.set(item.menuId, current);
    }
  }

  return [...groups.values()]
    .sort((a, b) => b.quantity - a.quantity || a.menuName.localeCompare(b.menuName))
    .slice(0, filters.limit ?? 3);
}

export async function getOrderById(orderId: string): Promise<Order | undefined> {
  if (isPostgres()) {
    const row = await pgOne<OrderRow>("SELECT * FROM orders WHERE id = $1", [orderId]);
    return row ? mapOrderRowAsync(row) : undefined;
  }

  const row = sqliteDb!.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as OrderRow | undefined;
  return row ? mapOrderRowSync(row) : undefined;
}

async function listOrderBatches(options: { status?: OrderBatchStatus; includeCounts: boolean }): Promise<OrderBatch[]> {
  if (isPostgres()) {
    const rows = options.includeCounts
      ? await pgAll<BatchWithCountsRow>(
          `
            SELECT
              b.*,
              COUNT(DISTINCT o.id) AS order_count,
              COALESCE(SUM(oi.quantity), 0) AS cup_count
            FROM order_batches b
            LEFT JOIN orders o ON o.batch_id = b.id
            LEFT JOIN order_items oi ON oi.order_id = o.id
            ${options.status ? "WHERE b.status = $1" : ""}
            GROUP BY b.id
            ORDER BY b.created_at DESC
          `,
          options.status ? [options.status] : []
        )
      : await pgAll<BatchWithCountsRow>(
          `SELECT * FROM order_batches ${options.status ? "WHERE status = $1" : ""} ORDER BY created_at DESC`,
          options.status ? [options.status] : []
        );
    return rows.map((row) => mapBatchRow(row, options.includeCounts));
  }

  if (options.includeCounts) {
    const rows = sqliteDb!
      .prepare(
        `
          SELECT
            b.*,
            COUNT(DISTINCT o.id) AS order_count,
            COALESCE(SUM(oi.quantity), 0) AS cup_count
          FROM order_batches b
          LEFT JOIN orders o ON o.batch_id = b.id
          LEFT JOIN order_items oi ON oi.order_id = o.id
          ${options.status ? "WHERE b.status = @status" : ""}
          GROUP BY b.id
          ORDER BY b.created_at DESC
        `
      )
      .all(options.status ? { status: options.status } : {}) as BatchWithCountsRow[];
    return rows.map((row) => mapBatchRow(row, true));
  }

  const rows = sqliteDb!
    .prepare(`SELECT * FROM order_batches ${options.status ? "WHERE status = @status" : ""} ORDER BY created_at DESC`)
    .all(options.status ? { status: options.status } : {}) as BatchRow[];
  return rows.map((row) => mapBatchRow(row));
}

function validateOrderInput(input: CreateOrderInput | UpdateOrderInput, batch: OrderBatch | undefined, isEditing: boolean) {
  if (!input.batchId?.trim()) {
    throw new Error("BATCH_REQUIRED");
  }
  if (!batch) {
    throw new Error("BATCH_NOT_FOUND");
  }
  if (batch.status !== "open") {
    throw new Error(isEditing ? "BATCH_CLOSED_EDIT" : "BATCH_CLOSED");
  }
  if (!input.ordererName?.trim() || !input.items.length) {
    throw new Error("ORDER_INPUT_REQUIRED");
  }

  for (const item of input.items) {
    if (!item.quantity || item.quantity < 1) {
      throw new Error("INVALID_QUANTITY");
    }
  }
}

function mapBatchRow(row: BatchWithCountsRow, includeCounts = false): OrderBatch {
  return {
    id: row.id,
    title: row.title,
    department: row.department || "AX팀",
    memo: row.memo ?? undefined,
    status: row.status,
    createdAt: row.created_at,
    closedAt: row.closed_at ?? undefined,
    orderCount: includeCounts ? Number(row.order_count ?? 0) : undefined,
    cupCount: includeCounts ? Number(row.cup_count ?? 0) : undefined
  };
}

async function mapOrderRowAsync(row: OrderRow): Promise<Order> {
  const items = await pgAll<OrderItemRow>("SELECT * FROM order_items WHERE order_id = $1 ORDER BY id ASC", [row.id]);
  return mapOrder(row, items);
}

function mapOrderRowSync(row: OrderRow): Order {
  const items = sqliteDb!
    .prepare("SELECT * FROM order_items WHERE order_id = ? ORDER BY rowid ASC")
    .all(row.id) as OrderItemRow[];
  return mapOrder(row, items);
}

function mapOrder(row: OrderRow, items: OrderItemRow[]): Order {
  return {
    id: row.id,
    batchId: row.batch_id,
    batchTitle: row.batch_title,
    orderedAt: row.ordered_at,
    ordererName: row.orderer_name,
    status: row.status,
    items: items.map(mapOrderItemRow)
  };
}

function mapOrderItemRow(row: OrderItemRow): OrderItem {
  return {
    id: row.id,
    orderId: row.order_id,
    brand: row.brand,
    menuId: row.menu_id,
    menuName: row.menu_name,
    category: row.category,
    size: row.size,
    quantity: row.quantity,
    customRequest: row.custom_request ?? undefined
  };
}
