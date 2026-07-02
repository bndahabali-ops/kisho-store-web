// ─────────────────────────────────────────────────────────────────────────────
// order.service.ts — Communicates with POST /api/store/orders
//
// Design decisions:
//  • The service owns the HTTP call but NOT the form state
//  • 409 Conflict is caught here and re-thrown as a typed error object
//    so the checkout component can show a specific "out of stock" message
//  • A `submitting` Signal is exposed so any component can show a global
//    loading indicator without prop-drilling
// ─────────────────────────────────────────────────────────────────────────────

import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

import {
  CreateOrderPayload,
  CreateOrderResponse,
  OrderConflictError,
} from '../models/order.model';
import { environment } from '../../../environments/environment';

/** Typed error that the checkout component can distinguish from generic errors */
export interface OrderError {
  type: 'conflict' | 'rate_limited' | 'validation' | 'network' | 'unknown';
  message: string;
  /** Populated when type === 'conflict' */
  conflictingItems?: string[];
}

@Injectable({ providedIn: 'root' })
export class OrderService {

  private readonly orderUrl = `${environment.apiUrl}/store/orders`;

  // ── Public Signals ─────────────────────────────────────────────────────────

  /**
   * True while the HTTP request is in-flight.
   * Bind to this in the checkout button: `[disabled]="orderService.submitting()"`.
   * Using a Signal (not BehaviorSubject) keeps it consistent with CartService.
   */
  readonly submitting = signal<boolean>(false);

  /**
   * Stores the last successful order confirmation.
   * The success page can read this to display the order reference number
   * without requiring a separate route param or state transfer.
   */
  /**
   * Stores the last successful order confirmation.
   * The success page can read this to display the order reference number
   * without requiring a separate route param or state transfer.
   */
  readonly lastOrderConfirmation = signal<CreateOrderResponse['data'] | null>(null);

  /**
   * Stores the product IDs of the last placed order.
   * Used for fetching product recommendations on the order success page.
   */
  readonly lastOrderedProductIds = signal<string[]>([]);

  constructor(private readonly http: HttpClient) { }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * POST /api/store/orders
   *
   * Returns an Observable that:
   *  • Emits `CreateOrderResponse` on 201 success
   *  • Errors with a typed `OrderError` on 409/429/422/network failures
   *
   * The checkout component is responsible for subscribing and calling
   * `cartService.clearCart()` on success.
   */
  placeOrder(payload: CreateOrderPayload): Observable<CreateOrderResponse> {
    this.submitting.set(true);
    const productIds = payload.items.map(item => item.productId);

    return this.http
      .post<CreateOrderResponse>(this.orderUrl, payload)
      .pipe(
        tap(response => {
          this.lastOrderConfirmation.set(response.data);
          this.lastOrderedProductIds.set(productIds);
          this.submitting.set(false);
        }),
        catchError((err: HttpErrorResponse) => {
          this.submitting.set(false);
          return throwError(() => this._mapError(err));
        })
      );
  }

  /** Clear the last confirmation (e.g. when navigating away from success page) */
  clearConfirmation(): void {
    this.lastOrderConfirmation.set(null);
    this.lastOrderedProductIds.set([]);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private _mapError(err: HttpErrorResponse): OrderError {
    if (!err.status) {
      return { type: 'network', message: 'Network error. Please check your connection.' };
    }

    switch (err.status) {
      case 409: {
        const body = err.error as OrderConflictError;
        return {
          type: 'conflict',
          message: body?.message ?? 'One or more items are out of stock. Please review your cart.',
          conflictingItems: body?.conflictingItems,
        };
      }
      case 422: {
        return {
          type: 'validation',
          message: err.error?.message ?? 'Invalid order data. Please check your details.',
        };
      }
      case 429: {
        return {
          type: 'rate_limited',
          message: 'Too many requests. Please wait a few minutes before trying again.',
        };
      }
      default: {
        return {
          type: 'unknown',
          message: err.error?.message ?? 'Something went wrong. Please try again.',
        };
      }
    }
  }
}
