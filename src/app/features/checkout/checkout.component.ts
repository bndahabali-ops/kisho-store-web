import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ElementRef,
  ViewChild,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  signal,
  computed,
} from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { gsap } from 'gsap';

import { CartService } from '../../core/services/cart.service';
import { OrderService, OrderError } from '../../core/services/order.service';
import { CartItem } from '../../core/models/product.model';
import { CreateOrderPayload } from '../../core/models/order.model';
import {
  egyptianPhoneValidator,
  maxLengthTrimmed,
  nameValidator,
  getFieldError,
  SHIPPING_ZONES,
  ShippingZone,
} from './checkout.validators';

@Component({
  selector: 'app-checkout',
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckoutComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('formCard') formCard!: ElementRef<HTMLElement>;

  // ── Public ─────────────────────────────────────────────────────────────────
  readonly shippingZones = SHIPPING_ZONES;
  checkoutForm!: FormGroup;
  globalError: string | null = null;
  conflictingProductIds = new Set<string>();

  // Live shipping state signals
  readonly selectedZoneFee = signal<number>(0);
  readonly selectedZoneDelivery = signal<string>('');

  // Expose signals to template
  readonly cartItems  = this.cartService.items;
  readonly cartTotal  = this.cartService.totalPrice;
  readonly isSubmitting = this.orderService.submitting;

  readonly grandTotal = computed(() => {
    return this.cartTotal() + this.selectedZoneFee();
  });

  // Expose error helper to template
  readonly getError = getFieldError;

  private readonly _destroy$ = new Subject<void>();

  constructor(
    private readonly fb: FormBuilder,
    private readonly cartService: CartService,
    private readonly orderService: OrderService,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    if (this.cartService.isEmpty()) {
      this.router.navigate(['/shop']);
      return;
    }
    this._buildForm();
  }

  ngAfterViewInit(): void {
    if (this.formCard) {
      gsap.fromTo(this.formCard.nativeElement,
        { opacity: 0, y: 40 },
        { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' }
      );
    }
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  // ── Template helpers ────────────────────────────────────────────────────────

  ctrl(path: string): AbstractControl | null {
    return this.checkoutForm.get(path);
  }

  isConflicting(item: CartItem): boolean {
    return this.conflictingProductIds.has(item.productId);
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  onSubmit(): void {
    this.checkoutForm.markAllAsTouched();
    if (this.checkoutForm.invalid) return;

    this.globalError = null;
    this.conflictingProductIds.clear();

    const payload = this._buildPayload();

    this.orderService
      .placeOrder(payload)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          this.cartService.clearCart();
          this.router.navigate(['/order-success']);
        },
        error: (err: OrderError) => {
          this._handleError(err);
        },
      });
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private _buildForm(): void {
    this.checkoutForm = this.fb.group({
      shippingAddress: this.fb.group({
        fullName: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(80), nameValidator()]],
        phone:    ['', [Validators.required, egyptianPhoneValidator()]],
        email:    ['', [Validators.required, Validators.email, Validators.maxLength(120)]],
        city:     ['', [Validators.required]],
        address:  ['', [Validators.required, Validators.minLength(10), Validators.maxLength(200)]],
        notes:    ['', [maxLengthTrimmed(500)]],
      }),
      paymentMethod: ['cash_on_delivery'],
    });

    // Listen to city changes to update shipping fee live
    this.checkoutForm.get('shippingAddress.city')?.valueChanges
      .pipe(takeUntil(this._destroy$))
      .subscribe(cityValue => {
        const zone = this.shippingZones.find(z => z.value === cityValue);
        if (zone) {
          this.selectedZoneFee.set(zone.fee);
          this.selectedZoneDelivery.set(zone.deliveryTime);
        } else {
          this.selectedZoneFee.set(0);
          this.selectedZoneDelivery.set('');
        }
      });
  }

  private _buildPayload(): CreateOrderPayload {
    const v = this.checkoutForm.getRawValue();
    const zone = this.shippingZones.find(z => z.value === v.shippingAddress.city);
    return {
      items: this.cartService.buildOrderItems(),
      shippingAddress: {
        fullName: v.shippingAddress.fullName.trim(),
        phone:    v.shippingAddress.phone.trim(),
        email:    v.shippingAddress.email.trim().toLowerCase(),
        city:     v.shippingAddress.city,
        governorate: zone ? zone.value : undefined,
        region:   zone ? zone.name : undefined,
        address:  v.shippingAddress.address.trim(),
        notes:    v.shippingAddress.notes?.trim() || undefined,
      },
      paymentMethod: v.paymentMethod,
    };
  }

  private _handleError(err: OrderError): void {
    if (err.type === 'conflict') {
      const items = this.cartService.items();
      (err.conflictingItems ?? []).forEach(ref => {
        const match = items.find(i => i.productId === ref || i.title.includes(ref));
        if (match) this.conflictingProductIds.add(match.productId);
      });
    }

    this.globalError =
      err.type === 'network'
        ? 'Please check your internet connection and try again.'
        : err.message || 'Something went wrong. Please try again.';

    this.cdr.markForCheck();

    setTimeout(() => {
      document.getElementById('checkout-error-banner')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  }
}
