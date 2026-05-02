import type { Order } from "../types.js";

const header = ["주문일시", "주문자", "브랜드", "카테고리", "메뉴명", "사이즈", "수량", "개인요청사항", "상태"];

export function ordersToCsv(orders: Order[]) {
  const rows = orders.flatMap((order) =>
    order.items.map((item) => [
      formatDateTime(order.orderedAt),
      order.ordererName,
      item.brand,
      item.category,
      item.menuName,
      item.size,
      String(item.quantity),
      item.customRequest ?? "",
      order.status
    ])
  );

  return [header, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\r\n");
}

function escapeCsv(value: string) {
  const escaped = value.replace(/"/g, '""');
  return /[",\r\n]/.test(escaped) ? `"${escaped}"` : escaped;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Seoul"
  }).format(new Date(value));
}
