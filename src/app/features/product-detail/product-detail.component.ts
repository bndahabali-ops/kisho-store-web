import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, ElementRef, ViewChild } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { Product, ProductVariant } from "../../core/models/product.model";
import { ProductService } from "../../core/services/product.service";
import { CartService } from "../../core/services/cart.service";
import { gsap } from "gsap";

@Component({
  selector: "app-product-detail",
  templateUrl: "./product-detail.component.html",
  styleUrls: ["./product-detail.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductDetailComponent implements OnInit {
  @ViewChild('transitionWrap') transitionWrap!: ElementRef<HTMLDivElement>;
  @ViewChild('transitionPath') transitionPath!: ElementRef<SVGPathElement>;

  product: Product | null = null;
  loading = true;
  error = false;

  selectedVariantIndex = 0;
  selectedSize: string | null = null;
  quantity = 1;
  addedToCartSuccess = false;

  // Dictionary mapping common variant names to premium hexadecimal colors
  private readonly colorMap: Record<string, string> = {
    black: '#000000',
    white: '#FFFFFF',
    grey: '#7F7F7F',
    gray: '#7F7F7F',
    red: '#B12A2A',
    navy: '#1A2E40',
    olive: '#3D4A3E',
    beige: '#D9C8B5',
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private productService: ProductService,
    private cartService: CartService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get("id");
    if (!id) { this.router.navigate([""]); return; }
    this.productService.getProductById(id).subscribe({
      next: (p) => {
        this.product = p;
        this.loading = false;
        this.selectedVariantIndex = 0;
        this.selectedSize = null;
        this.quantity = 1;
        this.cdr.markForCheck();

        // Let the template render, then perform morph transition
        setTimeout(() => {
          this._runRevealTransition();
        }, 50);
      },
      error: () => {
        this.error = true;
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  private _runRevealTransition(): void {
    if (!this.transitionPath || !this.transitionWrap) return;

    const path = this.transitionPath.nativeElement;
    const wrap = this.transitionWrap.nativeElement;

    const start = "M 0 0 V 50 Q 50 0 100 50 V 0 z";
    const end = "M 0 0 V 0 Q 50 0 100 0 V 0 z";

    const tl = gsap.timeline({
      onComplete: () => {
        // Clean up wrapper to not block any pointer actions
        gsap.set(wrap, { display: 'none' });
      }
    });

    // Morph the SVG path up and away
    tl.to(path, {
      attr: { d: start },
      duration: 0.7,
      ease: "power2.in"
    })
      .to(path, {
        attr: { d: end },
        duration: 0.5,
        ease: "power2.out"
      });

    // Stagger reveal page elements for cinematic entrance
    const elementsToReveal = [
      '.pd-image-col',
      '.pd-breadcrumb',
      '.pd-title',
      '.pd-price-row',
      '.pd-desc',
      '.pd-section',
      '.pd-specs'
    ];

    gsap.fromTo(elementsToReveal,
      { opacity: 0, y: 25 },
      { opacity: 1, y: 0, duration: 0.9, stagger: 0.08, ease: 'power3.out', delay: 0.3 }
    );
  }

  get selectedVariant(): ProductVariant | null {
    if (!this.product?.variants?.length) return null;
    return this.product.variants[this.selectedVariantIndex];
  }

  selectVariant(index: number): void {
    this.selectedVariantIndex = index;
    this.selectedSize = null; // reset selected size
    this.quantity = 1; // reset quantity
    this.cdr.markForCheck();
  }

  selectSize(size: string): void {
    this.selectedSize = size;
    this.quantity = 1; // reset quantity
    this.cdr.markForCheck();
  }

  getColorHex(colorName: string): string {
    const nameLower = colorName.toLowerCase().trim();
    if (this.colorMap[nameLower]) {
      return this.colorMap[nameLower];
    }
    for (const key of Object.keys(this.colorMap)) {
      if (nameLower.includes(key)) {
        return this.colorMap[key];
      }
    }
    return '#444444'; // fallback dark gray
  }

  getMaxStock(): number {
    const variant = this.selectedVariant;
    if (!variant || !this.selectedSize) return 0;
    const sizeInfo = variant.sizes.find(s => s.size === this.selectedSize);
    return sizeInfo ? sizeInfo.stock : 0;
  }

  incrementQuantity(): void {
    const max = this.getMaxStock();
    if (this.quantity < max) {
      this.quantity++;
      this.cdr.markForCheck();
    }
  }

  decrementQuantity(): void {
    if (this.quantity > 1) {
      this.quantity--;
      this.cdr.markForCheck();
    }
  }

  addToCart(): void {
    const variant = this.selectedVariant;
    if (!this.product || !variant || !this.selectedSize) return;

    const maxStock = this.getMaxStock();
    if (maxStock <= 0) return;

    this.cartService.addItem({
      productId: this.product._id,
      title: this.product.title,
      basePrice: this.product.basePrice,
      discountPrice: this.product.discountPrice,
      color: variant.color,
      colorHex: variant.colorHex || this.getColorHex(variant.color),
      size: this.selectedSize,
      quantity: this.quantity,
      image: variant.images?.[0] ?? '',
      maxStock: maxStock
    });

    this.addedToCartSuccess = true;
    this.cdr.markForCheck();

    // Auto-reset success message after 2 seconds
    setTimeout(() => {
      this.addedToCartSuccess = false;
      this.cdr.markForCheck();
    }, 2000);
  }
}
