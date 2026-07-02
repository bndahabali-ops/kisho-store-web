// navbar.component.ts
import {
  Component,
  OnInit,
  OnDestroy,
  HostListener,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subject, filter, takeUntil } from 'rxjs';
import { CartService } from '../../../core/services/cart.service';


@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavbarComponent implements OnInit, OnDestroy {

  readonly cartCount = this.cartService.totalQuantity;

  isScrolled = false;
  isMobileOpen = false;
  activeRoute = '/';

  private readonly _destroy$ = new Subject<void>();

  readonly navLinks = [
    { label: 'Home', path: '/' },
    { label: 'Shop', path: '/shop' },
    { label: 'Cart', path: '/cart' },
  ];

  constructor(
    private readonly cartService: CartService,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef,
  ) { }

  ngOnInit(): void {
    this.router.events
      .pipe(
        filter(e => e instanceof NavigationEnd),
        takeUntil(this._destroy$),
      )
      .subscribe((e: any) => {
        this.activeRoute = e.urlAfterRedirects;
        this.isMobileOpen = false;
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  @HostListener('window:scroll')
  onScroll(): void {
    const scrolled = window.scrollY > 20;
    if (scrolled !== this.isScrolled) {
      this.isScrolled = scrolled;
      this.cdr.markForCheck();
    }
  }

  toggleMobile(): void {
    this.isMobileOpen = !this.isMobileOpen;
    this.cdr.markForCheck();
  }

  isActive(path: string): boolean {
    return path === '/'
      ? this.activeRoute === '/'
      : this.activeRoute.startsWith(path);
  }

  goToCheckout(): void {
    this.router.navigate(['/checkout']);
  }
}
