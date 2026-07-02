// ─────────────────────────────────────────────────────────────────────────────
// three-canvas.component.ts — The host component for any Three.js scene
//
// Usage in a parent template:
//
//   <app-three-canvas [scene]="myHeroScene" class="hero-canvas" />
//
// The component:
//  • Creates a full-bleed <div> container for the renderer
//  • Provides ThreeCanvasService to itself (isolated instance per component)
//  • Detects mobile/low-power devices and skips WebGL initialization
//  • Handles page visibility change (pauses/resumes on tab switch)
// ─────────────────────────────────────────────────────────────────────────────

import {
  Component,
  Input,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  ChangeDetectionStrategy,
} from '@angular/core';
import { ThreeCanvasService } from './three-canvas.service';
import { SceneBuilder } from './scene-builder.abstract';

@Component({
  selector: 'app-three-canvas',
  template: `
    <div
      #canvasHost
      class="three-canvas-host"
      aria-hidden="true"
      [class.webgl-unavailable]="!_webglAvailable"
    ></div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      position: relative;
    }
    .three-canvas-host {
      width: 100%;
      height: 100%;
      position: absolute;
      top: 0;
      left: 0;
    }
    /* Fade in once WebGL is ready — prevents layout shift flash */
    .three-canvas-host canvas {
      opacity: 0;
      transition: opacity 0.6s ease;
    }
    .three-canvas-host.ready canvas {
      opacity: 1;
    }
  `],
  // Use OnPush — only re-renders when inputs change, not on every tick
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Each instance gets its own ThreeCanvasService — NOT a shared singleton
  providers: [ThreeCanvasService],
})
export class ThreeCanvasComponent implements AfterViewInit, OnDestroy {

  @ViewChild('canvasHost', { static: true }) private _host!: ElementRef<HTMLDivElement>;

  /**
   * The scene to render. Pass an instance of any class extending SceneBuilder.
   * Setting this before ngAfterViewInit is the standard usage.
   */
  @Input() scene!: SceneBuilder;

  _webglAvailable = true;

  private _visibilityHandler!: () => void;

  constructor(private readonly canvasService: ThreeCanvasService) { }

  ngAfterViewInit(): void {
    // Guard 1: Skip on devices that can't run WebGL (old iOS, very low-end)
    if (!this._isWebGLSupported()) {
      this._webglAvailable = false;
      console.warn('[ThreeCanvasComponent] WebGL not supported on this device.');
      return;
    }

    // Guard 2: Skip on low-power devices with < 4 CPU cores (battery saver)
    if (this._isLowPowerDevice()) {
      this._webglAvailable = false;
      console.info('[ThreeCanvasComponent] Low-power device detected — skipping 3D scene.');
      return;
    }

    const host = this._host.nativeElement;
    const ctx = this.canvasService.init(host);

    // Let the scene builder populate itself
    this.scene.attach(ctx);
    this.scene.build();

    // Start the GSAP-synced render loop
    this.canvasService.start();

    // Play intro animation
    this.scene.intro();

    // Fade in the canvas
    requestAnimationFrame(() => host.classList.add('ready'));

    // Pause/resume on tab visibility change to save battery
    this._setupVisibilityHandler();
  }

  ngOnDestroy(): void {
    document.removeEventListener('visibilitychange', this._visibilityHandler);
    this.scene?.dispose();
    this.canvasService.dispose();
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private _isWebGLSupported(): boolean {
    try {
      const canvas = document.createElement('canvas');
      return !!(
        window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
      );
    } catch {
      return false;
    }
  }

  private _isLowPowerDevice(): boolean {
    // navigator.hardwareConcurrency is the number of logical CPU cores
    // Devices with ≤ 2 cores are typically very low-end
    return (navigator.hardwareConcurrency ?? 8) <= 2;
  }

  private _setupVisibilityHandler(): void {
    this._visibilityHandler = () => {
      if (document.hidden) {
        this.canvasService.pause();
      } else {
        this.canvasService.start();
      }
    };
    document.addEventListener('visibilitychange', this._visibilityHandler);
  }
}
