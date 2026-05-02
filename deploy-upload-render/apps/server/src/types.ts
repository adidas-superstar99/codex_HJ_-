export type Brand = "STARBUCKS" | "TWOSOME";

export type Menu = {
  id: string;
  brand: Brand;
  category: string;
  name: string;
  imageUrl: string;
  sourceUrl: string;
  isNew?: boolean;
  isSeasonal?: boolean;
  availableSizes: string[];
  createdAt: string;
  updatedAt: string;
};

export type OrderBatchStatus = "open" | "closed";
export type OrderStatus = "submitted" | "confirmed" | "ordered" | "completed" | "cancelled";

export type OrderBatch = {
  id: string;
  title: string;
  memo?: string;
  status: OrderBatchStatus;
  createdAt: string;
  closedAt?: string;
  orderCount?: number;
  cupCount?: number;
};

export type OrderItem = {
  id: string;
  orderId: string;
  brand: Brand;
  menuId: string;
  menuName: string;
  category: string;
  size: string;
  quantity: number;
  customRequest?: string;
};

export type Order = {
  id: string;
  batchId: string;
  batchTitle: string;
  orderedAt: string;
  ordererName: string;
  status: OrderStatus;
  items: OrderItem[];
};

export type CreateOrderBatchInput = {
  title: string;
  memo?: string;
};

export type UpdateOrderBatchInput = {
  title?: string;
  memo?: string;
  status?: OrderBatchStatus;
};

export type CreateOrderInput = {
  batchId: string;
  ordererName: string;
  items: Array<{
    brand: Brand;
    menuId: string;
    menuName: string;
    category: string;
    size: string;
    quantity: number;
    customRequest?: string;
  }>;
};

export type UpdateOrderInput = CreateOrderInput;

export type SummaryRow = {
  brand: Brand;
  menuName: string;
  category: string;
  size: string;
  quantity: number;
  requests: Array<{ ordererName: string; customRequest: string }>;
};
