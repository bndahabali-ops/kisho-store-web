// ─────────────────────────────────────────────────────────────────────────────
// cart.service.ts — Signals-based Cart with LocalStorage persistence
//
// Architecture:
//  • Internal state lives in a `signal<Map<string, CartItem>>()`
//  • All public reads are `computed()` signals — zero imperative subscriptions
//  • All writes go through a single `_commit()` that atomically updates the
//    signal AND writes to localStorage in one call
//  • No RxJS streams in the state layer — pure Signals throughout
// ─────────────────────────────────────────────────────────────────────────────

import { Injectable, computed, signal, effect } from '@angular/core';
import { CartItem, buildCartKey } from '../models/product.model';

const CART_STORAGE_KEY = 'kisho_cart_v1';
const MAX_QUANTITY_PER_ITEM = 10;

@Injectable({ providedIn: 'root' })
export class CartService {

  // ── Private state ──────────────────────────────────────────────────────────
  /**
   * The canonical source of truth. A `Map` gives us O(1) add/update/remove
   * keyed on the composite `cartKey` (productId::color::size).
   */
  private readonly _items = signal<Map<string, CartItem>>(
    this._loadFromStorage()
  );

  // ── Public read-only computed signals ──────────────────────────────────────

  /** Live array of cart items — use this in templates */
  readonly items = computed<CartItem[]>(() =>
    Array.from(this._items().values())
  );

  /** Total number of *distinct* line items (badge count) */
  readonly itemCount = computed<number>(() => this._items().size);

  /** Total quantity across all items (e.g. 3 × shirts + 2 × pants = 5) */
  readonly totalQuantity = computed<number>(() =>
    this.items().reduce((sum, item) => sum + item.quantity, 0)
  );

  /** Grand total price */
  readonly totalPrice = computed<number>(() =>
    this.items().reduce((sum, item) => {
      const price = item.discountPrice && item.discountPrice > 0 ? (item.basePrice - item.discountPrice) : item.basePrice;
      return sum + price * item.quantity;
    }, 0)
  );

  /** True if the cart has at least one item */
  readonly isEmpty = computed<boolean>(() => this._items().size === 0);

  /** True if the cart drawer/modal should show a summary */
  readonly hasItems = computed<boolean>(() => this._items().size > 0);

  // ── Side-effect: persist to localStorage on every state change ─────────────
  constructor() {
    /**
     * `effect()` runs after each signal write, inside Angular's change
     * detection cycle — safe to call localStorage here.
     * `allowSignalWrites: false` (default) is intentional: we only READ
     * `_items` in this effect to serialize it; we never write back.
     */
    effect(() => {
      const map = this._items();
      this._saveToStorage(map);
    });
  }

  // ── Write API ──────────────────────────────────────────────────────────────

  /**
   * Add a product variant to the cart.
   * If the exact same (productId + color + size) already exists,
   * the quantity is *incremented* (up to MAX_QUANTITY_PER_ITEM).
   */
  addItem(payload: Omit<CartItem, 'cartKey'>): void {
    const key = buildCartKey(payload.productId, payload.color, payload.size);

    this._commit(map => {
      const existing = map.get(key);
      if (existing) {
        const newQty = Math.min(
          existing.quantity + payload.quantity,
          existing.maxStock,
          MAX_QUANTITY_PER_ITEM
        );
        map.set(key, { ...existing, quantity: newQty });
      } else {
        map.set(key, {
          ...payload,
          cartKey: key,
          quantity: Math.min(payload.quantity, payload.maxStock, MAX_QUANTITY_PER_ITEM),
        });
      }
    });
  }

  /**
   * Set an item's quantity explicitly.
   * Passing quantity ≤ 0 removes the item entirely.
   */
  setQuantity(cartKey: string, quantity: number): void {
    if (quantity <= 0) {
      this.removeItem(cartKey);
      return;
    }

    this._commit(map => {
      const existing = map.get(cartKey);
      if (!existing) return;
      const capped = Math.min(quantity, existing.maxStock, MAX_QUANTITY_PER_ITEM);
      map.set(cartKey, { ...existing, quantity: capped });
    });
  }

