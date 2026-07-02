import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

@Injectable({
  providedIn: 'root'
})
export class ScrollService implements OnDestroy {
  private lenis?: Lenis;
  private tickerCb?: (time: number) => void;

  constructor(private readonly ngZone: NgZone) {
    this.init();
  }

  /**
   * Initializes Lenis smooth scroll and binds it to GSAP ScrollTrigger updates.
   * Runs entirely outside Angular Zone to prevent change detection cycle bloat.
   */
  public init(): void {
    return;
    if (this.lenis) return; // Prevent double initialization

    this.ngZone.runOutsideAngular(() => {
      // 1. Initialize Lenis with custom smooth scrolling params
      this.lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        gestureOrientation: 'vertical',
        smoothWheel: true,
        wheelMultiplier: 1.0,
      });

      // 2. Synchronize ScrollTrigger with Lenis — pass handler directly (no wrapper closure)
      this.lenis.on('scroll', ScrollTrigger.update);

      // 3. Connect Lenis RAF into GSAP's ticker so both run in the same frame
      this.tickerCb = (time: number) => {
        this.lenis?.raf(time * 1000);
      };
      gsap.ticker.add(this.tickerCb);

      // 4. CRITICAL: disable GSAP lag-smoothing so the ticker never dumps a
      //    giant catch-up delta when the tab is re-focused — this is the #1
      //    cause of scroll jumps and double-frame glitches with Lenis.
      gsap.ticker.lagSmoothing(0);
    });
  }

  /**
   * Access the raw Lenis instance
   */
  public getLenis(): Lenis | undefined {
    return this.lenis;
  }

  /**
   * Stop the scroll interaction (useful during overlays or modals)
   */
  public stop(): void {
    this.lenis?.stop();
  }

  /**
   * Resume the scroll interaction
   */
  public start(): void {
    this.lenis?.start();
  }

  /**
   * Scroll smoothly to a target element or offset
   */
  public scrollTo(target: string | HTMLElement, options?: any): void {
    this.lenis?.scrollTo(target, options);
  }

  /**
   * Cleans up Lenis instance and removes GSAP ticker listener.
   */
  public destroy(): void {
    this.ngZone.runOutsideAngular(() => {
      if (this.tickerCb) {
        gsap.ticker.remove(this.tickerCb);
        this.tickerCb = undefined;
      }
      if (this.lenis) {
        this.lenis.destroy();
        this.lenis = undefined;
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy();
  }
}
