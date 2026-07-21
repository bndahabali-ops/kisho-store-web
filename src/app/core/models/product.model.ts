// ─────────────────────────────────────────────────────────────────────────────
// product.model.ts — Type-safe interfaces mirroring the backend Product schema
// ─────────────────────────────────────────────────────────────────────────────

export interface ProductVariant {
  color: string;
  colorHex: string;      // e.g. "#7B1C2E" for "Wine Red"
  images: string[];      // Array of image URLs for this color variant
  sizes: SizeStock[];
}

export interface SizeStock {
  size: string;          // "Small" | "Medium" | "Large" | "XL" | "XXL" etc.
  stock: number;
}

export interface CategoryModel {
  nameAr: string;
  nameEn: string;
  slug: string;
}

export interface Product {
  _id: string;
  title: string;
  description: string;
  basePrice: number;
  discountPrice?: number;
  category: string | CategoryModel;
  variants: ProductVariant[];
  isNewArrival?: boolean;
  sizeChartImage?: string;
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cart-specific interfaces (LocalStorage layer)
// ─────────────────────────────────────────────────────────────────────────────

export interface CartItem {
  /** Unique key = productId + color + size (used as the Map key) */
  cartKey: string;
  productId: string;
  title: string;
  basePrice: number;
  discountPrice?: number;
  /** Selected variant details */
  color: string;
  colorHex: string;
  size: string;
  quantity: number;
  /** Snapshot of the first image for the chosen color */
  image: string;
  /** Max available stock at the time of adding — used for UI cap validation */
  maxStock: number;
}

/** Helper to build a deterministic, unique cart key */
export function buildCartKey(productId: string, color: string, size: string): string {
  return `${productId}::${color}::${size}`;
}
