import * as THREE from 'three';
import { CanvasContext } from './three-canvas.service';
import { gsap } from 'gsap';

export abstract class SceneBuilder {
  public scene!: THREE.Scene;
  public camera!: THREE.PerspectiveCamera;
  public renderer!: THREE.WebGLRenderer;

  attach(ctx: CanvasContext): void {
    this.scene    = ctx.scene;
    this.camera   = ctx.camera;
    this.renderer = ctx.renderer;
  }

  abstract build(): void;
  abstract intro(): gsap.core.Timeline;
  abstract dispose(): void;
  update(_delta: number): void {}
}
