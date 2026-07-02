// ─────────────────────────────────────────────────────────────────────────────
// three-canvas.service.ts — The isolated Three.js lifecycle engine
//
// Responsibilities:
//  1. Own the WebGLRenderer — create it, resize it, dispose it
//  2. Sync the render loop with GSAP's ticker (not raw rAF) so GSAP animations
//     and Three.js frames are always in the same browser paint cycle
//  3. Expose a ResizeObserver-based resize handler (more accurate than
//     window.resize — fires exactly when the canvas container changes size)
//  4. Handle WebGL context loss / restoration gracefully (critical on mobile)
//  5. Provide a `dispose()` method that walks the entire scene graph and frees
//     ALL GPU memory — prevents memory leaks on Angular route changes
//
// Usage pattern in a component:
//
//   constructor(private canvas: ThreeCanvasService) {}
//
//   ngAfterViewInit() {
//     const { scene, camera } = this.canvas.init(this.hostEl.nativeElement);
//     // build your scene here, then:
//     this.canvas.start();
//   }
//
//   ngOnDestroy() {
//     this.canvas.dispose();
//   }
// ─────────────────────────────────────────────────────────────────────────────

import { Injectable, NgZone } from '@angular/core';
import * as THREE from 'three';
import { gsap } from 'gsap';

export interface CanvasContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
}

@Injectable() // ← NOT providedIn: 'root' — each component gets its OWN instance
export class ThreeCanvasService {

  // ── Internal state ─────────────────────────────────────────────────────────
  private _scene!: THREE.Scene;
  private _camera!: THREE.PerspectiveCamera;
  private _renderer!: THREE.WebGLRenderer;
  private _container!: HTMLElement;

  private _resizeObserver!: ResizeObserver;
  private _gsapTicker!: gsap.TickerCallback;
  private _contextLostHandler!: (e: Event) => void;
  private _contextRestoredHandler!: (e: Event) => void;

  private _isRunning = false;
  private _isContextLost = false;
  /** Per-frame scene update hook — registered by the host component. */
  private _updateCallback?: (delta: number) => void;

