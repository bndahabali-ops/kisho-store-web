import { Component, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { CartService } from '../../core/services/cart.service';
import { CartItem } from '../../core/models/product.model';

@Component({
  selector: 'app-cart',
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartComponent {
  constructor(
    readonly cartService: CartService,
    private readonly router: Router
  ) {}

  trackByKey(_: number, item: CartItem): string {
    return item.cartKey;
  }

  goToProduct(productId: string): void {
    this.router.navigate(['/product', productId]);
  }

  goToCheckout(): void {
    this.router.navigate(['/checkout']);
  }
}
