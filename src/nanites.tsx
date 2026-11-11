'use client';

import { useEffect, useRef } from 'react';

type Burst = { x: number; y: number; at: number; cell: string };
type Particle = { x: number; y: number; dx: number; dy: number; phase: number; px: number; py: number; vx: number; vy: number; sx: number; sy: number; width: number; height: number };
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };

// Smooth, seeded fluctuations give each atom an irregular path without jitter.
const drift = (time: number, seed: number) => {
  const cell = Math.floor(time);
  const hash = (value: number) => {
    const n = Math.sin(value * 127.1 + seed * 311.7) * 43758.5453;
    return (n - Math.floor(n)) * 2 - 1;
  };
  return hash(cell) + (hash(cell + 1) - hash(cell)) * smooth(time - cell);
};

export type NanitesProps = {
  /** Transparent, same-origin artwork works best. */
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  disabled?: boolean;
};

export function Nanites({ src, alt, width, height, className = '', disabled = false }: NanitesProps) {
  const linkRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const link = linkRef.current;
    const logo = imageRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!link || !logo || !canvas || !context || disabled) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const hover = window.matchMedia('(hover: hover) and (pointer: fine)');
    let particles: Particle[] = [];
    let edges: [number, number][] = [];
    let width = 0;
    let height = 0;
    let dot = 1.4;
    let frame = 0;
    let running = false;
    let near = false;
    let dirty = true;
    let bursts: Burst[] = [];
    let lastPointer: { x: number; y: number } | null = null;
    let radius = 80;
    let artwork = { x: 0, y: 0, width: 0, height: 0 };
    let solid: HTMLCanvasElement | null = null;
    let pixelRatio = 1;
    let lastDraw = 0;

    const reset = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      running = false;
      bursts = [];
      for (const p of particles) { p.px = p.x; p.py = p.y; p.vx = 0; p.vy = 0; }
      lastPointer = null;
      logo.style.opacity = '';
      canvas.style.opacity = '0';
      context.clearRect(0, 0, width, height);
    };
    const prepare = () => {
      if (!near || motion.matches || !hover.matches || !logo.complete || !logo.naturalWidth) return;
      reset();
      const bounds = link.getBoundingClientRect();
      const art = logo.getBoundingClientRect();
      width = bounds.width;
      height = bounds.height;
      artwork = { x: art.left - bounds.left, y: art.top - bounds.top, width: art.width, height: art.height };
      radius = Math.max(48, Math.min(90, width * 0.085));
      if (!width || !art.height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      pixelRatio = dpr;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      const sample = document.createElement('canvas');
      sample.width = Math.min(1000, Math.round(art.width));
      sample.height = Math.max(1, Math.round(sample.width * art.height / art.width));
      const pixels = sample.getContext('2d', { willReadFrequently: true });
      if (!pixels) return;
      try {
        solid = document.createElement('canvas');
        solid.width = Math.round(art.width * dpr);
        solid.height = Math.round(art.height * dpr);
        const solidContext = solid.getContext('2d');
        if (!solidContext) return;
        solidContext.drawImage(logo, 0, 0, solid.width, solid.height);
        pixels.drawImage(logo, 0, 0, sample.width, sample.height);
        const data = pixels.getImageData(0, 0, sample.width, sample.height).data;
        const scale = art.width / sample.width;
        const scaleY = art.height / sample.height;
        const step = Math.max(3, Math.ceil(Math.sqrt(sample.width * sample.height / 8000)));
        dot = Math.max(1, step * scale * 0.3);
        particles = [];
        edges = [];
        const cells = new Map<string, number>();
        for (let y = 0; y < sample.height; y += step) {
          for (let x = 0; x < sample.width; x += step) {
            const tileWidth = Math.min(step, sample.width - x);
            const tileHeight = Math.min(step, sample.height - y);
            // Retain every fragment containing ink, including antialiased edges.
            let ink = false;
            for (let ty = y; ty < y + tileHeight && !ink; ty++) {
              for (let tx = x; tx < x + tileWidth; tx++) {
                if (data[(ty * sample.width + tx) * 4 + 3] > 4) { ink = true; break; }
              }
            }
            if (!ink) continue;
            const px = (x + tileWidth / 2) * scale + artwork.x;
            const py = (y + tileHeight / 2) * scaleY + artwork.y;
            const angle = Math.random() * Math.PI * 2;
            const distance = (18 + Math.random() * 65) * Math.min(1, width / 900);
            const dx = Math.max(6, Math.min(width - 6, px + Math.cos(angle) * distance)) - px;
            const dy = Math.max(6, Math.min(height - 6, py + Math.sin(angle) * distance)) - py;
            const index = particles.length;
            particles.push({ x: px, y: py, px, py, vx: 0, vy: 0, dx, dy, phase: Math.random() * Math.PI * 2,
              sx: x * scale, sy: y * scaleY, width: tileWidth * scale, height: tileHeight * scaleY });
            const previous = cells.get(`${x - step},${y}`) ?? cells.get(`${x},${y - step}`);
            if (previous !== undefined && index % 6 === 0) edges.push([previous, index]);
            cells.set(`${x},${y}`, index);
          }
        }
        dirty = false;
      } catch {
        particles = [];
        reset();
      }
    };
    const draw = (now: number) => {
      bursts = bursts.filter((burst) => now - burst.at < 3600);
      if (!bursts.length || motion.matches || document.hidden) { reset(); return; }
      const dt = Math.min(1 / 30, Math.max(1 / 240, (now - lastDraw) / 1000));
      lastDraw = now;
      const regions = bursts.map((burst) => {
        const elapsed = now - burst.at;
        return {
          ...burst,
          elapsed,
          spread: 1 - Math.pow(1 - clamp(elapsed / 750), 3),
          dissolve: smooth(elapsed / 220) * (1 - smooth((elapsed - 3160) / 440)),
        };
      });
      context.clearRect(0, 0, width, height);
      // Move fragments of the artwork itself; no circular eraser or backdrop.
      const positions = particles.map((p) => {
        let amount = 0, alpha = 0, elapsed = 0, repairProgress = 0;
        for (const region of regions) {
          const deltaX = p.x - region.x, deltaY = p.y - region.y;
          if (Math.abs(deltaX) >= radius || Math.abs(deltaY) >= radius) continue;
          const distance = Math.hypot(deltaX, deltaY);
          const organicRadius = radius * (0.8 + 0.2 * Math.sin(p.phase));
          const influence = 1 - smooth((distance / organicRadius - 0.35) / 0.65);
          const weight = influence * region.dissolve;
          if (weight <= alpha) continue;
          alpha = weight;
          // One uninterrupted pull per hovered patch. Organic variation stays
          // in the trajectory, not in delayed starts or pauses before docking.
          repairProgress = clamp((region.elapsed - 1800) / 1050);
          const pull = Math.pow(smooth(repairProgress), 0.8);
          amount = influence * region.spread * (1 - pull);
          elapsed = region.elapsed;
        }
        if (alpha === 0) {
          p.px = p.x; p.py = p.y; p.vx = 0; p.vy = 0;
          return { x: p.x, y: p.y, alpha, amount };
        }
        const time = now / 1000;
        // Neighboring atoms share a slowly turning field, with independent drift.
        const flow = Math.sin(p.x / 120 + time * 0.65) + Math.cos(p.y / 85 - time * 0.48);
        const turn = flow * 0.55 + elapsed / 2400;
        const curlX = Math.cos(turn) * p.dx - Math.sin(turn) * p.dy;
        const curlY = Math.sin(turn) * p.dx + Math.cos(turn) * p.dy;
        // Small, irregular course corrections read as cells seeking attachment.
        // They fade out before docking so the final seal remains steady.
        const searching = smooth(repairProgress / 0.12) * (1 - smooth((repairProgress - 0.45) / 0.35));
        const correctionX = drift(time * 6, p.phase + 23) * 5 * searching;
        const correctionY = drift(time * 5.3, p.phase + 47) * 5 * searching;
        const targetX = p.x + (curlX + drift(time * 0.8, p.phase) * 14 + correctionX) * amount;
        const targetY = p.y + (curlY + drift(time * 0.7, p.phase + 10) * 14 + correctionY) * amount;
        {
          // A damped spring carries momentum through the eddies and into reassembly.
          const settling = 1 - smooth(amount / 0.15);
          // Increase attraction gently during repair, without a hard snap or bounce.
          const repair = smooth(repairProgress / 0.2);
          const stiffness = 45 + 50 * settling + 50 * repair;
          const damping = Math.exp(-(10 + 9 * settling + 4 * repair) * dt);
          p.vx = (p.vx + (targetX - p.px) * stiffness * dt) * damping;
          p.vy = (p.vy + (targetY - p.py) * stiffness * dt) * damping;
          p.px += p.vx * dt;
          p.py += p.vy * dt;
        }
        // Ease residual spring travel to zero before this patch expires.
        const settle = 1 - smooth((elapsed - 3000) / 600);
        return { x: p.x + (p.px - p.x) * settle, y: p.y + (p.py - p.y) * settle, alpha, amount };
      });
      context.lineWidth = 0.65;
      for (const [a, b] of edges) {
        const p = positions[a], q = positions[b];
        if (p.alpha < 0.01 || q.alpha < 0.01 || Math.hypot(p.x - q.x, p.y - q.y) > 65) continue;
        context.strokeStyle = `rgba(180,198,235,${0.22 * Math.min(p.alpha, q.alpha, p.amount, q.amount)})`;
        context.beginPath();
        context.moveTo(p.x, p.y); context.lineTo(q.x, q.y);
        context.stroke();
      }
      positions.forEach((p, index) => {
        const tile = particles[index];
        const atom = smooth(p.amount / 0.55) * p.alpha;
        const fragmentScale = 1 - atom * 0.55;
        context.globalAlpha = 1 - atom;
        // Round each source fragment before it travels; let it merge back into
        // the continuous artwork only when it is almost exactly home.
        const travel = Math.hypot(p.x - tile.x, p.y - tile.y);
        const roundness = Math.max(smooth(atom / 0.12), smooth(travel / 1.5));
        const clipped = roundness > 0.0001;
        if (clipped) {
          const coverRadius = Math.hypot(tile.width, tile.height) / 2;
          const radius = (coverRadius + (dot - coverRadius) * roundness) * fragmentScale;
          context.save();
          context.beginPath();
          context.arc(p.x, p.y, radius, 0, Math.PI * 2);
          context.clip();
        }
        if (solid) context.drawImage(
          solid,
          tile.sx * pixelRatio, tile.sy * pixelRatio, tile.width * pixelRatio, tile.height * pixelRatio,
          p.x - tile.width * fragmentScale / 2, p.y - tile.height * fragmentScale / 2,
          tile.width * fragmentScale, tile.height * fragmentScale,
        );
        if (clipped) context.restore();
        if (atom < 0.01) return;
        context.globalAlpha = atom;
        context.fillStyle = index % 19 === 0 ? '#86a2ff' : '#f5f5f5';
        context.beginPath();
        context.arc(p.x, p.y, dot, 0, Math.PI * 2);
        context.fill();
      });
      context.globalAlpha = 1;
      // Blend the exact SVG over the settled fragments before the DOM handoff,
      // avoiding a one-frame change in tile-edge antialiasing.
      const youngest = Math.min(...regions.map((region) => region.elapsed));
      const handoff = smooth((youngest - 3320) / 280);
      if (handoff > 0) {
        context.globalAlpha = handoff;
        context.drawImage(logo, artwork.x, artwork.y, artwork.width, artwork.height);
        context.globalAlpha = 1;
      }
      // Only swap after the full solid remainder and local particles are painted.
      logo.style.opacity = '0';
      canvas.style.opacity = '1';
      frame = requestAnimationFrame(draw);
    };
    const enter = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || motion.matches || !hover.matches) return;
      near = true;
      if (dirty) prepare();
      if (!particles.length) return;
      const bounds = link.getBoundingClientRect();
      const now = performance.now();
      bursts = bursts.filter((burst) => now - burst.at < 3600);
      const occupied = new Set(bursts.map((burst) => burst.cell));
      const spacing = radius * 0.4;
      const samples = [...(event.getCoalescedEvents?.() ?? []), event];
      for (const sample of samples) {
        const point = { x: sample.clientX - bounds.left, y: sample.clientY - bounds.top };
        const from = lastPointer ?? point;
        const distance = Math.hypot(point.x - from.x, point.y - from.y);
        const steps = Math.max(1, Math.ceil(distance / spacing));
        // Fill sparse pointer events along the entire swept path. Deduplicate
        // by spatial cell, so repeated passes cost no extra active regions.
        for (let step = 1; step <= steps; step++) {
          const x = from.x + (point.x - from.x) * step / steps;
          const y = from.y + (point.y - from.y) * step / steps;
          if (x < 0 || x > width || y < 0 || y > height) continue;
          const cell = `${Math.floor(x / spacing)},${Math.floor(y / spacing)}`;
          if (occupied.has(cell)) continue;
          if (!particles.some((p) => Math.hypot(p.x - x, p.y - y) < radius * 0.65)) continue;
          bursts.push({ x, y, at: now, cell });
          occupied.add(cell);
        }
        lastPointer = point;
      }
      if (!bursts.length) return;
      if (!running) {
        running = true;
        lastDraw = performance.now();
        frame = requestAnimationFrame(draw);
      }
    };
    const leave = () => { lastPointer = null; };
    const invalidate = () => { dirty = true; reset(); if (near) prepare(); };
    const visibility = () => { if (document.hidden) reset(); };
    const observer = new IntersectionObserver(([entry]) => {
      near = entry.isIntersecting;
      if (!near) reset();
      else if (dirty) prepare();
    }, { rootMargin: '150px' });
    const resize = new ResizeObserver(invalidate);
    observer.observe(link);
    resize.observe(link);
    logo.addEventListener('load', invalidate);
    link.addEventListener('pointerenter', enter);
    link.addEventListener('pointermove', enter);
    link.addEventListener('pointerleave', leave);
    motion.addEventListener('change', invalidate);
    hover.addEventListener('change', invalidate);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      reset();
      observer.disconnect(); resize.disconnect();
      logo.removeEventListener('load', invalidate);
      link.removeEventListener('pointerenter', enter);
      link.removeEventListener('pointermove', enter);
      link.removeEventListener('pointerleave', leave);
      motion.removeEventListener('change', invalidate);
      hover.removeEventListener('change', invalidate);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [src, width, height, disabled]);

  return (
    <div ref={linkRef} className={`nanites ${className}`}>
      <img ref={imageRef} src={src} width={width} height={height} alt={alt} decoding="async" />
      <canvas ref={canvasRef} className="nanites-canvas" aria-hidden="true" />
    </div>
  );
}
