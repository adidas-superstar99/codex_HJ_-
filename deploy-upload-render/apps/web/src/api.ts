import type { Brand, CartItem, Order, OrderStatus, SummaryRow } from "./types";

export async function fetchMenus(params: { brand?: Brand; category?: string; query?: string }) {
  const url = new URL("/api/menus", window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });

  const response = await fetch(url);
  if (!response.ok) throw new Error("메뉴를 불러오지 못했습니다.");
  return response.json();
}

export async function createOrder(payload: {
  ordererName: string;
  team?: string;
  contact?: string;
  memo?: string;
  items: CartItem[];
}) {
  const response = await fetch("/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) throw new Error("주문 저장에 실패했습니다.");
  return response.json() as Promise<Order>;
}

export async function fetchAdminOrders(password: string, params: { date?: string; brand?: Brand | "ALL"; status?: OrderStatus | "ALL" }) {
  const url = new URL("/api/orders", window.location.origin);
  appendAdminParams(url, params);
  const response = await fetch(url, { headers: adminHeaders(password) });
  if (!response.ok) throw new Error("관리자 인증 또는 주문 조회에 실패했습니다.");
  return response.json() as Promise<Order[]>;
}

export async function fetchSummary(password: string, params: { date?: string; brand?: Brand | "ALL"; status?: OrderStatus | "ALL" }) {
  const url = new URL("/api/orders/summary", window.location.origin);
  appendAdminParams(url, params);
  const response = await fetch(url, { headers: adminHeaders(password) });
  if (!response.ok) throw new Error("집계를 불러오지 못했습니다.");
  return response.json() as Promise<SummaryRow[]>;
}

export async function updateStatus(password: string, orderId: string, status: OrderStatus) {
  const response = await fetch(`/api/orders/${orderId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...adminHeaders(password) },
    body: JSON.stringify({ status })
  });

  if (!response.ok) throw new Error("상태 변경에 실패했습니다.");
  return response.json() as Promise<Order>;
}

export function exportCsvUrl(params: { date?: string; brand?: Brand | "ALL"; status?: OrderStatus | "ALL" }) {
  const url = new URL("/api/orders/export.csv", window.location.origin);
  appendAdminParams(url, params);
  return url.pathname + url.search;
}

export function adminHeaders(password: string) {
  return { "x-admin-password": password };
}

function appendAdminParams(url: URL, params: { date?: string; brand?: Brand | "ALL"; status?: OrderStatus | "ALL" }) {
  if (params.date) url.searchParams.set("date", params.date);
  if (params.brand && params.brand !== "ALL") url.searchParams.set("brand", params.brand);
  if (params.status && params.status !== "ALL") url.searchParams.set("status", params.status);
}
