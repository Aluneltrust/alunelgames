import { useEffect, useRef, useCallback } from 'react';

export function InteractiveBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: -1000, y: -1000 });
  const particles = useRef<Particle[]>([]);
  const animFrame = useRef(0);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    mouse.current = { x: e.clientX, y: e.clientY };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', handleMouseMove);

    // Create particles
    const count = Math.floor((window.innerWidth * window.innerHeight) / 12000);
    particles.current = Array.from({ length: count }, () => new Particle(canvas.width, canvas.height));

    const isDark = () => document.documentElement.classList.contains('dark');

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const dark = isDark();
      const mx = mouse.current.x;
      const my = mouse.current.y;

      for (const p of particles.current) {
        p.update(canvas.width, canvas.height, mx, my);
        p.draw(ctx, dark);
      }

      // Draw connections
      const pts = particles.current;
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x;
          const dy = pts[i].y - pts[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            const alpha = (1 - dist / 120) * (dark ? 0.15 : 0.08);
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.strokeStyle = dark
              ? `rgba(129, 140, 248, ${alpha})`
              : `rgba(99, 102, 241, ${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // Mouse glow
      if (mx > 0 && my > 0) {
        const gradient = ctx.createRadialGradient(mx, my, 0, mx, my, 100);
        if (dark) {
          gradient.addColorStop(0, 'rgba(99, 102, 241, 0.03)');
          gradient.addColorStop(1, 'rgba(99, 102, 241, 0)');
        } else {
          gradient.addColorStop(0, 'rgba(99, 102, 241, 0.02)');
          gradient.addColorStop(1, 'rgba(99, 102, 241, 0)');
        }
        ctx.fillStyle = gradient;
        ctx.fillRect(mx - 100, my - 100, 200, 200);
      }

      animFrame.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(animFrame.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [handleMouseMove]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 pointer-events-none"
    />
  );
}

class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  baseAlpha: number;

  constructor(w: number, h: number) {
    this.x = Math.random() * w;
    this.y = Math.random() * h;
    this.vx = (Math.random() - 0.5) * 0.3;
    this.vy = (Math.random() - 0.5) * 0.3;
    this.size = Math.random() * 1.5 + 0.5;
    this.baseAlpha = Math.random() * 0.5 + 0.2;
  }

  update(w: number, h: number, mx: number, my: number) {
    // Mouse repulsion
    const dx = this.x - mx;
    const dy = this.y - my;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 150) {
      const force = (150 - dist) / 150 * 0.02;
      this.vx += (dx / dist) * force;
      this.vy += (dy / dist) * force;
    }

    // Damping
    this.vx *= 0.99;
    this.vy *= 0.99;

    this.x += this.vx;
    this.y += this.vy;

    // Wrap edges
    if (this.x < 0) this.x = w;
    if (this.x > w) this.x = 0;
    if (this.y < 0) this.y = h;
    if (this.y > h) this.y = 0;
  }

  draw(ctx: CanvasRenderingContext2D, dark: boolean) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = dark
      ? `rgba(165, 180, 252, ${this.baseAlpha * 0.4})`
      : `rgba(99, 102, 241, ${this.baseAlpha * 0.25})`;
    ctx.fill();
  }
}
