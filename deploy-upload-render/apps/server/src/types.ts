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

export type OrderStatus = "submitted" | "confirmed" | "ordered" | "completed" | "cancelled";

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
  orderedAt: string;
  ordererName: string;
  team?: string;
  contact?: string;
  memo?: string;
  status: OrderStatus;
  items: OrderItem[];
};

export type CreateOrderInput = {
  ordererName: string;
  team?: string;
  contact?: string;
  memo?: string;
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
