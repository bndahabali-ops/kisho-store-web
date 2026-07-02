import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { ProductService } from '../../../core/services/product.service';
import { OrderService } from '../../../core/services/order.service';
import { CartService } from '../../../core/services/cart.service';
import { CategoryTranslatePipe } from '../../../shared/pipes/category-translate.pipe';

@Component({
  selector: 'app-order-suggestions',
  standalone: true,
  imports: [CommonModule, HttpClientModule, CategoryTranslatePipe],
  templateUrl: './order-suggestions.component.html',
  styleUrls: ['./order-suggestions.component.scss']
})
export class OrderSuggestionsComponent implements OnInit {
  readonly products = signal<any[]>([]);
  readonly loading = signal<boolean>(true);
  readonly addingProductId = signal<string | null>(null);
  readonly addedProductId = signal<string | null>(null);

  constructor(
    private readonly productService: ProductService,
    private readonly orderService: OrderService,
    private readonly cartService: CartService
  ) {}

  ngOnInit(): void {
    this.fetchRecommendations();
  }

  fetchRecommendations(): void {
    this.loading.set(true);
    const orderedIds = this.orderService.lastOrderedProductIds();
    
    this.productService.getRecommendations(orderedIds).subscribe({
      next: (res) => {
        if (res && res.success) {
          this.products.set(res.products || []);
        } else {
          this.products.set([]);
        }
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load suggestions:', err);
        this.products.set([]);
        this.loading.set(false);
      }
    });
  }

  quickAdd(product: any): void {
    if (product.stock === 0) return;
    
    this.addingProductId.set(product._id);
    this.productService.getProductById(product._id).subscribe({
      next: (fullProduct) => {
        // Find the first variant with stock, or fall back to the first variant
        const firstVariant = fullProduct.variants?.find((v: any) => v.sizes?.some((s: any) => s.stock > 0))
                          || fullProduct.variants?.[0];

        if (!firstVariant) {
          this.addingProductId.set(null);
          return;
        }

        const firstSize = firstVariant.sizes?.find((s: any) => s.stock > 0)
                       || firstVariant.sizes?.[0];

        if (!firstSize) {
          this.addingProductId.set(null);
          return;
        }

        this.cartService.addItem({
          productId: fullProduct._id,
          title: fullProduct.title,
          basePrice: fullProduct.basePrice,
          discountPrice: fullProduct.discountPrice || 0,
          color: firstVariant.color,
          colorHex: firstVariant.colorHex || '#000000',
          size: firstSize.size,
          quantity: 1,
          image: firstVariant.images?.[0] || product.images?.[0] || '',
          maxStock: firstSize.stock
        });

        this.addedProductId.set(product._id);
        this.addingProductId.set(null);

        setTimeout(() => {
          this.addedProductId.set(null);
        }, 2000);
      },
      error: (err) => {
        console.error('Error fetching product for quick add:', err);
        this.addingProductId.set(null);
      }
    });
  }
}
