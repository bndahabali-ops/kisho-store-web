import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Routes } from "@angular/router";
import { ProductDetailComponent } from "./product-detail.component";
import { CategoryTranslatePipe } from "../../shared/pipes/category-translate.pipe";

const routes: Routes = [{ path: "", component: ProductDetailComponent }];

@NgModule({
  declarations: [ProductDetailComponent],
  imports: [
    CommonModule, 
    RouterModule.forChild(routes),
    CategoryTranslatePipe
  ]
})
export class ProductDetailModule {}
