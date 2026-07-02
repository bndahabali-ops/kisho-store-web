import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Routes } from "@angular/router";
import { ShopComponent } from "./shop.component";
import { HttpClientModule } from "@angular/common/http";
import { CategoryTranslatePipe } from "../../shared/pipes/category-translate.pipe";

const routes: Routes = [{ path: "", component: ShopComponent }];

@NgModule({
  declarations: [ShopComponent],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    HttpClientModule,
    CategoryTranslatePipe
  ]
})
export class ShopModule { }
