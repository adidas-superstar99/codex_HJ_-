import { nanoid } from "nanoid";
import { isPostgres, pgAll, pgOne, sqliteDb, withPgTransaction } from "../db.js";
import type { Brand, CreateOrderInput, Order, OrderItem, OrderStatus } from "../types.js";

const statuses: OrderStatus[] = ["submitted", "confirmed", "ordered", "completed", "cancelled"];

type OrderRow = {
  id: string;
  ordered_at: string;
  orderer_name: string;
  team: string | null;
  contact: string | null;
  memo: string | null;
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

export function isOrderStatus(value: string): value is OrderStatus {
  return statuses.includes(value as OrderStatus);
}

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const ordererName = input.ordererName.trim();
  if (!ordererName) throw new Error("ORDERER_NAME_REQUIRED");
  if (!input.items.length) throw new Error("ORDER_ITEMS_REQUIRED");

  const orderedAt = new Date().toISOString();
  const orderId = nanoid();

  for (const item of input.items) {
    if (!item.quantity || item.quantity < 1) {
      throw new Error("INVALID_QUANTITY");
    }
  }

  if (isPostgres()) {
    await withPgTransaction(async (client) => {
      await client.query(
        `INSERT INTO orders (id, ordered_at, orderer_name, team, contact, memo, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'submitted')`,
        [orderId, orderedAt, ordererName, input.team?.trim() || null, input.contact?.trim() || null, input.memo?.trim() || null]
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
    return (await getOrderById(orderId))!;
  }

  const insertOrder = sqliteDb!.prepare(`
    INSERT INTO orders (id, ordered_at, orderer_name, team, contact, memo, status)
    VALUES (@id, @orderedAt, @ordererName, @team, @contact, @memo, 'submitted')
  `);
  const insertItem = sqliteDb!.prepare(`
    INSERT INTO order_items (
      id, order_id, brand, menu_id, menu_name, category, size, quantity, custom_request
    ) VALUES (
      @id, @orderId, @brand, @menuId, @menuName, @category, @size, @quantity, @customRequest
    )
  `);

  const transaction = sqliteDb!.transaction(() => {
    insertOrder.run({
      id: orderId,
      orderedAt,
      ordererName,
      team: input.team?.trim() || null,
      contact: input.contact?.trim() || null,
      memo: input.memo?.trim() || null
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
  });

  transaction();
  return (await getOrderById(orderId))!;
}

export async function listOrders(filters: { date?: string; brand?: Brand; status?: OrderStatus }) {
  const clauses: string[] = [];
  const values: unknown[] = [];

  if (filters.date) {
    const range = getKoreanDateRange(filters.date);
    clauses.push(`o.ordered_at >= $${values.push(range.start)} AND o.ordered_at < $${values.push(range.end)}`);
  }

  if (filters.status) {
    clauses.push(`o.status = $${values.push(filters.status)}`);
  }

  if (filters.brand) {
    clauses.push(`EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.brand = $${values.push(filters.brand)})`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  if (isPostgres()) {
    const rows = await pgAll<OrderRow>(`SELECT * FROM orders o ${where} ORDER BY o.ordered_at DESC`, values);
    const orders = await Promise.all(rows.map(mapOrderRowAsync));
    return orders;
  }

  const sqliteParams: Record<string, string> = {};
  if (filters.date) {
    const range = getKoreanDateRange(filters.date);
    sqliteParams.startDate = range.start;
    sqliteParams.endDate = range.end;
  }
  if (filters.status) sqliteParams.status = filters.status;
  if (filters.brand) sqliteParams.brand = filters.brand;

  const sqliteClauses: string[] = [];
  if (filters.date) sqliteClauses.push("o.ordered_at >= @startDate AND o.ordered_at < @endDate");
  if (filters.status) sqliteClauses.push("o.status = @status");
  if (filters.brand) sqliteClauses.push("EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.brand = @brand)");
  const sqliteWhere = sqliteClauses.length ? `WHERE ${sqliteClauses.join(" AND ")}` : "";
  const rows = sqliteDb!.prepare(`SELECT * FROM orders o ${sqliteWhere} ORDER BY o.ordered_at DESC`).all(sqliteParams) as OrderRow[];
  return rows.map(mapOrderRowSync);
}

export async function getOrderById(orderId: string): Promise<Order | undefined> {
  if (isPostgres()) {
    const row = await pgOne<OrderRow>("SELECT * FROM orders WHERE id = $1", [orderId]);
    return row ? mapOrderRowAsync(row) : undefined;
  }
  const row = sqliteDb!.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as OrderRow | undefined;
  return row ? mapOrderRowSync(row) : undefined;
}

export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  if (isPostgres()) {
    const result = await pgOne<{ id: string }>("UPDATE orders SET status = $1 WHERE id = $2 RETURNING id", [status, orderId]);
    return result ? getOrderById(orderId) : undefined;
  }

  const result = sqliteDb!.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, orderId);
  if (result.changes === 0) return undefined;
  return getOrderById(orderId);
}

export async function summarizeOrders(filters: { date?: string; brand?: Brand; status?: OrderStatus }) {
  const orders = await listOrders(filters);
  const groups = new Map<string, {
    brand: Brand;
    menuName: string;
    category: string;
    size: string;
    quantity: number;
    requests: Array<{ ordererName: string; customRequest: string }>;
  }>();

  for (const order of orders) {
    for (const item of order.items) {
      const key = `${item.brand}|${item.category}|${item.menuName}|${item.size}`;
      const group = groups.get(key) ?? {
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

function getKoreanDateRange(date: string) {
  const start = new Date(`${date}T00:00:00+09:00`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

async function mapOrderRowAsync(row: OrderRow): Promise<Order> {
  const items = await pgAll<OrderItemRow>("SELECT * FROM order_items WHERE order_id = $1 ORDER BY id ASC", [row.id]);
  return {
    id: row.id,
    orderedAt: row.ordered_at,
    ordererName: row.orderer_name,
    team: row.team ?? undefined,
    contact: row.contact ?? undefined,
    memo: row.memo ?? undefined,
    status: row.status,
    items: items.map(mapOrderItemRow)
  };
}

function mapOrderRowSync(row: OrderRow): Order {
  const items = sqliteDb!
    .prepare("SELECT * FROM order_items WHERE order_id = ? ORDER BY rowid ASC")
    .all(row.id) as OrderItemRow[];

  return {
    id: row.id,
    orderedAt: row.ordered_at,
    ordererName: row.orderer_name,
    team: row.team ?? undefined,
    contact: row.contact ?? undefined,
    memo: row.memo ?? undefined,
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