  /**
   * Increment a single item's quantity by 1.
   * Silently clamps at maxStock and MAX_QUANTITY_PER_ITEM.
   */
  incrementItem(cartKey: string): void {
    this._commit(map => {
      const existing = map.get(cartKey);
      if (!existing) return;
      const newQty = Math.min(
        existing.quantity + 1,
        existing.maxStock,
        MAX_QUANTITY_PER_ITEM
      );
      map.set(cartKey, { ...existing, quantity: newQty });
    });
  }

  /**
   * Decrement a single item's quantity by 1.
   * Removes the item if quantity would drop to 0.
   */
  decrementItem(cartKey: string): void {
    this._commit(map => {
      const existing = map.get(cartKey);
      if (!existing) return;
      if (existing.quantity <= 1) {
        map.delete(cartKey);
      } else {
        map.set(cartKey, { ...existing, quantity: existing.quantity - 1 });
      }
    });
  }

  /** Remove a single line item by its composite cart key */
  removeItem(cartKey: string): void {
    this._commit(map => map.delete(cartKey));
  }

  /** Wipe the entire cart (called after successful order placement) */
  clearCart(): void {
    this._commit(map => map.clear());
  }

  // ── Query helpers ──────────────────────────────────────────────────────────

  /**
   * Get the quantity for a specific variant — useful for the product page
   * "Add to Cart" button to show "In Cart: X".
   * Returns 0 if the variant is not in the cart.
   */
  getItemQuantity(productId: string, color: string, size: string): number {
    const key = buildCartKey(productId, color, size);
    return this._items().get(key)?.quantity ?? 0;
  }

  /** Check if a specific variant is already in the cart */
  isInCart(productId: string, color: string, size: string): boolean {
    const key = buildCartKey(productId, color, size);
    return this._items().has(key);
  }

  /**
   * Build the `items[]` payload required by POST /api/store/orders.
   * Strips all UI-only fields (image, colorHex, title, maxStock, cartKey).
   */
  buildOrderItems(): { productId: string; color: string; size: string; quantity: number }[] {
    return this.items().map(({ productId, color, size, quantity }) => ({
      productId,
      color,
      size,
      quantity,
    }));
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * The ONLY method that mutates `_items`.
   * It creates a fresh Map copy so Angular's signal equality check
   * correctly detects the change and re-renders dependents.
   */
  private _commit(mutate: (map: Map<string, CartItem>) => void): void {
    const next = new Map(this._items());
    mutate(next);
    this._items.set(next);
  }

  /** Serialize Map → plain object array and write to localStorage */
  private _saveToStorage(map: Map<string, CartItem>): void {
    try {
      const serialized = JSON.stringify(Array.from(map.values()));
      localStorage.setItem(CART_STORAGE_KEY, serialized);
    } catch (e) {
      // localStorage may be full or blocked (private browsing in some browsers)
      console.warn('[CartService] Could not persist cart to localStorage:', e);
    }
  }

  /**
   * Deserialize localStorage → Map<string, CartItem>.
   * Called once in the constructor. Invalid/corrupt data is silently
   * discarded so the app never crashes on a bad stored value.
   */
  private _loadFromStorage(): Map<string, CartItem> {
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      if (!raw) return new Map();

      const parsed = JSON.parse(raw) as CartItem[];
      if (!Array.isArray(parsed)) return new Map();

      const map = new Map<string, CartItem>();
      for (const item of parsed) {
        // Basic runtime guard: skip any malformed entries
        if (
          item.cartKey &&
          item.productId &&
          typeof item.quantity === 'number' &&
          item.quantity > 0
        ) {
          map.set(item.cartKey, item);
        }
      }
      return map;
    } catch {
      return new Map();
    }
  }
}
