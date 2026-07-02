// ─────────────────────────────────────────────────────────────────────────────
// order.model.ts — Type-safe interfaces for the Order API payload & responses
// ─────────────────────────────────────────────────────────────────────────────

export interface OrderItem {
  productId: string;
  color: string;
  size: string;
  quantity: number;
}

export interface ShippingAddress {
  fullName: string;
  phone: string;
  city: string;
  governorate?: string;
  region?: string;
  address: string;
  email: string;
  notes?: string;
}

export type PaymentMethod = 'cash_on_delivery';

/** The exact POST /api/store/orders request body */
export interface CreateOrderPayload {
  items: OrderItem[];
  shippingAddress: ShippingAddress;
  paymentMethod: PaymentMethod;
}

/** The success data block inside the 201 response */
export interface OrderConfirmation {
  orderRef: string;
  totalAmount: number;
  status: string;
  createdAt: string;
}

/** Full 201 success response wrapper */
export interface CreateOrderResponse {
  status: 'success';
  message: string;
  data: OrderConfirmation;
}

/** 409 Conflict response structure from the backend */
export interface OrderConflictError {
  status: 'error';
  message: string;         // e.g. "Insufficient stock for item: ..."
  conflictingItems?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin Orders (for future admin panel extension)
// ─────────────────────────────────────────────────────────────────────────────

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export interface Order {
  _id: string;
  orderRef: string;
  items: OrderItem[];
  shippingAddress: ShippingAddress;
  paymentMethod: PaymentMethod;
  shippingFees: number;
  estimatedDeliveryTime: string;
  totalAmount: number;
  status: OrderStatus;
  adminNote?: string;
  createdAt: string;
  updatedAt: string;
}
