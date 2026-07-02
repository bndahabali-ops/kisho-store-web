// ─────────────────────────────────────────────────────────────────────────────
// hero.scene.ts — Conflict-free floating 3D sculpture
//
// CRITICAL DESIGN RULE: GSAP tweens and the per-frame update() method must
// NEVER write to the same Three.js property simultaneously, or you get
// frame-by-frame fighting that looks like flickering / jitter.
//
// Solution:
//   - Floating Y animation: pure sine wave calculated in update() from
//     elapsed time — zero GSAP involvement, zero conflict.
//   - Scroll-driven position: HomeComponent scroll triggers write to
//     _scrollBaseX / _scrollBaseY / _scrollScale (public setters).
//     update() combines them with the float offset each frame.
//   - Mouse parallax: only touches camera.position.x/y. Scroll triggers
//     only touch camera.position.z. No overlap.
// ─────────────────────────────────────────────────────────────────────────────

import * as THREE from 'three';
import { gsap } from 'gsap';
import { SceneBuilder } from '../scene-builder.abstract';

export class HeroScene extends SceneBuilder {
  public mainSculpture!: THREE.Group;

  private _outerRing!: THREE.Mesh;
  private _innerGeo!: THREE.Mesh;
  private _particles!: THREE.Points;

  // Smooth mouse lerp targets
  private _mouseX = 0;
  private _mouseY = 0;
  private _targetMouseX = 0;
  private _targetMouseY = 0;
  private _mouseMoveHandler!: (e: MouseEvent) => void;

  // Elapsed time for sine-wave float (seconds)
  private _elapsed = 0;
  // Flag: pause float during intro so it doesn't fight scale-in tween
  private _floatActive = false;

  // Scroll-driven base offsets — written by HomeComponent scroll triggers
  public scrollBaseX = 0;
  public scrollBaseY = 0;
  public scrollScale = 1;

  private _introTl!: gsap.core.Timeline;

  // ── Public API ──────────────────────────────────────────────────────────────

  build(): void {
    this.mainSculpture = new THREE.Group();
    this.scene.add(this.mainSculpture);

    this._buildLights();
    this._buildParticles();
    this._buildSculpture();
    this._setupMouseParallax();
    this._adjustCameraForViewport();
  }

  override intro(): gsap.core.Timeline {
    this._introTl = gsap.timeline({ defaults: { ease: 'expo.out' } });

    // Start off-scale — reveal elegantly
    this.mainSculpture.scale.set(0, 0, 0);
    this.mainSculpture.rotation.y = 0.8;
    this.scrollScale = 1;

    this._introTl
      .to(this.mainSculpture.scale, { x: 1, y: 1, z: 1, duration: 1.8 }, 0.4)
      .to(this.mainSculpture.rotation, { y: 0, duration: 2.0, ease: 'power3.out' }, 0.4)
      .fromTo(
        (this._particles.material as THREE.PointsMaterial),
        { opacity: 0 },
        { opacity: 0.35, duration: 1.5 },
        0.8
      )
      // Enable float only after intro scale finishes — avoids tween conflict
      .add(() => { this._floatActive = true; }, 2.2);

    return this._introTl;
  }

  override update(delta: number): void {
    // Accumulate elapsed time (delta is seconds from ThreeCanvasService ticker)
    this._elapsed += delta;

    // ── Sine-wave float (zero GSAP — no conflict with scroll tweens) ──────────
    const floatY = this._floatActive
      ? Math.sin(this._elapsed * 0.55) * 0.10
      : 0;
    const floatZ = this._floatActive
      ? Math.sin(this._elapsed * 0.35) * 0.03
      : 0;

    // Apply: scroll base + float offset
    this.mainSculpture.position.x = this.scrollBaseX;
    this.mainSculpture.position.y = this.scrollBaseY + floatY;
    this.mainSculpture.position.z = floatZ;

    // Scale is driven entirely by scroll — apply directly
    const s = this.scrollScale;
    this.mainSculpture.scale.set(s, s, s);

    // ── Smooth mouse camera parallax — only touches X/Y, scroll touches Z ─────
    this._mouseX += (this._targetMouseX - this._mouseX) * 0.03;
    this._mouseY += (this._targetMouseY - this._mouseY) * 0.03;
    this.camera.position.x += (this._mouseX * 0.3 - this.camera.position.x) * 0.04;
    this.camera.position.y += (this._mouseY * 0.2 - this.camera.position.y) * 0.04;
    this.camera.lookAt(0, 0, 0);

    // ── Continuous ring & particle drift (rotation only — no conflict) ────────
    if (this._outerRing) {
      this._outerRing.rotation.y -= 0.003;
      this._outerRing.rotation.x += 0.001;
    }
    if (this._particles) {
      this._particles.rotation.y += 0.0001;
    }
    if (this._innerGeo) {
      this._innerGeo.rotation.y += 0.004;
    }
  }

  dispose(): void {
    window.removeEventListener('mousemove', this._mouseMoveHandler);
    this._introTl?.kill();
    this._floatActive = false;

    if (this._particles) {
      this._particles.geometry.dispose();
      (this._particles.material as THREE.Material).dispose();
    }

    this.mainSculpture?.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach(m => m.dispose());
      }
    });
  }

  // ── Private builders ────────────────────────────────────────────────────────

  private _buildLights(): void {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.08));

    const key = new THREE.DirectionalLight(0xffffff, 3.0);
    key.position.set(4, 6, 5);
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0xe8eaed, 0.8);
    fill.position.set(-5, -2, 3);
    this.scene.add(fill);

    const back = new THREE.DirectionalLight(0xffffff, 1.2);
    back.position.set(0, 4, -6);
    this.scene.add(back);
  }

  private _buildParticles(): void {
    const count = 300;
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const r = 3.5 + Math.random() * 2.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.016,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0,
    });

    this._particles = new THREE.Points(geo, mat);
    this.scene.add(this._particles);
  }

  private _buildSculpture(): void {
    // Core octahedron — flat-shaded chrome facets
    const octGeo = new THREE.OctahedronGeometry(0.75, 0);
    const octMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 1.0,
      roughness: 0.04,
      flatShading: true,
    });
    this._innerGeo = new THREE.Mesh(octGeo, octMat);
    this.mainSculpture.add(this._innerGeo);

    // Outer gyroscope ring
    const ringGeo = new THREE.TorusGeometry(1.35, 0.018, 16, 100);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xd0d0d0,
      metalness: 0.95,
      roughness: 0.08,
    });
    this._outerRing = new THREE.Mesh(ringGeo, ringMat);
    this._outerRing.rotation.x = Math.PI / 2.5;
    this.mainSculpture.add(this._outerRing);

    // Second thinner ring
    const ring2Geo = new THREE.TorusGeometry(1.0, 0.010, 12, 80);
    const ring2Mat = new THREE.MeshStandardMaterial({
      color: 0xaaaaaa,
      metalness: 0.9,
      roughness: 0.12,
    });
    const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
    ring2.rotation.z = Math.PI / 3;
    this.mainSculpture.add(ring2);
  }

  private _adjustCameraForViewport(): void {
    const isMobile = window.innerWidth < 768;
    this.camera.fov = isMobile ? 70 : 60;
    this.camera.position.set(0, 0, isMobile ? 5.5 : 4.5);
    this.camera.updateProjectionMatrix();
  }

  private _setupMouseParallax(): void {
    this._mouseMoveHandler = (e: MouseEvent) => {
      this._targetMouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      this._targetMouseY = -(e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('mousemove', this._mouseMoveHandler, { passive: true });
  }
}
