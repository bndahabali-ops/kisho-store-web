// ─────────────────────────────────────────────────────────────────────────────
// api-response.model.ts — Generic API response envelope
// ─────────────────────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  status: 'success' | 'error';
  message?: string;
  data?: T;
  pagination?: Pagination;
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  status: 'success';
  data: T[];
  pagination: Pagination;
}

/** Generic query params for GET /api/store/products */
export interface ProductQueryParams {
  category?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  limit?: number;
  isNewArrival?: boolean | string;
}
