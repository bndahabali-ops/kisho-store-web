import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Observer } from 'gsap/Observer';
import { ThreeCanvasService } from '../../canvas/three-canvas.service';
import { HeroScene } from '../../canvas/scenes/hero.scene';
import { ProductService } from '../../core/services/product.service';
import { Product } from '../../core/models/product.model';
import { PaginatedResponse } from '../../core/models/api-response.model';

gsap.registerPlugin(ScrollTrigger, Observer);

type ListenerTarget = HTMLElement | Window | Document;

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ThreeCanvasService],
})
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('canvasHost') canvasHost!: ElementRef<HTMLDivElement>;
  @ViewChild('heroHeadline') heroHeadline!: ElementRef<HTMLElement>;
  @ViewChild('heroBadge') heroBadge!: ElementRef<HTMLElement>;
  @ViewChild('heroSub') heroSub!: ElementRef<HTMLElement>;
  @ViewChild('heroCta') heroCta!: ElementRef<HTMLElement>;
  @ViewChild('scrollIndicator') scrollIndicator!: ElementRef<HTMLElement>;
  @ViewChild('heroVideo') heroVideo!: ElementRef<HTMLElement>;
  @ViewChild('heroLine1') heroLine1!: ElementRef<HTMLElement>;
  @ViewChild('heroLine2') heroLine2!: ElementRef<HTMLElement>;
  @ViewChild('heroLine3') heroLine3!: ElementRef<HTMLElement>;
  @ViewChild('marqueeLeft') marqueeLeft!: ElementRef<HTMLElement>;
  @ViewChild('marqueeRight') marqueeRight!: ElementRef<HTMLElement>;
  @ViewChild('galleryWrap') galleryWrap!: ElementRef<HTMLElement>;
  @ViewChild('bentoGallery') bentoGallery!: ElementRef<HTMLElement>;
  @ViewChild('sculptDock') sculptDock!: ElementRef<HTMLElement>;
  @ViewChild('glitchTitle') glitchTitle!: ElementRef<HTMLElement>;
  @ViewChild('feTurbulence') feTurbulenceRef!: ElementRef<SVGFETurbulenceElement>;
  @ViewChild('feDisplacementMap') feDisplacementMapRef!: ElementRef<SVGFEDisplacementMapElement>;
  @ViewChild('nacTrack') nacTrack!: ElementRef<HTMLElement>;
  @ViewChild('newArrivalsSec') newArrivalsSec!: ElementRef<HTMLElement>;
  @ViewChild('nacSpotlight') nacSpotlight!: ElementRef<HTMLElement>;

  categories: Array<{ label: string; slug: string }> = [
    { label: 'T-Shirts', slug: 'tshirts' },
    { label: 'Hoodies', slug: 'hoodies' },
    { label: 'Polo Shirts', slug: 'polo' },
    { label: 'Accessories', slug: 'accessories' },
  ];

  newArrivals: Product[] = [];
  isLoadingNewArrivals = true;
  nacActiveIndex = 0;

  private readonly heroScene = new HeroScene();
  private readonly _scrollTriggers: ScrollTrigger[] = [];
  private readonly _timelines: any[] = [];
  private readonly _cleanups: Array<() => void> = [];

  // Sand Canvas Properties
  private _sandCanvas: HTMLCanvasElement | null = null;
  private _sandCtx: CanvasRenderingContext2D | null = null;
  private _sandW = 0;
  private _sandH = 0;
  private _sandDpr = 1;
  private _sandCols = 0;
  private _sandRows = 0;
  private _fixedCodepen: Uint8Array | null = null;
  private _sandCodepenCells: number[] = [];
  private _sandLooseCells: number[] = [];
  private _sandFalling: any[] = [];
  private _sandPile: Uint8Array | null = null;
  private _sandReforming: any[] = [];
  private _sandHiddenAlpha = 0;
  private _sandPhase = 'codepen';
  private _sandPhaseTime = 0;
  private _sandLastTime = 0;
  private _sandAnimationFrameId = 0;

  private readonly _sandSettings = {
    cellSize: 3,
    startText: "KISHO",
    hiddenText: "ESSENTIAL STREETWEAR // VOL. I // OUT NOW",
    releaseTestsPerFrame: 1500,
    releaseChance: 0.022,
    gravity: 850,
    airDrag: 0.992,
    settleStepsPerFrame: 5,
    pileHoldSeconds: 0.8,
    hiddenFadeInSeconds: 0.45,
    reformDurationSeconds: 2,
    reformStaggerSeconds: 0.65,
    revealHoldSeconds: 3,
    revealFadeSeconds: .6,
    reformArrivalDistance: 1.5
  };

  private _animationContext?: gsap.Context;
  private _glitchContext?: gsap.Context;
  private _productSub?: Subscription;
  private _newArrivalsTimer?: ReturnType<typeof setTimeout>;
  private _dockTarget = { x: 0, y: 0 };
  private _calculateDockTarget: () => void = () => undefined;
  private _isInitialized = false;
  private _isDestroyed = false;
  private _prefersReducedMotion = false;

  currentIndex = 0;
  isTransitioning = false;
  slides: HTMLElement[] = [];
  outerWrappers: HTMLElement[] = [];
  innerWrappers: HTMLElement[] = [];
  contentWrappers: HTMLElement[] = [];
  observerInstance?: any;

  constructor(
    private readonly canvasService: ThreeCanvasService,
    private readonly router: Router,
    private readonly ngZone: NgZone,
    private readonly productService: ProductService,
    private readonly cdr: ChangeDetectorRef,
  ) { }

  ngOnInit(): void {
    this.loadNewArrivals();
    this.loadDbCategories();
  }

  loadDbCategories(): void {
    this.productService.getCategories().subscribe({
      next: (res) => {
        if (res?.data?.categories && res.data.categories.length > 0) {
          this.categories = res.data.categories.map(c => ({
            label: c.name,
            slug: c.slug || c.name.toLowerCase().replace(/\s+/g, '-'),
          }));
          this.cdr.markForCheck();
        }
      },
      error: (err) => {
        console.error('Failed to load categories', err);
      }
    });
  }

  ngAfterViewInit(): void {
    this.ngZone.runOutsideAngular(() => {
      if (this._isInitialized) return;

      this._isInitialized = true;
      this._prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';

      this._initCanvas();
      this._initSandCanvas();

      this._animationContext = gsap.context(() => {
        this._preparePageForMotion();

        const host = this._animationRoot();
        this.slides = Array.from(host.querySelectorAll('.home-slide')) as HTMLElement[];
        this.outerWrappers = Array.from(host.querySelectorAll('.slide-outer')) as HTMLElement[];
        this.innerWrappers = Array.from(host.querySelectorAll('.slide-inner')) as HTMLElement[];
        this.contentWrappers = Array.from(host.querySelectorAll('.slide-content')) as HTMLElement[];

        // Initial setup for reveal slide transitions
        gsap.set(this.outerWrappers, { yPercent: 100 });
        gsap.set(this.innerWrappers, { yPercent: -100 });

        if (this.slides.length > 0) {
          this.slides[0].classList.add('is-active');
          gsap.set(this.slides[0], { zIndex: 20 });
          gsap.set(this.outerWrappers[0], { yPercent: 0 });
          gsap.set(this.innerWrappers[0], { yPercent: 0 });
        }

        if (this._prefersReducedMotion) {
          this._applyReducedMotionState();
          return;
        }

        this._animateHeroEntrance();
        this._setupMarqueeScrub();
        this._setupMagneticButtons();
        this._setupBentoHoverInteractions();
        this._setupSpotlightTracking();

        const mm = gsap.matchMedia();
        mm.add('(max-width: 1023px)', () => {
          this._setupMobileGalleryAnimations();
        });

        // Create the Observer instance to intercept wheel/touch events on screen
        this.observerInstance = Observer.create({
          type: 'wheel,touch,pointer',
          wheelSpeed: -1,
          onDown: () => this._handleScrollAction(-1),
          onUp: () => this._handleScrollAction(1),
          tolerance: 10,
          preventDefault: false
        });

        // Glitch effect has its own isolated context so it can be reverted independently
        this._initGlitchEffect();
      }, this._animationRoot());
    });
  }

  ngOnDestroy(): void {
    this._isDestroyed = true;

    this.ngZone.runOutsideAngular(() => {
      if (this._newArrivalsTimer) {
        clearTimeout(this._newArrivalsTimer);
      }

      this._productSub?.unsubscribe();
      ScrollTrigger.removeEventListener('refresh', this._calculateDockTarget);

      if (this.observerInstance) {
        this.observerInstance.kill();
      }

      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';

      window.removeEventListener('resize', this._onSandResize);
      if (this._sandAnimationFrameId) {
        cancelAnimationFrame(this._sandAnimationFrameId);
      }

      this._glitchContext?.revert();
      this._glitchContext = undefined;

      this._cleanups.splice(0).forEach((cleanup) => cleanup());
      this._scrollTriggers.splice(0).forEach((trigger) => trigger.kill(true));
      this._timelines.splice(0).forEach((timeline) => timeline.kill());
      this._animationContext?.revert();
      this._animationContext = undefined;

      this.heroScene.dispose();
      this.canvasService.dispose();
      this._isInitialized = false;
    });
  }

  loadNewArrivals(): void {
    this._productSub = this.productService.getProducts({ isNewArrival: true, limit: 4 }).subscribe({
      next: (response: PaginatedResponse<Product>) => {
        const flagged = response.data || [];

        if (flagged.length > 0) {
          // Use products explicitly flagged as new arrivals
          this.newArrivals = flagged;
          this.isLoadingNewArrivals = false;
          this.cdr.markForCheck();
          this._scheduleNewArrivalsAnimation();
        } else {
          // Fallback: fetch 4 latest products so the slide is never empty
          this.productService.getProducts({ limit: 4 }).subscribe({
            next: (fallback: PaginatedResponse<Product>) => {
              this.newArrivals = fallback.data || [];
              this.isLoadingNewArrivals = false;
              this.cdr.markForCheck();
              this._scheduleNewArrivalsAnimation();
            },
            error: () => {
              this.isLoadingNewArrivals = false;
              this.cdr.markForCheck();
            },
          });
        }
      },
      error: () => {
        this.isLoadingNewArrivals = false;
        this.cdr.markForCheck();
      },
    });
  }

  private _scheduleNewArrivalsAnimation(): void {
    this._newArrivalsTimer = setTimeout(() => {
      if (!this._isDestroyed) {
        this._initNewArrivalsAnimations();
      }
    }, 100);
  }

  getProductImage(product: Product): string {
    return product.variants?.[0]?.images?.[0] || '';
  }

  navigateToProduct(id: string): void {
    this.ngZone.run(() => {
      this.router.navigate(['/product', id]);
    });
  }

  navigateToShop(category?: string): void {
    this.ngZone.run(() => {
      this.router.navigate(['/shop'], category ? { queryParams: { category } } : {});
    });
  }

  scrollToNext(): void {
    this.gotoSection(1, 1);
  }

  gotoSection(index: number, direction: number): void {
    const totalSlides = this.slides.length;
    if (!totalSlides) return;

    // Wrap around index
    const nextIndex = (index + totalSlides) % totalSlides;
    this.isTransitioning = true;

    const currentSlide = this.slides[this.currentIndex];
    const nextSlide = this.slides[nextIndex];

    const currentContent = this.contentWrappers[this.currentIndex];
    const nextContent = this.contentWrappers[nextIndex];

    const currentOuter = this.outerWrappers[this.currentIndex];
    const nextOuter = this.outerWrappers[nextIndex];
    const currentInner = this.innerWrappers[this.currentIndex];
    const nextInner = this.innerWrappers[nextIndex];

    const dFactor = direction; // 1 for down, -1 for up

    const tl = gsap.timeline({
      defaults: { duration: 1.25, ease: 'power2.inOut' },
      onComplete: () => {
        if (currentSlide && currentSlide !== nextSlide) {
          currentSlide.classList.remove('is-active');
        }
        this.isTransitioning = false;
      }
    });

    nextSlide.classList.add('is-active');
    gsap.set(nextSlide, { zIndex: 20 });
    if (currentSlide && currentSlide !== nextSlide) {
      gsap.set(currentSlide, { zIndex: 10 });
    }

    tl.fromTo([nextOuter, nextInner],
      {
        yPercent: (i) => i ? -100 * dFactor : 100 * dFactor
      },
      {
        yPercent: 0
      },
      0
    )
      .fromTo(nextContent, { yPercent: 15 * dFactor }, { yPercent: 0 }, 0);

    if (this.currentIndex >= 0 && this.currentIndex !== nextIndex && currentSlide) {
      tl.to(currentContent, { yPercent: -15 * dFactor }, 0)
        .to(currentOuter, { yPercent: -100 * dFactor }, 0)
        .to(currentInner, { yPercent: 100 * dFactor }, 0);
    }

    this._updateThreeModelPositionForSlide(nextIndex);
    this._animateSlideElementsIn(nextIndex);

    this.currentIndex = nextIndex;
  }

  private _handleScrollAction(direction: number): void {
    if (this.isTransitioning) return;

    const currentSlide = this.slides[this.currentIndex];
    if (!currentSlide) return;

    const content = this.contentWrappers[this.currentIndex];
    if (content) {
      const isScrollable = content.scrollHeight > content.clientHeight;
      if (isScrollable) {
        const scrollTop = content.scrollTop;
        const maxScroll = content.scrollHeight - content.clientHeight;

        if (direction === 1) {
          if (scrollTop < maxScroll - 8) {
            return;
          }
        } else if (direction === -1) {
          if (scrollTop > 8) {
            return;
          }
        }
      }
    }

    this.gotoSection(this.currentIndex + direction, direction);
  }

  private _updateThreeModelPositionForSlide(index: number): void {
    const camera = this.canvasService.camera;
    if (!camera) return;

    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    const heroZ = isMobile ? 5.5 : 4.5;
    const zoomedOutZ = heroZ + 1.2;

    this._calculateDockTarget();

    const duration = 1.35;
    const ease = 'power2.inOut';

    if (index === 0) {
      gsap.to(this.heroScene, { scrollBaseX: 0, scrollBaseY: 0, scrollScale: 1, duration, ease });
      gsap.to(camera.position, { z: heroZ, duration, ease, onUpdate: () => camera.updateProjectionMatrix() });
    } else if (index === 1) {
      gsap.to(this.heroScene, {
        scrollBaseX: this._dockTarget.x * (isMobile ? 0 : 1),
        scrollBaseY: this._dockTarget.y,
        scrollScale: 0.65,
        duration,
        ease
      });
      gsap.to(camera.position, { z: zoomedOutZ, duration, ease, onUpdate: () => camera.updateProjectionMatrix() });
    } else if (index === 2) {
      gsap.to(this.heroScene, {
        scrollBaseX: 0,
        scrollBaseY: 0,
        scrollScale: 0.55,
        duration,
        ease
      });
      gsap.to(camera.position, { z: zoomedOutZ + 0.8, duration, ease, onUpdate: () => camera.updateProjectionMatrix() });
    } else {
      gsap.to(this.heroScene, {
        scrollScale: 0,
        duration: 1.0,
        ease: 'power2.out'
      });
    }
  }

  private _animateSlideElementsIn(index: number): void {
    const slide = this.slides[index];
    if (!slide) return;

    if (index === 0) {
      this._animateHeroEntrance();
      return;
    }

    if (index === 1) {
      const labelBits = slide.querySelectorAll<HTMLElement>('.index-num, .section-tag');
      const copyBlocks = slide.querySelectorAll<HTMLElement>('.animate-txt');
      gsap.timeline({ defaults: { ease: 'power4.out', duration: 0.9 } })
        .fromTo(labelBits, { autoAlpha: 0, x: -22 }, { autoAlpha: 1, x: 0, stagger: 0.08 })
        .fromTo(copyBlocks, { autoAlpha: 0, y: 42, clipPath: 'inset(0 0 100% 0)' }, { autoAlpha: 1, y: 0, clipPath: 'inset(0% 0% 0% 0%)', stagger: 0.12 }, 0.08);
    }

    if (index === 2) {
      const labelBits = slide.querySelectorAll<HTMLElement>('.index-num, .section-tag');
      const copyBlocks = slide.querySelectorAll<HTMLElement>('.animate-txt');
      const specs = slide.querySelectorAll<HTMLElement>('.spec-item');
      gsap.timeline({ defaults: { ease: 'power4.out', duration: 0.9 } })
        .fromTo(labelBits, { autoAlpha: 0, x: -22 }, { autoAlpha: 1, x: 0, stagger: 0.08 })
        .fromTo(copyBlocks, { autoAlpha: 0, y: 42, clipPath: 'inset(0 0 100% 0)' }, { autoAlpha: 1, y: 0, clipPath: 'inset(0% 0% 0% 0%)', stagger: 0.12 }, 0.08)
        .fromTo(specs, { autoAlpha: 0, y: 24, scale: 0.96 }, { autoAlpha: 1, y: 0, scale: 1, stagger: 0.08 }, 0.34);
    }

    if (index === 3) {
      const header = slide.querySelector<HTMLElement>('.bento-header');
      const galleryItems = this._getGalleryItems();
      const tl = gsap.timeline({ defaults: { duration: 1.0, ease: 'expo.out' } });
      if (header) {
        tl.fromTo(header, { autoAlpha: 0, y: 28 }, { autoAlpha: 1, y: 0 }, 0);
      }
      tl.fromTo(galleryItems,
        { autoAlpha: 0, y: 76, scale: 0.955, clipPath: 'inset(8% 8% 8% 8%)' },
        { autoAlpha: 1, y: 0, scale: 1, clipPath: 'inset(0% 0% 0% 0%)', stagger: { each: 0.065, from: 'center' } },
        0.08
      );
    }

    if (slide.classList.contains('new-arrivals-slide')) {
      this._nacAnimate(true);

      const nacTag = this.newArrivalsSec?.nativeElement.querySelector('.section-tag') as HTMLElement;
      const nacIndex = this.newArrivalsSec?.nativeElement.querySelector('.index-num') as HTMLElement;
      const cards = slide.querySelectorAll<HTMLElement>('.nac__card');

      const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });

      if (nacTag) {
        const chars = nacTag.querySelectorAll('.nac-char');
        tl.fromTo(chars,
          { opacity: 0, x: -4 },
          { opacity: 1, x: 0, stagger: 0.04, duration: 0.15 },
          0
        );
      }

      if (nacIndex) {
        tl.fromTo(nacIndex,
          { autoAlpha: 0, y: 15 },
          { autoAlpha: 1, y: 0, duration: 0.6 },
          0
        );
      }

      tl.fromTo(cards,
        { autoAlpha: 0, y: 46, scale: 0.965 },
        { autoAlpha: 1, y: 0, scale: 1, stagger: 0.08, duration: 0.9, ease: 'expo.out' },
        0.15
      );
    }

    if (slide.classList.contains('categories-slide')) {
      const header = slide.querySelectorAll<HTMLElement>('.index-num, .section-tag');
      const categoryRows = slide.querySelectorAll<HTMLElement>('.category-index-row');
      gsap.timeline({ defaults: { ease: 'expo.out', duration: 0.9 } })
        .fromTo(header, { autoAlpha: 0, x: -22 }, { autoAlpha: 1, x: 0, stagger: 0.08 })
        .fromTo(categoryRows,
          { autoAlpha: 0, y: 34, clipPath: 'inset(0 0 100% 0)' },
          { autoAlpha: 1, y: 0, clipPath: 'inset(0% 0% 0% 0%)', stagger: 0.1 },
          0.08
        );
    }

    if (slide.classList.contains('cta-footer-slide')) {
      const ctaTitle = slide.querySelector<HTMLElement>('.cta-sec__title');
      const ctaChars = ctaTitle ? slide.querySelectorAll<HTMLElement>('.split-char--cta') : [];
      const ctaElements = slide.querySelectorAll<HTMLElement>('.cta-sec__subtitle, .cta-sec .btn-primary');
      const footer = slide.querySelector<HTMLElement>('.footer-sec__inner');
      const tl = gsap.timeline({ defaults: { ease: 'expo.out', duration: 0.95 } });
      if (ctaChars.length) {
        tl.fromTo(ctaChars, { autoAlpha: 0, yPercent: 110, rotateX: -28 }, { autoAlpha: 1, yPercent: 0, rotateX: 0, stagger: 0.025 }, 0);
      }
      if (ctaElements.length) {
        tl.fromTo(ctaElements, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, stagger: 0.08 }, ctaChars.length ? 0.32 : 0);
      }
      if (footer) {
        tl.fromTo(footer, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power3.out' }, ctaChars.length ? 0.45 : 0.1);
      }
    }
  }

  private _animationRoot(): HTMLElement {
    return (this.canvasHost.nativeElement.closest('.homepage-wrapper') as HTMLElement | null) || document.body;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SVG Displacement Glitch Effect
  // Technique: feTurbulence + feDisplacementMap driven by GSAP quickTo + RAF
  // Inspired by: https://codepen.io/vii120/pen/VYmmdMK
  // ─────────────────────────────────────────────────────────────────────────────
  private _initGlitchEffect(): void {
    const turbEl = this.feTurbulenceRef?.nativeElement;
    const dispEl = this.feDisplacementMapRef?.nativeElement;
    const titleEl = this.glitchTitle?.nativeElement;

    if (!turbEl || !dispEl || !titleEl || this._prefersReducedMotion) return;

    this._glitchContext = gsap.context(() => {
      // ── State ────────────────────────────────────────────────────────────────
      const state = {
        // Current interpolated values (live-driven towards targets)
        freqX: 0,
        freqY: 0,
        scale: 0,
        // Target values (set by mouse position logic)
        targetFreqX: 0,
        targetFreqY: 0,
        targetScale: 0,
        // Idle breathing counter
        idleTime: 0,
        isHovering: false,
        // RAF handle
        rafId: 0,
      };

      // ── GSAP quickTo drivers for ultra-smooth lerping ────────────────────────
      // These drive the state object properties, NOT DOM attributes directly
      const lerpFreqX = gsap.quickTo(state, 'freqX', { duration: 0.65, ease: 'power2.out' });
      const lerpFreqY = gsap.quickTo(state, 'freqY', { duration: 0.65, ease: 'power2.out' });
      const lerpScale = gsap.quickTo(state, 'scale', { duration: 0.55, ease: 'power2.out' });

      // ── SVG attribute flush function (called every frame) ────────────────────
      const flushAttributes = () => {
        turbEl.setAttribute('baseFrequency', `${state.freqX.toFixed(4)} ${state.freqY.toFixed(4)}`);
        dispEl.setAttribute('scale', state.scale.toFixed(2));
      };

      // ── Idle breathing timeline (plays when cursor is away from hero) ─────────
      const breatheTl = gsap.timeline({ repeat: -1, yoyo: true, ease: 'sine.inOut' });
      breatheTl
        .to(state, {
          targetFreqX: 0.008, targetFreqY: 0.003, targetScale: 6, duration: 3.5, ease: 'sine.inOut',
          onUpdate: () => {
            lerpFreqX(state.targetFreqX);
            lerpFreqY(state.targetFreqY);
            lerpScale(state.targetScale);
          }
        })
        .to(state, {
          targetFreqX: 0.003, targetFreqY: 0.008, targetScale: 3, duration: 4.0, ease: 'sine.inOut',
          onUpdate: () => {
            lerpFreqX(state.targetFreqX);
            lerpFreqY(state.targetFreqY);
            lerpScale(state.targetScale);
          }
        });

      // ── RAF loop: commits interpolated values to SVG every frame ─────────────
      const loop = () => {
        flushAttributes();
        state.rafId = requestAnimationFrame(loop);
      };
      state.rafId = requestAnimationFrame(loop);

      // ── Mouse move handler ────────────────────────────────────────────────────
      const onMouseMove = (e: MouseEvent) => {
        const rect = titleEl.getBoundingClientRect();

        // Distance from cursor to the title centre
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;

        // Normalise to [-1, 1] relative to half-viewport
        const nx = dx / (window.innerWidth / 2);
        const ny = dy / (window.innerHeight / 2);

        // Proximity: 0 = far, 1 = directly over title
        const proximity = 1 - Math.min(1, Math.sqrt(nx * nx + ny * ny) / 1.2);

        if (proximity > 0.05) {
          // Pause idle breathing while cursor is nearby
          if (!state.isHovering) {
            breatheTl.pause();
            state.isHovering = true;
          }

          // Map mouse position → turbulence frequencies
          const maxFreqX = 0.04 + Math.abs(nx) * 0.06;  // 0.04 – 0.10
          const maxFreqY = 0.04 + Math.abs(ny) * 0.06;
          const maxScale = 18 + proximity * 42;           // 18 – 60 px displacement

          lerpFreqX(maxFreqX * proximity);
          lerpFreqY(maxFreqY * proximity);
          lerpScale(maxScale * proximity);
        } else {
          // Cursor far away — resume breathing
          if (state.isHovering) {
            breatheTl.resume();
            state.isHovering = false;
            // Ease back to rest
            lerpFreqX(0);
            lerpFreqY(0);
            lerpScale(0);
          }
        }
      };

      // ── Mouse leave hero section → full rest ─────────────────────────────────
      const onMouseLeave = () => {
        if (state.isHovering) {
          state.isHovering = false;
          breatheTl.resume();
          lerpFreqX(0);
          lerpFreqY(0);
          lerpScale(0);
        }
      };

      // Attach to hero section (slide 1) rather than window to limit scope
      const heroSection = titleEl.closest('.hero-sec') as HTMLElement | null ?? titleEl;
      heroSection.addEventListener('mousemove', onMouseMove, { passive: true });
      heroSection.addEventListener('mouseleave', onMouseLeave, { passive: true });

      // ── Cleanup registered via gsap.context cleanupFn ────────────────────────
      return () => {
        heroSection.removeEventListener('mousemove', onMouseMove);
        heroSection.removeEventListener('mouseleave', onMouseLeave);
        cancelAnimationFrame(state.rafId);
        breatheTl.kill();
        // Reset filter to identity
        turbEl.setAttribute('baseFrequency', '0 0');
        dispEl.setAttribute('scale', '0');
      };
    });
  }

  private _initCanvas(): void {
    const host = this.canvasHost.nativeElement;
    const ctx = this.canvasService.init(host);

    this.heroScene.attach(ctx);
    this.heroScene.build();
    this.canvasService.start((delta) => this.heroScene.update(delta));
    this.heroScene.intro();

    requestAnimationFrame(() => host.classList.add('ready'));
  }

  private _preparePageForMotion(): void {
    const nacTag = this.newArrivalsSec?.nativeElement.querySelector('.section-tag') as HTMLElement;
    if (nacTag) {
      this._splitTextIntoSpans(nacTag, 'nac-char');
    }

    const revealTargets = gsap.utils.toArray<HTMLElement>(
      '.animate-txt, .section-tag, .index-num, .spec-item, .category-index-row, .bento-header, .cta-sec__inner, .footer-sec__inner',
    ).filter(el => el !== nacTag);

    gsap.set(revealTargets, {
      autoAlpha: 0,
      y: 32,
      force3D: true,
      willChange: 'transform, opacity',
    });

    if (nacTag) {
      gsap.set(nacTag, { autoAlpha: 1, y: 0 });
      const nacChars = nacTag.querySelectorAll('.nac-char');
      gsap.set(nacChars, { opacity: 0 });
    }

    const galleryItems = this._getGalleryItems();
    gsap.set(galleryItems, {
      autoAlpha: 0,
      y: 72,
      scale: 0.96,
      force3D: true,
      willChange: 'transform, opacity',
    });
  }

  private _applyReducedMotionState(): void {
    gsap.set(
      '.navbar, .hero-frame, .hero-frame__meta, .hero-sec__badge, .hero-sec__subtitle, .hero-sec__cta, .scroll-down-prompt, .animate-txt, .section-tag, .index-num, .spec-item, .category-index-row, .bento-header, .gallery__item, .cta-sec__inner, .footer-sec__inner, .nac-char',
      {
        autoAlpha: 1,
        clearProps: 'transform,clipPath,willChange',
      },
    );
  }

  private _splitTextIntoSpans(element: HTMLElement, className = 'split-char'): HTMLElement[] {
    const text = element.textContent || '';
    element.setAttribute('aria-label', text.trim());
    element.innerHTML = '';

    return Array.from(text).map((char) => {
      const span = document.createElement('span');
      span.className = className;
      span.setAttribute('aria-hidden', 'true');
      span.style.display = 'inline-block';
      span.style.willChange = 'transform, opacity';
      span.textContent = char === ' ' ? '\u00a0' : char;
      element.appendChild(span);
      return span;
    });
  }

  private _animateHeroEntrance(): void {
    const heroLines = [
      this.heroLine1?.nativeElement,
      this.heroLine2?.nativeElement,
      this.heroLine3?.nativeElement,
    ].filter(Boolean) as HTMLElement[];
    const headlineChars = heroLines.flatMap((line) => this._splitTextIntoSpans(line));
    const navbar = document.querySelector<HTMLElement>('.navbar');
    const navPieces = navbar
      ? gsap.utils.toArray<HTMLElement>('.navbar__logo, .navbar__links li, .navbar__actions')
      : [];
    const heroFrame = document.querySelector<HTMLElement>('.hero-frame');
    const heroMeta = gsap.utils.toArray<HTMLElement>('.hero-frame__meta');
    const heroVideoWrap = this.heroVideo?.nativeElement;
    const heroOverlay = heroVideoWrap?.querySelector<HTMLElement>('.hero-sec__overlay');
    const supportingElements = [
      this.heroBadge?.nativeElement,
      this.heroSub?.nativeElement,
      this.heroCta?.nativeElement,
      this.scrollIndicator?.nativeElement,
    ].filter(Boolean) as HTMLElement[];

    gsap.set(heroLines, { clipPath: 'inset(0 0 100% 0)' });
    gsap.set(headlineChars, {
      autoAlpha: 0,
      yPercent: 125,
      rotateX: -38,
      rotateZ: 4,
      transformOrigin: '50% 100%',
      force3D: true,
    });
    gsap.set(supportingElements, {
      autoAlpha: 0,
      y: 30,
      clipPath: 'inset(0 0 100% 0)',
      force3D: true,
    });
    gsap.set(heroFrame, {
      autoAlpha: 0,
      scaleX: 0.94,
      scaleY: 0.92,
      transformOrigin: '50% 50%',
      force3D: true,
    });
    gsap.set(heroMeta, { autoAlpha: 0, y: -16, force3D: true });
    gsap.set(navbar, { autoAlpha: 0, y: -32, force3D: true });
    gsap.set(navPieces, { autoAlpha: 0, y: -16, force3D: true });
    gsap.set(heroVideoWrap, { scale: 1.08, autoAlpha: 0.88, force3D: true });
    gsap.set(heroOverlay, { autoAlpha: 0 });

    const tl = gsap.timeline({
      defaults: { ease: 'expo.out' },
      delay: 0.08,
    });

    tl.to(heroVideoWrap, { scale: 1, autoAlpha: 1, duration: 1.8 }, 0)
      .to(heroOverlay, { autoAlpha: 1, duration: 1.2, ease: 'power2.out' }, 0.05)
      .to(navbar, { autoAlpha: 1, y: 0, duration: 0.95 }, 0.1)
      .to(navPieces, { autoAlpha: 1, y: 0, duration: 0.85, stagger: 0.06 }, 0.18)
      .to(heroFrame, { autoAlpha: 1, scaleX: 1, scaleY: 1, duration: 1.35 }, 0.18)
      .to(heroMeta, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.12 }, 0.38)
      .to(heroLines, { clipPath: 'inset(0% 0% -8% 0%)', duration: 0.01, stagger: 0.08 }, 0.34)
      .to(
        headlineChars,
        {
          autoAlpha: 1,
          yPercent: 0,
          rotateX: 0,
          rotateZ: 0,
          duration: 1.3,
          stagger: { each: 0.018, from: 'start' },
        },
        0.42,
      )
      .to(
        supportingElements,
        {
          autoAlpha: 1,
          y: 0,
          clipPath: 'inset(0% 0% 0% 0%)',
          duration: 1.0,
          stagger: 0.1,
        },
        1.05,
      )
      .set([...headlineChars, ...supportingElements, ...heroLines, ...navPieces], {
        clearProps: 'willChange',
      });

    this._timelines.push(tl);
  }

  private _setupMarqueeScrub(): void {
    const marqueeL = this.marqueeLeft?.nativeElement.querySelector<HTMLElement>('.marquee-track__inner');
    const marqueeR = this.marqueeRight?.nativeElement.querySelector<HTMLElement>('.marquee-track__inner');

    if (!marqueeL || !marqueeR) return;

    const loopL = gsap.to(marqueeL, {
      xPercent: -50,
      repeat: -1,
      duration: 18,
      ease: 'none',
      force3D: true,
    });

    const loopR = gsap.to(marqueeR, {
      xPercent: 50,
      repeat: -1,
      duration: 18,
      ease: 'none',
      force3D: true,
    });

    this._timelines.push(loopL, loopR);
  }

  private _setupMagneticButtons(): void {
    const buttons = gsap.utils.toArray<HTMLElement>('#home-shop-collection-btn, #cta-shop-collection-btn');
    const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    if (!canHover) return;

    buttons.forEach((button) => {
      const moveX = gsap.quickTo(button, 'x', { duration: 0.42, ease: 'power3.out' });
      const moveY = gsap.quickTo(button, 'y', { duration: 0.42, ease: 'power3.out' });
      const scale = gsap.quickTo(button, 'scale', { duration: 0.36, ease: 'power3.out' });

      const onMove = (event: Event) => {
        const pointer = event as PointerEvent;
        const rect = button.getBoundingClientRect();
        const relX = pointer.clientX - (rect.left + rect.width / 2);
        const relY = pointer.clientY - (rect.top + rect.height / 2);

        moveX(relX * 0.24);
        moveY(relY * 0.36);
        scale(1.035);
      };

      const onLeave = () => {
        moveX(0);
        moveY(0);
        scale(1);
      };

      this._listen(button, 'pointermove', onMove);
      this._listen(button, 'pointerleave', onLeave);
      this._listen(button, 'blur', onLeave);
    });
  }

  private _setupBentoHoverInteractions(): void {
    const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (!canHover) return;

    this._getGalleryItems().forEach((item) => {
      const img = item.querySelector<HTMLElement>('img');
      if (!img) return;

      const rotateX = gsap.quickTo(item, 'rotationX', { duration: 0.55, ease: 'power3.out' });
      const rotateY = gsap.quickTo(item, 'rotationY', { duration: 0.55, ease: 'power3.out' });
      const z = gsap.quickTo(item, 'z', { duration: 0.55, ease: 'power3.out' });
      const imageScale = gsap.quickTo(img, 'scale', { duration: 0.7, ease: 'power3.out' });

      const onEnter = () => {
        item.classList.add('is-hovered');
        z(28);
        imageScale(1.085);
      };

      const onMove = (event: Event) => {
        const pointer = event as PointerEvent;
        const rect = item.getBoundingClientRect();
        const px = (pointer.clientX - rect.left) / rect.width;
        const py = (pointer.clientY - rect.top) / rect.height;

        item.style.setProperty('--mx', `${px * 100}%`);
        item.style.setProperty('--my', `${py * 100}%`);
        rotateX((0.5 - py) * 7);
        rotateY((px - 0.5) * 9);
      };

      const onLeave = () => {
        item.classList.remove('is-hovered');
        rotateX(0);
        rotateY(0);
        z(0);
        imageScale(1);
      };

      this._listen(item, 'pointerenter', onEnter);
      this._listen(item, 'pointermove', onMove);
      this._listen(item, 'pointerleave', onLeave);
      this._listen(item, 'blur', onLeave);
    });
  }

  private _setupSpotlightTracking(): void {
    const section = this.newArrivalsSec?.nativeElement;
    const spotlight = this.nacSpotlight?.nativeElement;

    if (!section || !spotlight) return;

    const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (!canHover) return;

    this.ngZone.runOutsideAngular(() => {
      const onEnter = () => {
        gsap.to(spotlight, { autoAlpha: 1, duration: 0.4, ease: 'power1.out', overwrite: 'auto' });
      };

      const onMove = (event: Event) => {
        const pointer = event as PointerEvent;
        const rect = section.getBoundingClientRect();
        const px = pointer.clientX - rect.left;
        const py = pointer.clientY - rect.top;

        gsap.to(spotlight, {
          '--x': `${px}px`,
          '--y': `${py}px`,
          duration: 0.35,
          ease: 'power2.out',
          overwrite: 'auto',
        });
      };

      const onLeave = () => {
        gsap.to(spotlight, { autoAlpha: 0, duration: 0.5, ease: 'power1.out', overwrite: 'auto' });
      };

      this._listen(section, 'pointerenter', onEnter);
      this._listen(section, 'pointermove', onMove);
      this._listen(section, 'pointerleave', onLeave);
    });
  }

  private _initNewArrivalsAnimations(): void {
    if (!this.newArrivals.length) return;

    this.nacActiveIndex = 0;
    this.cdr.markForCheck();

    // Small delay to ensure Angular has rendered the elements in the DOM
    setTimeout(() => {
      if (!this._isDestroyed) {
        this._nacAnimate(true);
      }
    }, 60);

    // Setup window resize listener using our clean listener registration
    this._listen(window, 'resize', () => {
      this._nacAnimate(true);
    });
  }

  nacGoTo(index: number): void {
    if (this.isLoadingNewArrivals || !this.newArrivals.length) return;
    this.nacActiveIndex = index;
    this.cdr.markForCheck();
    this._nacAnimate();
  }

  nacPrev(): void {
    if (this.nacActiveIndex > 0) {
      this.nacGoTo(this.nacActiveIndex - 1);
    }
  }

  nacNext(): void {
    if (this.nacActiveIndex < this.newArrivals.length - 1) {
      this.nacGoTo(this.nacActiveIndex + 1);
    }
  }

  private _nacAnimate(immediate = false): void {
    const track = this.nacTrack?.nativeElement;
    if (!track) return;

    const cells = Array.from(track.querySelectorAll('.nac__perspective-cell')) as HTMLElement[];
    if (!cells.length) return;

    const activeIndex = this.nacActiveIndex;
    const duration = immediate ? 0 : 0.85;

    // Calculate viewport & relative position to center the active cell
    const viewportWidth = track.parentElement?.getBoundingClientRect().width || window.innerWidth;
    const activeCell = cells[activeIndex];
    if (!activeCell) return;

    const cellWidth = activeCell.getBoundingClientRect().width;
    const cellLeftRelative = activeCell.offsetLeft;

    // Translation target to center the active slide
    const targetX = (viewportWidth / 2) - cellLeftRelative - (cellWidth / 2);

    // Animate the track container
    gsap.to(track, {
      x: targetX,
      duration: duration,
      ease: 'power3.out',
      overwrite: 'auto'
    });

    // 3D Tilt rotation and scaling of each card
    cells.forEach((cell, i) => {
      const card = cell.querySelector('.nac__card') as HTMLElement;
      if (!card) return;

      const diff = activeIndex - i;
      const rotateY = diff * -50; // CodePen effect: rotates based on relative distance
      const scale = i === activeIndex ? 1 : 0.83;
      const z = i === activeIndex ? 0 : -120; // Inactive ones pushed back in 3D space

      const title = cell.querySelector('.nac__title') as HTMLElement;
      const price = cell.querySelector('.nac__price') as HTMLElement;

      gsap.to(card, {
        rotateY: rotateY,
        scale: scale,
        z: z,
        duration: duration + 0.15,
        ease: 'power2.out',
        overwrite: 'auto'
      });

      // Subtitle/title styling fade-in & clear text animation
      if (title) {
        gsap.to(title, {
          filter: 'none',
          opacity: i === activeIndex ? 1 : 0.4,
          duration: duration,
          ease: 'power2.out',
          overwrite: 'auto'
        });
      }

      if (price) {
        gsap.to(price, {
          opacity: i === activeIndex ? 1 : 0,
          y: i === activeIndex ? 0 : 8,
          duration: duration,
          ease: 'power2.out',
          overwrite: 'auto'
        });
      }
    });

    // Refresh ScrollTrigger since layout dimensions changed
    ScrollTrigger.refresh();
  }

  private _setupMobileGalleryAnimations(): void {
    const scroller = this.bentoGallery?.nativeElement.closest('.slide-content');
    if (!scroller) return;

    const targets = gsap.utils.toArray<HTMLElement>(
      '.mobile-gallery__hero-split, .track-card, .lookbook-item'
    );

    targets.forEach((target) => {
      gsap.set(target, {
        autoAlpha: 0,
        y: 40,
        force3D: true,
      });

      const trigger = ScrollTrigger.create({
        trigger: target,
        scroller: scroller,
        start: 'top 85%',
        end: 'bottom 15%',
        toggleActions: 'play none none reverse',
        onEnter: () => {
          gsap.to(target, {
            autoAlpha: 1,
            y: 0,
            duration: 0.8,
            ease: 'power2.out',
            overwrite: 'auto',
            lazy: true,
          });
        },
        onLeaveBack: () => {
          gsap.to(target, {
            autoAlpha: 0,
            y: 40,
            duration: 0.6,
            ease: 'power2.in',
            overwrite: 'auto',
            lazy: true,
          });
        }
      });

      this._scrollTriggers.push(trigger);
    });
  }

  private _getGalleryItems(): HTMLElement[] {
    return this.bentoGallery?.nativeElement
      ? Array.from(this.bentoGallery.nativeElement.querySelectorAll<HTMLElement>('.gallery__item'))
      : [];
  }

  private _trackTrigger(trigger: ScrollTrigger): void {
    this._scrollTriggers.push(trigger);
  }

  private _trackTimeline(timeline: gsap.core.Timeline): void {
    this._timelines.push(timeline);
  }

  private _listen(
    target: ListenerTarget,
    type: string,
    listener: EventListener,
    options?: AddEventListenerOptions,
  ): void {
    target.addEventListener(type, listener, options);
    this._cleanups.push(() => target.removeEventListener(type, listener, options));
  }

  // ── Sand Canvas Physics Simulation ─────────────────────────────────────────

  private _initSandCanvas(): void {
    this._sandCanvas = document.getElementById('sandCanvas') as HTMLCanvasElement;
    if (!this._sandCanvas) return;

    this._sandCtx = this._sandCanvas.getContext('2d');
    if (!this._sandCtx) return;

    this._sandDpr = Math.min(window.devicePixelRatio || 1, 2);
    this._resizeSandCanvas();

    window.addEventListener('resize', this._onSandResize);

    this._sandLastTime = performance.now();
    this._sandAnimationFrameId = requestAnimationFrame((now) => this._tickSand(now));
  }

  private _onSandResize = (): void => {
    this._resizeSandCanvas();
  };

  private _resizeSandCanvas(): void {
    if (!this._sandCanvas || !this._sandCtx) return;

    const rect = this._sandCanvas.parentElement?.getBoundingClientRect();
    this._sandW = rect?.width || window.innerWidth;
    this._sandH = rect?.height || window.innerHeight;

    this._sandCanvas.width = this._sandW * this._sandDpr;
    this._sandCanvas.height = this._sandH * this._sandDpr;
    this._sandCanvas.style.width = this._sandW + 'px';
    this._sandCanvas.style.height = this._sandH + 'px';

    this._sandCtx.setTransform(this._sandDpr, 0, 0, this._sandDpr, 0, 0);

    this._sandCols = Math.ceil(this._sandW / this._sandSettings.cellSize);
    this._sandRows = Math.ceil(this._sandH / this._sandSettings.cellSize);

    this._fixedCodepen = new Uint8Array(this._sandCols * this._sandRows);
    this._sandPile = new Uint8Array(this._sandCols * this._sandRows);

    this._sandCodepenCells = [];
    this._sandLooseCells = [];
    this._sandFalling = [];
    this._sandReforming = [];

    this._sandHiddenAlpha = 0;
    this._sandPhase = 'codepen';
    this._sandPhaseTime = 0;

    this._buildSandText();
  }

  private _buildSandText(): void {
    if (!this._sandCtx || !this._fixedCodepen) return;

    const maskCanvas = document.createElement('canvas');
    const maskCtx = maskCanvas.getContext('2d');
    if (!maskCtx) return;

    maskCanvas.width = this._sandW;
    maskCanvas.height = this._sandH;

    const fontSize = Math.min(this._sandW * 0.22, this._sandH * 0.28, 190);

    maskCtx.clearRect(0, 0, this._sandW, this._sandH);
    maskCtx.fillStyle = '#fff';
    maskCtx.textAlign = 'center';
    maskCtx.textBaseline = 'middle';
    maskCtx.font = `900 ${fontSize}px 'Outfit', sans-serif`;

    maskCtx.fillText(this._sandSettings.startText, this._sandW / 2, this._sandH * 0.38);

    const image = maskCtx.getImageData(0, 0, this._sandW, this._sandH).data;

    for (let row = 0; row < this._sandRows; row++) {
      for (let col = 0; col < this._sandCols; col++) {
        const x = Math.floor(col * this._sandSettings.cellSize + this._sandSettings.cellSize / 2);
        const y = Math.floor(row * this._sandSettings.cellSize + this._sandSettings.cellSize / 2);

        const pixelIndex = (y * this._sandW + x) * 4;
        const alpha = image[pixelIndex + 3];

        if (alpha > 35) {
          const i = row * this._sandCols + col;
          this._fixedCodepen[i] = 1;
          this._sandCodepenCells.push(i);
          this._sandLooseCells.push(i);
        }
      }
    }

    this._shuffleArray(this._sandLooseCells);
  }

  private _shuffleArray(array: any[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = array[i];
      array[i] = array[j];
      array[j] = temp;
    }
  }

  private _tickSand(now: number): void {
    if (this._isDestroyed || !this._sandCanvas || !this._sandCtx) return;

    const dt = Math.min((now - this._sandLastTime) / 1000, 0.033);
    this._sandLastTime = now;

    this._updateSandPhase(dt);
    this._updateSandFalling(dt);

    if (this._sandPhase !== 'reform' && this._sandPhase !== 'hiddenHold' && this._sandPhase !== 'hiddenFade') {
      for (let i = 0; i < this._sandSettings.settleStepsPerFrame; i++) {
        this._settleSandPile();
      }
    }

    this._drawSand();

    this._sandAnimationFrameId = requestAnimationFrame((n) => this._tickSand(n));
  }

  private _updateSandPhase(dt: number): void {
    this._sandPhaseTime += dt;

    if (this._sandPhase === 'codepen') {
      this._releaseSandCodepen();
    }

    if (this._sandPhase === 'pile' && this._sandPhaseTime >= this._sandSettings.pileHoldSeconds) {
      this._sandPhase = 'hiddenFadeIn';
      this._sandPhaseTime = 0;
      this._sandHiddenAlpha = 0;
    }

    if (this._sandPhase === 'hiddenFadeIn') {
      this._sandHiddenAlpha = Math.min(1, this._sandPhaseTime / this._sandSettings.hiddenFadeInSeconds);

      if (this._sandHiddenAlpha >= 1) {
        this._sandHiddenAlpha = 1;
        this._startSandReform();
      }
    }

    if (this._sandPhase === 'reform') {
      this._updateSandReform(dt);
    }

    if (this._sandPhase === 'hiddenHold') {
      this._sandHiddenAlpha = 1;

      if (this._sandPhaseTime >= this._sandSettings.revealHoldSeconds) {
        this._sandPhase = 'hiddenFade';
        this._sandPhaseTime = 0;
      }
    }

    if (this._sandPhase === 'hiddenFade') {
      this._sandHiddenAlpha = Math.max(0, 1 - this._sandPhaseTime / this._sandSettings.revealFadeSeconds);

      if (this._sandHiddenAlpha <= 0) {
        this._sandHiddenAlpha = 0;
        this._resetSandCycle();
      }
    }
  }

  private _releaseSandCodepen(): void {
    if (!this._fixedCodepen) return;

    if (this._sandLooseCells.length === 0) {
      this._sandPhase = 'falling';
      this._sandPhaseTime = 0;
      return;
    }

    for (let i = 0; i < this._sandSettings.releaseTestsPerFrame; i++) {
      if (this._sandLooseCells.length === 0) break;

      const listIndex = Math.floor(Math.random() * this._sandLooseCells.length);
      const cellIndex = this._sandLooseCells[listIndex];

      if (this._fixedCodepen[cellIndex] === 0) {
        this._sandLooseCells.splice(listIndex, 1);
        continue;
      }

      const col = cellIndex % this._sandCols;
      const row = Math.floor(cellIndex / this._sandCols);

      const belowEmpty =
        row >= this._sandRows - 1 ||
        this._fixedCodepen[this._sandIndex(col, Math.min(row + 1, this._sandRows - 1))] === 0;

      const sideEmpty =
        col <= 0 ||
        col >= this._sandCols - 1 ||
        this._fixedCodepen[this._sandIndex(Math.max(col - 1, 0), row)] === 0 ||
        this._fixedCodepen[this._sandIndex(Math.min(col + 1, this._sandCols - 1), row)] === 0;

      const edgeMultiplier = belowEmpty || sideEmpty ? 3.3 : 1;

      if (Math.random() < this._sandSettings.releaseChance * edgeMultiplier) {
        this._releaseOneSandGrain(cellIndex);
        this._sandLooseCells.splice(listIndex, 1);
      }
    }
  }

  private _releaseOneSandGrain(cellIndex: number): void {
    if (!this._fixedCodepen) return;

    const col = cellIndex % this._sandCols;
    const row = Math.floor(cellIndex / this._sandCols);

    this._fixedCodepen[cellIndex] = 0;

    this._sandFalling.push({
      x: col * this._sandSettings.cellSize,
      y: row * this._sandSettings.cellSize,

      vx: this._randRange(-22, 22),
      vy: this._randRange(40, 150),

      drift: this._randRange(-55, 55),
      driftTarget: this._randRange(-85, 85),
      driftTimer: this._randRange(0.18, 0.9)
    });
  }

  private _updateSandFalling(dt: number): void {
    for (let i = this._sandFalling.length - 1; i >= 0; i--) {
      const p = this._sandFalling[i];

      p.driftTimer -= dt;

      if (p.driftTimer <= 0) {
        p.driftTarget = this._randRange(-85, 85);
        p.driftTimer = this._randRange(0.25, 1.2);
      }

      p.drift += (p.driftTarget - p.drift) * dt * 2;

      p.vx += p.drift * dt;
      p.vy += this._sandSettings.gravity * dt;

      p.vx *= this._sandSettings.airDrag;
      p.vy *= this._sandSettings.airDrag;

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      const col = Math.floor(p.x / this._sandSettings.cellSize);
      const nextRow = Math.floor((p.y + this._sandSettings.cellSize) / this._sandSettings.cellSize);

      if (p.x < -60) p.x = 0;
      if (p.x > this._sandW + 60) p.x = this._sandW - this._sandSettings.cellSize;

      if (nextRow >= this._sandRows || this._isSandPileSolid(col, nextRow)) {
        this._settleSandFallingParticle(p);
        this._sandFalling.splice(i, 1);
      }
    }

    if (this._sandPhase === 'falling' && this._sandFalling.length === 0) {
      this._sandPhase = 'pile';
      this._sandPhaseTime = 0;
    }
  }

  private _sandIndex(col: number, row: number): number {
    return row * this._sandCols + col;
  }

  private _isSandPileSolid(col: number, row: number): boolean {
    if (row >= this._sandRows) return true;
    if (col < 0 || col >= this._sandCols) return true;
    if (!this._sandPile) return true;

    return this._sandPile[this._sandIndex(col, row)] === 1;
  }

  private _setSandPile(col: number, row: number): void {
    if (col < 0 || col >= this._sandCols || row < 0 || row >= this._sandRows) return;
    if (this._sandPile) {
      this._sandPile[this._sandIndex(col, row)] = 1;
    }
  }

  private _settleSandFallingParticle(p: any): void {
    let col = Math.floor(p.x / this._sandSettings.cellSize);
    let row = Math.floor(p.y / this._sandSettings.cellSize);

    col = Math.max(0, Math.min(this._sandCols - 1, col));
    row = Math.max(0, Math.min(this._sandRows - 1, row));

    if (!this._isSandPileSolid(col, row)) {
      this._setSandPile(col, row);
      return;
    }

    if (!this._isSandPileSolid(col - 1, row)) {
      this._setSandPile(col - 1, row);
      return;
    }

    if (!this._isSandPileSolid(col + 1, row)) {
      this._setSandPile(col + 1, row);
      return;
    }

    for (let y = row - 1; y >= 0; y--) {
      if (!this._isSandPileSolid(col, y)) {
        this._setSandPile(col, y);
        return;
      }
    }
  }

  private _settleSandPile(): void {
    if (!this._sandPile) return;

    const leftToRight = Math.random() > 0.5;

    for (let row = this._sandRows - 2; row >= 0; row--) {
      if (leftToRight) {
        for (let col = 1; col < this._sandCols - 1; col++) {
          this._settleSandPileCell(col, row);
        }
      } else {
        for (let col = this._sandCols - 2; col >= 1; col--) {
          this._settleSandPileCell(col, row);
        }
      }
    }
  }

  private _settleSandPileCell(col: number, row: number): void {
    if (!this._sandPile) return;

    const current = this._sandIndex(col, row);

    if (this._sandPile[current] !== 1) return;

    if (!this._isSandPileSolid(col, row + 1)) {
      this._setSandPile(col, row + 1);
      this._sandPile[current] = 0;
      return;
    }

    const preferLeft = Math.random() > 0.5;

    if (preferLeft) {
      if (!this._isSandPileSolid(col - 1, row + 1)) {
        this._setSandPile(col - 1, row + 1);
        this._sandPile[current] = 0;
        return;
      }

      if (!this._isSandPileSolid(col + 1, row + 1)) {
        this._setSandPile(col + 1, row + 1);
        this._sandPile[current] = 0;
        return;
      }
    } else {
      if (!this._isSandPileSolid(col + 1, row + 1)) {
        this._setSandPile(col + 1, row + 1);
        this._sandPile[current] = 0;
        return;
      }

      if (!this._isSandPileSolid(col - 1, row + 1)) {
        this._setSandPile(col - 1, row + 1);
        this._sandPile[current] = 0;
        return;
      }
    }
  }

  private _collectSandPileCells(): number[] {
    const cells: number[] = [];
    if (!this._sandPile) return cells;

    for (let row = this._sandRows - 1; row >= 0; row--) {
      for (let col = 0; col < this._sandCols; col++) {
        const i = this._sandIndex(col, row);
        if (this._sandPile[i] === 1) {
          cells.push(i);
        }
      }
    }

    return cells;
  }

  private _startSandReform(): void {
    if (!this._sandPile) return;

    const pileCells = this._collectSandPileCells();
    const targets = this._sandCodepenCells.slice();

    this._sandPile.fill(0);

    pileCells.sort((a, b) => Math.floor(b / this._sandCols) - Math.floor(a / this._sandCols));
    targets.sort((a, b) => Math.floor(b / this._sandCols) - Math.floor(a / this._sandCols));

    const count = Math.min(pileCells.length, targets.length);

    for (let i = 0; i < count; i++) {
      const source = pileCells[i];
      const target = targets[i];

      const sx = (source % this._sandCols) * this._sandSettings.cellSize;
      const sy = Math.floor(source / this._sandCols) * this._sandSettings.cellSize;
      const tx = (target % this._sandCols) * this._sandSettings.cellSize;
      const ty = Math.floor(target / this._sandCols) * this._sandSettings.cellSize;

      this._sandReforming.push({
        sx,
        sy,
        tx,
        ty,

        x: sx,
        y: sy,

        delay: this._randRange(0, this._sandSettings.reformStaggerSeconds),
        duration: this._randRange(
          this._sandSettings.reformDurationSeconds * 0.75,
          this._sandSettings.reformDurationSeconds * 1.15
        ),

        wave: this._randRange(-18, 18),
        phaseOffset: this._randRange(0, Math.PI * 2)
      });
    }

    this._sandPhase = 'reform';
    this._sandPhaseTime = 0;
  }

  private _updateSandReform(dt: number): void {
    this._sandHiddenAlpha = 1;
    let allArrived = true;

    for (const p of this._sandReforming) {
      const localTime = this._sandPhaseTime - p.delay;

      if (localTime <= 0) {
        p.x = p.sx;
        p.y = p.sy;
        allArrived = false;
        continue;
      }

      const t = Math.max(0, Math.min(1, localTime / p.duration));
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

      const arc = Math.sin(eased * Math.PI);
      const wobble = Math.sin(eased * Math.PI * 2 + p.phaseOffset) * p.wave * arc;

      p.x = p.sx + (p.tx - p.sx) * eased + wobble;
      p.y = p.sy + (p.ty - p.sy) * eased - arc * this._sandH * 0.08;

      if (t < 1) {
        allArrived = false;
      }
    }

    if (allArrived) {
      if (this._fixedCodepen) {
        for (const cell of this._sandCodepenCells) {
          this._fixedCodepen[cell] = 1;
        }
      }

      this._sandReforming = [];
      this._sandPhase = 'hiddenHold';
      this._sandPhaseTime = 0;
      this._sandHiddenAlpha = 1;
    }
  }

  private _resetSandCycle(): void {
    if (!this._fixedCodepen || !this._sandPile) return;

    this._fixedCodepen.fill(0);
    this._sandPile.fill(0);

    this._sandLooseCells = this._sandCodepenCells.slice();
    this._shuffleArray(this._sandLooseCells);

    this._sandFalling = [];
    this._sandReforming = [];

    for (const cell of this._sandCodepenCells) {
      this._fixedCodepen[cell] = 1;
    }

    this._sandHiddenAlpha = 0;
    this._sandPhase = 'codepen';
    this._sandPhaseTime = 0;
  }

  private _drawSand(): void {
    if (!this._sandCtx) return;

    this._sandCtx.clearRect(0, 0, this._sandW, this._sandH);

    // Draw Hidden Text (White matching typography)
    if (this._sandHiddenAlpha > 0) {
      this._sandCtx.save();
      const fontSize = Math.max(12, Math.min(this._sandW * 0.035, 18));
      this._sandCtx.globalAlpha = this._sandHiddenAlpha;
      this._sandCtx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      this._sandCtx.textAlign = 'center';
      this._sandCtx.textBaseline = 'middle';
      this._sandCtx.font = `600 ${fontSize}px 'Outfit', sans-serif`;
      
      this._sandCtx.fillText(this._sandSettings.hiddenText, this._sandW / 2, this._sandH - 50);
      this._sandCtx.restore();
    }

    const size = this._sandSettings.cellSize;

    // Helper to get color based on coordinates
    const getGrainColor = (col: number, row: number): string => {
      const sum = col + row;
      if (sum % 3 === 0) return 'rgba(212, 175, 55, 0.95)'; // Kisho Brand Gold
      if (sum % 3 === 1) return 'rgba(255, 255, 255, 0.9)';  // Pure White
      return 'rgba(255, 255, 255, 0.45)';                    // Soft Gray
    };

    // Draw Fixed Text Grains
    if (this._fixedCodepen) {
      for (let row = 0; row < this._sandRows; row++) {
        for (let col = 0; col < this._sandCols; col++) {
          if (this._fixedCodepen[this._sandIndex(col, row)] === 1) {
            this._sandCtx.fillStyle = getGrainColor(col, row);
            this._sandCtx.fillRect(col * size, row * size, size, size);
          }
        }
      }
    }

    // Draw Falling Grains
    for (const p of this._sandFalling) {
      const col = Math.floor(p.x / size);
      const row = Math.floor(p.y / size);
      this._sandCtx.fillStyle = getGrainColor(col, row);
      this._sandCtx.fillRect(p.x, p.y, size, size);
    }

    // Draw Pile Grains
    if (this._sandPile) {
      for (let row = 0; row < this._sandRows; row++) {
        for (let col = 0; col < this._sandCols; col++) {
          if (this._sandPile[this._sandIndex(col, row)] === 1) {
            this._sandCtx.fillStyle = getGrainColor(col, row);
            this._sandCtx.fillRect(col * size, row * size, size, size);
          }
        }
      }
    }

    // Draw Reforming Grains
    for (const p of this._sandReforming) {
      const col = Math.floor(p.tx / size);
      const row = Math.floor(p.ty / size);
      this._sandCtx.fillStyle = getGrainColor(col, row);
      this._sandCtx.fillRect(p.x, p.y, size, size);
    }
  }

  private _randRange(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }
}
