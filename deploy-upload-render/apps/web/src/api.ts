import type {
  Brand,
  CartItem,
  Order,
  OrderBatch,
  OrderBatchStatus,
  OrderStatus,
  PopularMenu,
  SummaryRow
} from "./types";

type AdminFilters = {
  batchId?: string;
  brand?: Brand | "ALL";
  status?: OrderStatus | "ALL";
};

type OrderPayload = {
  batchId: string;
  ordererName: string;
  items: Array<Omit<CartItem, "localId">>;
};

export async function fetchMenus(params: { brand?: Brand; category?: string; query?: string }) {
  const url = new URL("/api/menus", window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });

  const response = await fetch(url);
  if (!response.ok) throw new Error("메뉴를 불러오지 못했습니다.");
  return response.json();
}

export async function fetchPublicBatches() {
  const response = await fetch("/api/order-batches");
  if (!response.ok) throw new Error("주문 목록을 불러오지 못했습니다.");
  return response.json() as Promise<OrderBatch[]>;
}

export async function fetchBatch(batchId: string) {
  const response = await fetch(`/api/order-batches/${batchId}`);
  if (!response.ok) throw new Error("주문 목록을 찾을 수 없습니다.");
  return response.json() as Promise<OrderBatch>;
}

export async function fetchBatchOrders(batchId: string) {
  const response = await fetch(`/api/order-batches/${batchId}/orders`);
  if (!response.ok) throw new Error("주문 목록을 불러오지 못했습니다.");
  return response.json() as Promise<Order[]>;
}

export async function fetchPopularMenus(params: { batchId: string; brand: Brand; limit?: number }) {
  const url = new URL("/api/orders/popular", window.location.origin);
  url.searchParams.set("batchId", params.batchId);
  url.searchParams.set("brand", params.brand);
  if (params.limit) url.searchParams.set("limit", String(params.limit));

  const response = await fetch(url);
  if (!response.ok) throw new Error("인기 메뉴를 불러오지 못했습니다.");
  return response.json() as Promise<PopularMenu[]>;
}

export async function createOrder(payload: OrderPayload) {
  const response = await fetch("/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) throw new Error(await readError(response, "주문 저장에 실패했습니다."));
  return response.json() as Promise<Order>;
}

export async function updateOrder(orderId: string, payload: OrderPayload) {
  const response = await fetch(`/api/orders/${orderId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) throw new Error(await readError(response, "주문 수정에 실패했습니다."));
  return response.json() as Promise<Order>;
}

export async function cancelOwnOrder(orderId: string, ordererName: string) {
  const response = await fetch(`/api/orders/${orderId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ordererName })
  });

  if (!response.ok) throw new Error(await readError(response, "주문 취소에 실패했습니다."));
}

export async function fetchAdminBatches(password: string) {
  const response = await fetch("/api/admin/order-batches", { headers: adminHeaders(password) });
  if (!response.ok) throw new Error("관리자 비밀번호가 맞지 않습니다.");
  return response.json() as Promise<OrderBatch[]>;
}

export async function createBatch(password: string, payload: { title: string; department?: string; memo?: string }) {
  const response = await fetch("/api/admin/order-batches", {
    method: "POST",
    headers: { ...adminHeaders(password), "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) throw new Error(await readError(response, "주문 목록 생성에 실패했습니다."));
  return response.json() as Promise<OrderBatch>;
}

export async function updateBatch(
  password: string,
  batchId: string,
  payload: { title?: string; department?: string; memo?: string; status?: OrderBatchStatus }
) {
  const response = await fetch(`/api/admin/order-batches/${batchId}`, {
    method: "PATCH",
    headers: { ...adminHeaders(password), "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) throw new Error(await readError(response, "주문 목록 변경에 실패했습니다."));
  return response.json() as Promise<OrderBatch>;
}

export async function deleteBatch(password: string, batchId: string) {
  const response = await fetch(`/api/admin/order-batches/${batchId}`, {
    method: "DELETE",
    headers: adminHeaders(password)
  });

  if (!response.ok) throw new Error(await readError(response, "주문 목록 삭제에 실패했습니다."));
}

export async function fetchAdminOrders(password: string, params: AdminFilters) {
  const url = new URL("/api/orders", window.location.origin);
  appendAdminParams(url, params);
  const response = await fetch(url, { headers: adminHeaders(password) });
  if (!response.ok) throw new Error(await readError(response, "주문 조회에 실패했습니다."));
  return response.json() as Promise<Order[]>;
}

export async function fetchSummary(password: string, params: AdminFilters) {
  const url = new URL("/api/orders/summary", window.location.origin);
  appendAdminParams(url, params);
  const response = await fetch(url, { headers: adminHeaders(password) });
  if (!response.ok) throw new Error(await readError(response, "집계를 불러오지 못했습니다."));
  return response.json() as Promise<SummaryRow[]>;
}

export async function updateStatus(password: string, orderId: string, status: OrderStatus) {
  const response = await fetch(`/api/orders/${orderId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...adminHeaders(password) },
    body: JSON.stringify({ status })
  });

  if (!response.ok) throw new Error(await readError(response, "상태 변경에 실패했습니다."));
  return response.json() as Promise<Order>;
}

export async function bulkUpdateStatus(password: string, status: OrderStatus, filters: AdminFilters) {
  const response = await fetch("/api/orders/bulk-status", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...adminHeaders(password) },
    body: JSON.stringify({ status, filters: normalizeFilters(filters) })
  });

  if (!response.ok) throw new Error(await readError(response, "일괄 상태 변경에 실패했습니다."));
  return response.json() as Promise<{ updatedCount: number }>;
}

export async function deleteAdminOrder(password: string, orderId: string) {
  const response = await fetch(`/api/orders/${orderId}`, {
    method: "DELETE",
    headers: adminHeaders(password)
  });

  if (!response.ok) throw new Error(await readError(response, "주문 삭제에 실패했습니다."));
}

export function exportCsvUrl(params: AdminFilters) {
  const url = new URL("/api/orders/export.csv", window.location.origin);
  appendAdminParams(url, params);
  return url.pathname + url.search;
}

export function adminHeaders(password: string) {
  return { "x-admin-password": password };
}

function appendAdminParams(url: URL, params: AdminFilters) {
  const normalized = normalizeFilters(params);
  if (normalized.batchId) url.searchParams.set("batchId", normalized.batchId);
  if (normalized.brand) url.searchParams.set("brand", normalized.brand);
  if (normalized.status) url.searchParams.set("status", normalized.status);
}

function normalizeFilters(params: AdminFilters) {
  return {
    batchId: params.batchId,
    brand: params.brand && params.brand !== "ALL" ? params.brand : undefined,
    status: params.status && params.status !== "ALL" ? params.status : undefined
  };
}

async function readError(response: Response, fallback: string) {
  try {
    const data = (await response.json()) as { message?: string };
    return data.message || fallback;
  } catch {
    return fallback;
  }
}
