export type Brand = "STARBUCKS" | "TWOSOME";

export type OrderBatchStatus = "open" | "closed";
export type OrderStatus = "submitted" | "confirmed" | "ordered" | "completed" | "cancelled";

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
};

export type OrderBatch = {
  id: string;
  title: string;
  department: string;
  memo?: string;
  status: OrderBatchStatus;
  createdAt: string;
  closedAt?: string;
  orderCount?: number;
  cupCount?: number;
};

export type CartItem = {
  localId: string;
  brand: Brand;
  menuId: string;
  menuName: string;
  category: string;
  size: string;
  quantity: number;
  customRequest?: string;
};

export type OrderItem = Omit<CartItem, "localId"> & {
  id: string;
  orderId: string;
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

export type PopularMenu = {
  menuId: string;
  menuName: string;
  category: string;
  quantity: number;
};

export type SummaryRow = {
  brand: Brand;
  menuName: string;
  category: string;
  size: string;
  quantity: number;
  requests: Array<{ ordererName: string; customRequest: string }>;
};