  constructor(private readonly ngZone: NgZone) { }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Initialize the Three.js renderer and attach it to the given DOM container.
   * Returns the core context so the calling component can populate the scene.
   *
   * @param container   - The host HTMLElement that will contain the <canvas>
   * @param fov         - Camera field of view in degrees (default: 60)
   * @param near        - Camera near clipping plane (default: 0.1)
   * @param far         - Camera far clipping plane (default: 1000)
   */
  init(
    container: HTMLElement,
    fov = 60,
    near = 0.1,
    far = 1000
  ): CanvasContext {
    return this.ngZone.runOutsideAngular(() => {
      this._container = container;
      const rect = container.getBoundingClientRect();
      const width = rect.width || window.innerWidth;
      const height = rect.height || window.innerHeight;

      // ── Scene ───────────────────────────────────────────────────────────────
      this._scene = new THREE.Scene();

      // ── Camera ──────────────────────────────────────────────────────────────
      this._camera = new THREE.PerspectiveCamera(fov, width / height, near, far);
      this._camera.position.set(0, 0, 5);

      // ── Renderer ─────────────────────────────────────────────────────────────
      this._renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,            // transparent background (overlay on CSS bg)
        powerPreference: 'high-performance',
      });
      this._renderer.setSize(width, height);
      this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // cap at 2x for perf
      this._renderer.outputColorSpace = THREE.SRGBColorSpace;
      this._renderer.shadowMap.enabled = true;
      this._renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      container.appendChild(this._renderer.domElement);

      // ── WebGL context loss/restore ────────────────────────────────────────
      this._setupContextHandlers();

      // ── Resize observer ───────────────────────────────────────────────────
      this._setupResizeObserver();

      return { scene: this._scene, camera: this._camera, renderer: this._renderer };
    });
  }

  /**
   * Start the render loop by adding a tick callback to GSAP's global ticker.
   * This replaces `requestAnimationFrame` and ensures Three.js renders are
   * perfectly synchronized with all GSAP animations in the same frame.
   *
   * IMPORTANT: Run OUTSIDE Angular's zone to prevent unnecessary
   * change-detection cycles on every animation frame.
   */
  /**
   * Start the render loop.
   *
   * @param updateCb - Optional per-frame callback (e.g. scene.update). Receives
   *                   the elapsed time delta in seconds. Runs outside Angular zone.
   */
  start(updateCb?: (delta: number) => void): void {
    if (this._isRunning) return;
    this._isRunning = true;
    if (updateCb) this._updateCallback = updateCb;

    // Run outside Angular zone — Three.js render loop must NEVER trigger CD
    this.ngZone.runOutsideAngular(() => {
      let lastTime = 0;
      this._gsapTicker = (time: number) => {
        if (this._isContextLost) return;
        const delta = lastTime > 0 ? time - lastTime : 0;
        lastTime = time;
        this._updateCallback?.(delta);
        this._renderer.render(this._scene, this._camera);
      };
      gsap.ticker.add(this._gsapTicker);
    });
  }

  /**
   * Pause the render loop (e.g. when component is hidden, tab is backgrounded).
   * Automatically resumes on the next `start()` call.
   */
  pause(): void {
    if (!this._isRunning) return;
    gsap.ticker.remove(this._gsapTicker);
    this._isRunning = false;
  }

  /**
   * Full cleanup — call this in `ngOnDestroy()` of the host component.
   * Stops the ticker, disconnects observers, and walks the scene graph
   * to dispose every geometry, material, and texture from GPU memory.
   */
  dispose(): void {
    // 1. Stop the render loop
    this.pause();

    // 2. Disconnect ResizeObserver
    this._resizeObserver?.disconnect();

    // 3. Remove WebGL context event listeners
    const canvas = this._renderer?.domElement;
    if (canvas) {
      canvas.removeEventListener('webglcontextlost', this._contextLostHandler);
      canvas.removeEventListener('webglcontextrestored', this._contextRestoredHandler);
    }

    // 4. Walk the scene graph and free GPU memory
    this._scene?.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        this._disposeMesh(object);
      }
    });

    // 5. Dispose renderer (releases WebGL context)
    this._renderer?.dispose();

    // 6. Remove canvas DOM node from container
    if (canvas && canvas.parentNode) {
      canvas.parentNode.removeChild(canvas);
    }
  }

  /**
   * Utility: dispose a single mesh (geometry + all materials + all textures).
   * Useful when dynamically swapping models within a scene.
   */
  disposeMesh(mesh: THREE.Mesh): void {
    this._disposeMesh(mesh);
  }

  /**
   * Expose the renderer for cases where a scene needs direct renderer access
   * (e.g. encoding tone mapping, shadow map updates).
   */
  get renderer(): THREE.WebGLRenderer {
    return this._renderer;
  }

  get scene(): THREE.Scene {
    return this._scene;
  }

  get camera(): THREE.PerspectiveCamera {
    return this._camera;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * ResizeObserver fires whenever the *container* element changes size —
   * this is more accurate than `window.resize` which fires too broadly
   * and doesn't account for CSS transforms or flex layout changes.
   */
  private _setupResizeObserver(): void {
    this._resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width === 0 || height === 0) return; // avoid degenerate updates

        this._camera.aspect = width / height;
        this._camera.updateProjectionMatrix();
        this._renderer.setSize(width, height);
        // Re-clamp pixel ratio in case user moved to a different display
        this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      }
    });
    this._resizeObserver.observe(this._container);
  }

  /**
   * WebGL context loss is common on mobile when the OS reclaims GPU resources
   * (e.g. switching to the camera app). We pause rendering on loss and
   * automatically restart on restore.
   */
  private _setupContextHandlers(): void {
    const canvas = this._renderer.domElement;

    this._contextLostHandler = (e: Event) => {
      e.preventDefault(); // required to allow context restoration
      this._isContextLost = true;
      console.warn('[ThreeCanvasService] WebGL context lost — pausing render loop.');
    };

    this._contextRestoredHandler = () => {
      this._isContextLost = false;
      console.info('[ThreeCanvasService] WebGL context restored — resuming render loop.');
    };

    canvas.addEventListener('webglcontextlost', this._contextLostHandler, false);
    canvas.addEventListener('webglcontextrestored', this._contextRestoredHandler, false);
  }

  /** Dispose geometry + all material maps for a single mesh */
  private _disposeMesh(mesh: THREE.Mesh): void {
    mesh.geometry?.dispose();

    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];

    for (const material of materials) {
      // Dispose all texture maps found on the material
      for (const key of Object.keys(material)) {
        const value = (material as unknown as Record<string, unknown>)[key];
        if (value instanceof THREE.Texture) {
          value.dispose();
        }
      }
      material.dispose();
    }
  }
}
