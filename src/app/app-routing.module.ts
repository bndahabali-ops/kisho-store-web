// app-routing.module.ts — Lazy-loaded routes for all features
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    loadChildren: () =>
      import('./features/home/home.module').then(m => m.HomeModule),
  },
  {
    path: 'shop',
    loadChildren: () =>
      import('./features/shop/shop.module').then(m => m.ShopModule),
  },
  {
    path: 'product/:id',
    loadChildren: () =>
      import('./features/product-detail/product-detail.module').then(m => m.ProductDetailModule),
  },
  {
    path: 'cart',
    loadChildren: () =>
      import('./features/cart/cart.module').then(m => m.CartModule),
  },
  {
    path: 'checkout',
    loadChildren: () =>
      import('./features/checkout/checkout.module').then(m => m.CheckoutModule),
  },
  {
    path: 'order-success',
    loadChildren: () =>
      import('./features/order-success/order-success.module').then(m => m.OrderSuccessModule),
  },
  
  { path: '**', redirectTo: '', pathMatch: 'full' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { scrollPositionRestoration: 'top' })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
