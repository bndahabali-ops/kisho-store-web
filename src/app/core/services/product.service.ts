// ─────────────────────────────────────────────────────────────────────────────
// product.service.ts — Communicates with GET /api/store/products endpoints
//
// Design decisions:
//  • HttpClient calls are wrapped in RxJS Observables (standard Angular pattern)
//  • Responses are typed against our model interfaces
//  • Caching: a simple in-memory Map cache reduces redundant GET calls for
//    product detail pages (cleared on destroy for any component-scoped use)
// ─────────────────────────────────────────────────────────────────────────────

import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, shareReplay } from 'rxjs';
import { map, tap } from 'rxjs/operators';

import { Product } from '../models/product.model';
import { PaginatedResponse, ProductQueryParams } from '../models/api-response.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ProductService {

  private readonly baseUrl = `${environment.apiUrl}/store/products`;

  /**
   * Simple in-memory cache for product detail pages.
   * Key: product _id | Value: the Product object.
   * Prevents re-fetching when a user navigates back to a product they've seen.
   */
  private readonly _cache = new Map<string, Product>();

  constructor(private readonly http: HttpClient) { }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * GET /api/store/products
   * Supports all documented query params: category, search, minPrice,
   * maxPrice, page, limit.
   */
  getProducts(params: ProductQueryParams = {}): Observable<PaginatedResponse<Product>> {
    const httpParams = this._buildParams(params);
    return this.http.get<PaginatedResponse<Product>>(this.baseUrl, { params: httpParams });
  }

  /**
   * GET /api/store/products/:id
   * Returns a cached result if available to avoid duplicate network calls.
   */
  getProductById(id: string): Observable<Product> {
    if (this._cache.has(id)) {
      return of(this._cache.get(id)!);
    }

    return this.http
      .get<{ status: string; data: { product: Product } }>(`${this.baseUrl}/${id}`)
      .pipe(
        map(response => response.data.product),
        tap(product => this._cache.set(id, product)),
        shareReplay(1)
      );
  }

  /** Fetch recommended products based on currently ordered product IDs */
  getRecommendations(orderedProductIds: string[]): Observable<{ success: boolean; products: any[] }> {
    let params = new HttpParams();
    if (orderedProductIds && orderedProductIds.length > 0) {
      params = params.set('orderedProductIds', orderedProductIds.join(','));
    }
    return this.http.get<{ success: boolean; products: any[] }>(`${this.baseUrl}/recommendations`, { params });
  }

  /** Fetch visible categories for storefront */
  getCategories(): Observable<{ status: string; message: string; data: { categories: any[] } }> {
    return this.http.get<{ status: string; message: string; data: { categories: any[] } }>(
      `${environment.apiUrl}/categories`
    );
  }

  /** Manually clear the detail cache (e.g. after admin stock updates) */
  clearCache(): void {
    this._cache.clear();
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private _buildParams(query: ProductQueryParams): HttpParams {
    let params = new HttpParams();
    const add = (key: string, value: string | number | boolean | undefined) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    };

    add('category', query.category);
    add('search', query.search);
    add('minPrice', query.minPrice);
    add('maxPrice', query.maxPrice);
    add('page', query.page ?? 1);
    add('limit', Math.min(query.limit ?? 12, 50)); // backend hard cap: 50
    add('isNewArrival', query.isNewArrival);

    return params;
  }
}
