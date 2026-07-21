import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, ElementRef, ViewChild, HostListener } from "@angular/core";
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
  selectedImageIndex = 0;
  selectedSize: string | null = null;
  quantity = 1;
  addedToCartSuccess = false;
  sizeChartOpen = false;

  // Track accordion expansion states
  expandedAccordions: Record<string, boolean> = {
    description: true,
    specs: false,
    shipping: false
  };

  // Comprehensive color dictionary — covers common fashion/streetwear color names
  // with accurate hex values. colorHex from the backend always takes priority over this map.
  private readonly colorMap: Record<string, string> = {
    // ── Neutrals ──────────────────────────────────────────────
    black:          '#0D0D0D',
    white:          '#F5F5F5',
    offwhite:       '#F0EDE8',
    'off-white':    '#F0EDE8',
    cream:          '#F2EDD7',
    ivory:          '#FFFFF0',
    // ── Grays ─────────────────────────────────────────────────
    grey:           '#8A8A8A',
    gray:           '#8A8A8A',
    lightgrey:      '#C5C5C5',
    'light grey':   '#C5C5C5',
    darkgrey:       '#444444',
    charcoal:       '#36454F',
    slate:          '#708090',
    // ── Browns & Earth Tones ───────────────────────────────────
    brown:          '#795548',
    tan:            '#D2B48C',
    khaki:          '#BFB08A',
    camel:          '#C19A6B',
    sand:           '#C2B280',
    beige:          '#D9C8B5',
    taupe:          '#8D7E6A',
    mocha:          '#6F4E37',
    // ── Reds, Pinks & Wines ────────────────────────────────────
    red:            '#C0392B',
    burgundy:       '#6E1423',
    maroon:         '#7B1C2E',
    wine:           '#6B1D2F',
    crimson:        '#DC143C',
    rose:           '#C0546B',
    blush:          '#E8B4B8',
    coral:          '#E8735A',
    // ── Blues ─────────────────────────────────────────────────
    navy:           '#1A2340',
    blue:           '#2B5BA8',
    royalblue:      '#2646A0',
    'royal blue':   '#2646A0',
    cobalt:         '#0047AB',
    skyblue:        '#7BB8D4',
    'sky blue':     '#7BB8D4',
    teal:           '#24766E',
    // ── Greens ────────────────────────────────────────────────
    green:          '#2E7D32',
    olive:          '#4A5240',
    armygreen:      '#4B5320',
    'army green':   '#4B5320',
    forest:         '#1B4332',
    'forest green': '#1B4332',
    sage:           '#8A9E80',
    mint:           '#85C5B8',
    // ── Yellows & Oranges ─────────────────────────────────────
    yellow:         '#E8B84B',
    mustard:        '#B8873A',
    amber:          '#D4900A',
    orange:         '#D4570A',
    rust:           '#8B3A2C',
    // ── Purples ───────────────────────────────────────────────
    purple:         '#6A1E8A',
    lavender:       '#9A90C0',
    violet:         '#6832A8',
    // ── Misc ──────────────────────────────────────────────────
    pink:           '#D96882',
    gold:           '#B8922A',
    silver:         '#A8A9AD',
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
        this.selectedImageIndex = 0;
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
      '.pd-section',
      '.pd-accordions'
    ];

    gsap.fromTo(elementsToReveal,
      { opacity: 0, y: 25 },
      { opacity: 1, y: 0, duration: 0.9, stagger: 0.08, ease: 'power3.out', delay: 0.3 }
    );
  }

  toggleAccordion(section: string): void {
    if (this.expandedAccordions[section] !== undefined) {
      this.expandedAccordions[section] = !this.expandedAccordions[section];
      this.cdr.markForCheck();
    }
  }

  openSizeChart(): void {
    this.sizeChartOpen = true;
    this.cdr.markForCheck();
  }

  closeSizeChart(): void {
    this.sizeChartOpen = false;
    this.cdr.markForCheck();
  }

  @HostListener('document:keydown.escape')
  onEscKey(): void {
    if (this.sizeChartOpen) this.closeSizeChart();
  }

  get selectedVariant(): ProductVariant | null {
    if (!this.product?.variants?.length) return null;
    return this.product.variants[this.selectedVariantIndex];
  }

  /**
   * Returns a color-aware product title.
   * If the selected color name is NOT already embedded in the base title,
   * it is injected before the final word (the product-type noun).
   *
   * Example: "Oversized T-Shirt" + "Burgundy" → "Oversized Burgundy T-Shirt"
   * Example: "Olive Oversized Hoodie" + "Olive"  → "Olive Oversized Hoodie" (no double injection)
   */
  get displayTitle(): string {
    const title = this.product?.title ?? '';
    const color = this.selectedVariant?.color ?? '';
    if (!color || !title) return title;

    // Skip injection if the color word is already part of the title
    if (title.toLowerCase().includes(color.toLowerCase())) return title;

    const colorLabel = this._toTitleCase(color);
    const words = title.trim().split(/\s+/);

    // Single-word title → prepend color
    if (words.length <= 1) return `${colorLabel} ${title}`;

    // Multi-word title → insert color before the last word (the product noun)
    words.splice(words.length - 1, 0, colorLabel);
    return words.join(' ');
  }

  /** Converts a string to Title Case (handles multi-word colors like "royal blue") */
  private _toTitleCase(str: string): string {
    return str.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());
  }

  selectVariant(index: number): void {
    this.selectedVariantIndex = index;
    this.selectedImageIndex = 0;
    this.selectedSize = null; // reset selected size
    this.quantity = 1; // reset quantity
    this.cdr.markForCheck();
  }

  selectImage(index: number): void {
    this.selectedImageIndex = index;
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
