// Particle system for visual effects
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  type: 'spark' | 'trail' | 'explosion' | 'food';
}

export class ParticleSystem {
  particles: Particle[] = [];
  private maxParticles = 200;

  emit(x: number, y: number, type: Particle['type'], count: number = 10) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) {
        this.particles.shift();
      }

      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = type === 'explosion' ? 2 + Math.random() * 4 : 1 + Math.random() * 2;

      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        maxLife: type === 'explosion' ? 30 : type === 'food' ? 40 : 20,
        size: type === 'explosion' ? 3 + Math.random() * 3 : 2 + Math.random() * 2,
        color: this.getColor(type),
        type,
      });
    }
  }

  private getColor(type: Particle['type']): string {
    switch (type) {
      case 'spark': return '#86c06c';
      case 'trail': return '#4ade80';
      case 'explosion': return '#ff4444';
      case 'food': return '#ffd700';
    }
  }

  update() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.95;
      p.vy *= 0.95;
      p.life -= 1 / p.maxLife;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      ctx.restore();
    }
  }

  clear() {
    this.particles = [];
  }
}

// Screen shake effect
export class ScreenShake {
  intensity = 0;
  decay = 0.9;
  offsetX = 0;
  offsetY = 0;

  trigger(intensity: number = 5) {
    this.intensity = intensity;
  }

  update() {
    if (this.intensity > 0.1) {
      this.offsetX = (Math.random() - 0.5) * this.intensity * 2;
      this.offsetY = (Math.random() - 0.5) * this.intensity * 2;
      this.intensity *= this.decay;
    } else {
      this.offsetX = 0;
      this.offsetY = 0;
      this.intensity = 0;
    }
  }
}

// Bloom effect using multiple canvas layers
export class BloomEffect {
  private bloomCanvas: HTMLCanvasElement;
  private bloomCtx: CanvasRenderingContext2D;

  constructor() {
    this.bloomCanvas = document.createElement('canvas');
    this.bloomCtx = this.bloomCanvas.getContext('2d')!;
  }

  resize(width: number, height: number) {
    this.bloomCanvas.width = width / 2;
    this.bloomCanvas.height = height / 2;
  }

  apply(ctx: CanvasRenderingContext2D, sourceCanvas: HTMLCanvasElement, intensity: number = 0.5) {
    // Downscale
    this.bloomCtx.drawImage(sourceCanvas, 0, 0, this.bloomCanvas.width, this.bloomCanvas.height);

    // Apply blur by drawing multiple times with offset
    this.bloomCtx.globalAlpha = intensity;
    this.bloomCtx.filter = 'blur(4px)';
    this.bloomCtx.drawImage(this.bloomCanvas, 0, 0);
    this.bloomCtx.filter = 'none';
    this.bloomCtx.globalAlpha = 1;

    // Composite back
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.6;
    ctx.drawImage(this.bloomCanvas, 0, 0, sourceCanvas.width, sourceCanvas.height);
    ctx.restore();
  }
}

// Lerp utility for smooth interpolation
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Smooth step for easing
export function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}
