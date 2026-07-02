// order-success.module.ts
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { OrderSuccessComponent } from './order-success.component';
import { OrderSuggestionsComponent } from './order-suggestions/order-suggestions.component';

const routes: Routes = [{ path: '', component: OrderSuccessComponent }];

@NgModule({
  declarations: [OrderSuccessComponent],
  imports: [
    CommonModule, 
    RouterModule.forChild(routes),
    OrderSuggestionsComponent
  ],
})
export class OrderSuccessModule { }
