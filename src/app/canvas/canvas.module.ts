import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ThreeCanvasComponent } from "./three-canvas.component";

@NgModule({
  declarations: [ThreeCanvasComponent],
  imports: [CommonModule],
  exports: [ThreeCanvasComponent]
})
export class CanvasModule {}
