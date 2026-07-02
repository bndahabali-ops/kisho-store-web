// order-success.component.ts
import {
  Component,
  AfterViewInit,
  OnInit,
  ElementRef,
  ViewChild,
  ChangeDetectionStrategy,
} from '@angular/core';
import { Router } from '@angular/router';
import { gsap } from 'gsap';
import { OrderService } from '../../core/services/order.service';

@Component({
  selector: 'app-order-success',
  templateUrl: './order-success.component.html',
  styleUrls: ['./order-success.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderSuccessComponent implements OnInit, AfterViewInit {

  @ViewChild('card')     card!:     ElementRef<HTMLElement>;
  @ViewChild('checkIcon') checkIcon!: ElementRef<SVGElement>;

  readonly confirmation = this.orderService.lastOrderConfirmation;

  constructor(
    private readonly orderService: OrderService,
    private readonly router: Router,
  ) { }

  ngOnInit(): void {
    // Guard: if no confirmation (user navigated here directly), redirect
    if (!this.orderService.lastOrderConfirmation()) {
      this.router.navigate(['/']);
    }
  }

  ngAfterViewInit(): void {
    this._playEntrance();
  }

  goHome(): void {
    this.orderService.clearConfirmation();
    this.router.navigate(['/']);
  }

  goShop(): void {
    this.orderService.clearConfirmation();
    this.router.navigate(['/shop']);
  }

  private _playEntrance(): void {
    const q = gsap.utils.selector(this.card.nativeElement);
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    // Set initial states to avoid any sudden flashes during load
    gsap.set(q('.success-card__title, .success-card__sub, .order-ref, .order-details, .order-detail-row, .success-actions button'), { opacity: 0 });

    tl
      // 1. Card slides up & fades in
      .fromTo(this.card.nativeElement,
        { opacity: 0, scale: 0.95, y: 30 },
        { opacity: 1, scale: 1, y: 0, duration: 0.8 }
      )
      // 2. Check icon spins & scales in
      .fromTo(this.checkIcon.nativeElement,
        { scale: 0, rotation: -180, opacity: 0 },
        { scale: 1, rotation: 0, opacity: 1, duration: 0.7, ease: 'back.out(1.7)' },
        '-=0.4'
      )
      // 3. Stagger title and subtitle
      .fromTo(q('.success-card__title, .success-card__sub'),
        { y: 15, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, stagger: 0.15, ease: 'power2.out' },
        '-=0.4'
      )
      // 4. Order reference box scales in
      .fromTo(q('.order-ref'),
        { scale: 0.95, opacity: 0, y: 10 },
        { scale: 1, opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' },
        '-=0.3'
      )
      // 5. Order details block fades in
      .fromTo(q('.order-details'),
        { opacity: 0 },
        { opacity: 1, duration: 0.3 },
        '-=0.2'
      )
      // 6. Stagger order detail rows fading and sliding in from the left
      .fromTo(q('.order-detail-row'),
        { x: -15, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.4, stagger: 0.1, ease: 'power2.out' },
        '-=0.2'
      )
      // 7. Stagger CTA buttons popping in
      .fromTo(q('.success-actions button'),
        { y: 15, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, stagger: 0.12, ease: 'back.out(1.2)' },
        '-=0.2'
      );
  }
}
