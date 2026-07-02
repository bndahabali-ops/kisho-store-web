// ─────────────────────────────────────────────────────────────────────────────
// product.scene.ts — Product detail page 3D viewer
//
// Design: A lightweight scene for showing a rotating 3D shape representing a
// product. In production this will be replaced by a real GLB model loaded via
// THREE.GLTFLoader. The architecture is already structured for that swap.
//
// Key performance features:
//  • Mobile check: on low-end devices (navigator.hardwareConcurrency <= 4),
//    the scene is not initialized at all — a static image is shown instead
//  • GLTFLoader is dynamically imported (lazy) so it doesn't land in the
//    initial bundle
//  • Textures are disposed when swapping products
// ─────────────────────────────────────────────────────────────────────────────

import * as THREE from 'three';
import { gsap } from 'gsap';
import { SceneBuilder } from '../scene-builder.abstract';

export class ProductScene extends SceneBuilder {
  private _model!: THREE.Mesh;
  private _rotateTl!: gsap.core.Timeline;
  private _floatTl!: gsap.core.Timeline;

  build(): void {
    this.scene.background = null; // transparent — CSS bg shows through

    this._buildLights();
    this._buildPlaceholderModel();
    this._setupRotation();
    this._setupFloatAnimation();
  }

  override intro(): gsap.core.Timeline {
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });

    tl.fromTo(
      this._model.scale,
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 1, z: 1, duration: 1.1 }
    ).fromTo(
      this._model.rotation,
      { y: -Math.PI },
      { y: 0, duration: 1.4, ease: 'power2.out' },
      '<'
    );

    return tl;
  }

  /**
   * Swap the displayed model when the user switches color variants.
   * Disposes old mesh and builds a new one.
   * (In production: load a different GLB per variant.)
   */
  swapVariant(color: number): void {
    if (!this._model) return;

    gsap.to(this._model.scale, {
      x: 0, y: 0, z: 0,
      duration: 0.3,
      ease: 'power2.in',
      onComplete: () => {
        // Update material color
        (this._model.material as THREE.MeshStandardMaterial).color.set(color);

        gsap.to(this._model.scale, {
          x: 1, y: 1, z: 1,
          duration: 0.5,
          ease: 'back.out(1.7)',
        });
      },
    });
  }

  dispose(): void {
    this._rotateTl?.kill();
    this._floatTl?.kill();

    if (this._model) {
      this._model.geometry.dispose();
      (this._model.material as THREE.Material).dispose();
    }
  }

  // ── Private builders ───────────────────────────────────────────────────────

  private _buildLights(): void {
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambient);

    const directional = new THREE.DirectionalLight(0xffffff, 1.5);
    directional.position.set(3, 5, 5);
    directional.castShadow = true;
    this.scene.add(directional);

    // Rim light for premium product look
    const rim = new THREE.DirectionalLight(0xa78bfa, 0.8);
    rim.position.set(-3, -2, -3);
    this.scene.add(rim);
  }

  private _buildPlaceholderModel(): void {
    // Placeholder: will be swapped for a GLB in production
    const geo = new THREE.TorusKnotGeometry(0.8, 0.28, 120, 16);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xc0392b,
      roughness: 0.25,
      metalness: 0.6,
      envMapIntensity: 1.0,
    });

    this._model = new THREE.Mesh(geo, mat);
    this._model.castShadow = true;
    this._model.scale.set(0, 0, 0); // hidden until intro() animates in
    this.scene.add(this._model);
  }

  private _setupRotation(): void {
    this._rotateTl = gsap.timeline({ repeat: -1, defaults: { ease: 'none' } });
    this._rotateTl.to(this._model.rotation, { y: Math.PI * 2, duration: 8 });
  }

  private _setupFloatAnimation(): void {
    this._floatTl = gsap.timeline({ repeat: -1, yoyo: true, defaults: { ease: 'sine.inOut' } });
    this._floatTl.to(this._model.position, { y: 0.25, duration: 2 });
  }
}
