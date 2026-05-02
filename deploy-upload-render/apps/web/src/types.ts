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
};

export type OrderStatus = "submitted" | "confirmed" | "ordered" | "completed" | "cancelled";

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

export type Order = {
  id: string;
  orderedAt: string;
  ordererName: string;
  team?: string;
  contact?: string;
  memo?: string;
  status: OrderStatus;
  items: Array<CartItem & { id: string; orderId: string }>;
};

export type SummaryRow = {
  brand: Brand;
  menuName: string;
  category: string;
  size: string;
  quantity: number;
  requests: Array<{ ordererName: string; customRequest: string }>;
};
