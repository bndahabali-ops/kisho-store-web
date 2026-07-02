import {
  Component, OnInit, OnDestroy,
  ChangeDetectionStrategy, ChangeDetectorRef
} from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from "rxjs";
import { Product, ProductVariant } from "../../core/models/product.model";
import { Pagination } from "../../core/models/api-response.model";
import { ProductService } from "../../core/services/product.service";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

@Component({
  selector: "app-shop",
  templateUrl: "./shop.component.html",
  styleUrls: ["./shop.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShopComponent implements OnInit, OnDestroy {

  /** Always initialized to [] — the template never receives null/undefined */
  products: Product[] = [];
  pagination: Pagination = { total: 0, page: 1, limit: 12, totalPages: 1 };
  loading = true;
  error = false;

  searchQuery = "";
  selectedCategory = "";
  currentPage = 1;

  categories = ["", "tshirts", "hoodies", "polo", "accessories"];
  categoryLabels: Record<string, string> = {
    "": "All Collection", tshirts: "T-Shirts", hoodies: "Hoodies",
    polo: "Polo Shirts", accessories: "Accessories"
  };

  private _search$ = new Subject<string>();
  private _destroy$ = new Subject<void>();
  private _gridTriggers: any[] = [];

  constructor(
    private productService: ProductService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.loadDbCategories();

    this.route.queryParams.pipe(takeUntil(this._destroy$)).subscribe(p => {
      this.selectedCategory = p["category"] ?? "";
      this.searchQuery = p["search"] ?? "";
      this.currentPage = +(p["page"] ?? 1);
      this._fetch();
    });

    this._search$.pipe(
      debounceTime(350),
      distinctUntilChanged(),
      takeUntil(this._destroy$)
    ).subscribe(q => {
      this.searchQuery = q;
      this._updateRoute(1);
    });
  }

  loadDbCategories(): void {
    this.productService.getCategories().pipe(takeUntil(this._destroy$)).subscribe({
      next: (res) => {
        if (res?.data?.categories && res.data.categories.length > 0) {
          const list = [""];
          const labels: Record<string, string> = { "": "All Collection" };
          res.data.categories.forEach(c => {
            const slug = c.slug || c.name.toLowerCase().replace(/\s+/g, '-');
            list.push(slug);
            labels[slug] = c.name;
          });
          this.categories = list;
          this.categoryLabels = labels;
          this.cdr.markForCheck();
        }
      },
      error: (err) => {
        console.error('Failed to load categories', err);
      }
    });
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
    this._clearGridTriggers();
  }

  onSearch(val: string): void { this._search$.next(val); }

  onCategory(cat: string): void {
    this.selectedCategory = cat;
    this._updateRoute(1);
  }

  onPage(p: number): void { this._updateRoute(p); }

  navigateToProduct(id: string): void { this.router.navigate(["/product", id]); }

  getPages(): number[] {
    return Array.from({ length: this.pagination.totalPages }, (_, i) => i + 1);
  }

  trackById(_: number, p: Product): string { return p._id; }

  getProductImage(product: Product): string {
    return product?.variants?.[0]?.images?.[0] ?? "";
  }

  getProductSecondImage(product: Product): string {
    return product?.variants?.[0]?.images?.[1] ?? "";
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  private _clearGridTriggers(): void {
    this._gridTriggers.forEach(t => t.kill());
    this._gridTriggers = [];
  }

  private _animateProductGrid(): void {
    this._clearGridTriggers();

    const cards = document.querySelectorAll('.shop-card');
    if (!cards.length) return;

    // Set initial reveal state
    gsap.set(cards, { opacity: 0, y: 30 });

    const trigger = ScrollTrigger.create({
      trigger: '.shop-grid',
      start: 'top 85%',
      once: true,
      onEnter: () => {
        gsap.to(cards, {
          opacity: 1,
          y: 0,
          duration: 0.8,
          stagger: 0.04,
          ease: 'power3.out',
          overwrite: 'auto'
        });
      }
    });

    this._gridTriggers.push(trigger);
  }

  private _fetch(): void {
    this.loading = true;
    this.error = false;
    this.cdr.markForCheck();

    this.productService.getProducts({
      category: this.selectedCategory || undefined,
      search: this.searchQuery || undefined,
      page: this.currentPage,
      limit: 12
    }).pipe(takeUntil(this._destroy$)).subscribe({
      next: (res) => {
        this.products = this._normalizeProducts(res?.data ?? []);
        this.pagination = res?.pagination ?? { total: 0, page: 1, limit: 12, totalPages: 1 };
        this.loading = false;
        this.cdr.markForCheck();

        // Let Angular render the product grid, then animate
        setTimeout(() => {
          this._animateProductGrid();
        }, 50);
      },
      error: () => {
        this.products = [];
        this.error = true;
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  private _normalizeProducts(raw: any[]): Product[] {
    if (!Array.isArray(raw)) return [];

    return raw.map((p: any): Product => ({
      _id: p?._id ?? "",
      title: p?.title ?? "Untitled",
      description: p?.description ?? "",
      basePrice: p?.basePrice ?? 0,
      discountPrice: p?.discountPrice ?? 0,
      category: p?.category ?? "",
      createdAt: p?.createdAt ?? "",
      updatedAt: p?.updatedAt ?? "",
      variants: Array.isArray(p?.variants)
        ? p.variants.map((v: any): ProductVariant => ({
          color: v?.color ?? "",
          colorHex: v?.colorHex ?? "",
          images: Array.isArray(v?.images)
            ? v.images.filter((img: any) => typeof img === "string" && img.length > 0)
            : [],
          sizes: Array.isArray(v?.sizes) ? v.sizes : [],
        }))
        : [],
    }));
  }

  private _updateRoute(page: number): void {
    this.router.navigate([], {
      queryParams: {
        category: this.selectedCategory || null,
        search: this.searchQuery || null,
        page: page > 1 ? page : null
      },
      queryParamsHandling: "merge"
    });
  }
}
