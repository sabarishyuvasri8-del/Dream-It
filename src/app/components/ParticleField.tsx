import React, { useEffect, useRef } from 'react';

/* ─────────────────────────────────────────────────────────────────────────────
   ParticleField — Premium directional particle system
   
   Tiny colored directional strokes floating through space with a subtle
   localized reaction around the user's mouse cursor. The effect should feel
   like fragments already floating invisibly in the background, gently
   revealed and displaced by the user's movement.
   ───────────────────────────────────────────────────────────────────────────── */

// ── Palette: restrained blue/violet/lavender ──
const PALETTE = [
  // ~65% very faint blue/violet
  { r: 120, g: 140, b: 220 },  // soft blue
  { r: 140, g: 120, b: 210 },  // soft violet
  { r: 130, g: 135, b: 200 },  // muted blue
  { r: 150, g: 130, b: 215 },  // light violet
  { r: 115, g: 145, b: 205 },  // steel blue
  // ~20% slightly brighter blue/cyan
  { r: 100, g: 160, b: 230 },  // brighter blue
  { r: 110, g: 170, b: 220 },  // cyan-blue
  // ~10% lavender/pink
  { r: 180, g: 150, b: 210 },  // lavender
  { r: 190, g: 140, b: 180 },  // soft pink
  // ~5% warm accent (rare)
  { r: 200, g: 160, b: 140 },  // warm accent
];

// Weighted selection matching the described distribution
const PALETTE_WEIGHTS = [
  0.13, 0.13, 0.13, 0.13, 0.13, // blues/violets = 65%
  0.10, 0.10,                     // brighter blue/cyan = 20%
  0.05, 0.05,                     // lavender/pink = 10%
  0.05,                            // warm accent = 5%
];

function pickColor(): { r: number; g: number; b: number } {
  let r = Math.random();
  let cumulative = 0;
  for (let i = 0; i < PALETTE_WEIGHTS.length; i++) {
    cumulative += PALETTE_WEIGHTS[i];
    if (r <= cumulative) return PALETTE[i];
  }
  return PALETTE[0];
}

// ── Responsive particle count ──
function getParticleCount(width: number): number {
  if (width < 480) return 40;
  if (width < 768) return 70;
  if (width < 1024) return 100;
  if (width < 1440) return 125;
  return 150;
}

// ── Hero safe zone (center of viewport, upper half) ──
function getHeroSafeZone(w: number, h: number) {
  return {
    x: w * 0.2,
    y: h * 0.05,
    width: w * 0.6,
    height: h * 0.55,
  };
}

function isInSafeZone(
  px: number, py: number,
  zone: { x: number; y: number; width: number; height: number }
): boolean {
  return (
    px > zone.x &&
    px < zone.x + zone.width &&
    py > zone.y &&
    py < zone.y + zone.height
  );
}

// ── Particle ──
interface Particle {
  // Position & base position
  baseX: number;
  baseY: number;
  x: number;
  y: number;
  // Velocity
  vx: number;
  vy: number;
  // Drift (autonomous micro-movement)
  driftVx: number;
  driftVy: number;
  driftPhase: number;
  driftSpeed: number;
  // Appearance
  length: number;
  width: number;
  rotation: number;
  rotationVelocity: number;
  baseRotation: number;
  color: { r: number; g: number; b: number };
  alpha: number;
  baseAlpha: number;
  // Depth layer (0 = far, 1 = close)
  depth: number;
}

function createParticle(canvasW: number, canvasH: number): Particle {
  const safeZone = getHeroSafeZone(canvasW, canvasH);
  
  let x = Math.random() * canvasW;
  let y = Math.random() * canvasH;
  
  // Reduce probability of spawning in hero safe zone
  // If in safe zone, 70% chance to reroll position
  if (isInSafeZone(x, y, safeZone) && Math.random() < 0.7) {
    // Place outside safe zone
    if (Math.random() < 0.5) {
      x = Math.random() < 0.5
        ? Math.random() * safeZone.x
        : safeZone.x + safeZone.width + Math.random() * (canvasW - safeZone.x - safeZone.width);
    } else {
      y = Math.random() < 0.5
        ? Math.random() * safeZone.y
        : safeZone.y + safeZone.height + Math.random() * (canvasH - safeZone.y - safeZone.height);
    }
  }
  
  const depth = Math.random();
  const depthFactor = 0.3 + depth * 0.7; // 0.3 to 1.0
  
  // Particle dimensions: tiny directional strokes
  const length = (2 + Math.random() * 4) * depthFactor; // 2-6px scaled by depth
  // Rare chance for slightly longer particle
  const finalLength = Math.random() < 0.08 ? length * 1.4 : length;
  const width = 0.7 + Math.random() * 0.8; // 0.7-1.5px
  
  // Base alpha: very low for most, with depth influence
  let baseAlpha: number;
  const alphaRoll = Math.random();
  if (alphaRoll < 0.5) {
    baseAlpha = 0.08 + Math.random() * 0.12; // 0.08-0.20 (very faint)
  } else if (alphaRoll < 0.85) {
    baseAlpha = 0.20 + Math.random() * 0.15; // 0.20-0.35
  } else {
    baseAlpha = 0.35 + Math.random() * 0.10; // 0.35-0.45 (few bright ones)
  }
  
  // Particles in safe zone get extra opacity reduction
  if (isInSafeZone(x, y, safeZone)) {
    baseAlpha *= 0.4;
  }
  
  // Rotation: randomized with local coherence via seeding from position
  const sectorAngle = Math.floor(x / 200) * 0.3 + Math.floor(y / 200) * 0.2;
  const baseRotation = sectorAngle + (Math.random() - 0.5) * 1.2;
  
  // Autonomous drift: extremely subtle
  const driftAngle = Math.random() * Math.PI * 2;
  const driftMag = (0.02 + Math.random() * 0.06) * depthFactor;
  
  return {
    baseX: x,
    baseY: y,
    x,
    y,
    vx: 0,
    vy: 0,
    driftVx: Math.cos(driftAngle) * driftMag,
    driftVy: Math.sin(driftAngle) * driftMag,
    driftPhase: Math.random() * Math.PI * 2,
    driftSpeed: 0.003 + Math.random() * 0.008,
    length: finalLength,
    width,
    rotation: baseRotation,
    rotationVelocity: 0,
    baseRotation,
    color: pickColor(),
    alpha: baseAlpha,
    baseAlpha,
    depth,
  };
}

export default function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: -9999, y: -9999, prevX: -9999, prevY: -9999, vx: 0, vy: 0, active: false });
  const timeRef = useRef(0);
  const reducedMotionRef = useRef(false);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;
    
    // Check reduced motion preference
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotionRef.current = motionQuery.matches;
    const onMotionChange = () => { reducedMotionRef.current = motionQuery.matches; };
    motionQuery.addEventListener('change', onMotionChange);
    
    // ── Canvas sizing with devicePixelRatio ──
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      
      // Re-initialize particles on significant resize
      const count = getParticleCount(w);
      if (particlesRef.current.length === 0 || Math.abs(particlesRef.current.length - count) > 20) {
        particlesRef.current = Array.from({ length: count }, () => createParticle(w, h));
      }
    };
    
    resize();
    
    // Initialize particles
    if (particlesRef.current.length === 0) {
      const count = getParticleCount(window.innerWidth);
      particlesRef.current = Array.from({ length: count }, () =>
        createParticle(window.innerWidth, window.innerHeight)
      );
    }
    
    // ── Mouse tracking ──
    const onMouseMove = (e: MouseEvent) => {
      const m = mouseRef.current;
      m.prevX = m.x;
      m.prevY = m.y;
      m.x = e.clientX;
      m.y = e.clientY;
      m.vx = m.x - m.prevX;
      m.vy = m.y - m.prevY;
      m.active = true;
    };
    
    const onMouseLeave = () => {
      mouseRef.current.active = false;
    };
    
    const onMouseEnter = () => {
      mouseRef.current.active = true;
    };
    
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    document.addEventListener('mouseleave', onMouseLeave);
    document.addEventListener('mouseenter', onMouseEnter);
    window.addEventListener('resize', resize);
    
    // ── Constants ──
    const INTERACTION_RADIUS = 140;
    const INTERACTION_RADIUS_SQ = INTERACTION_RADIUS * INTERACTION_RADIUS;
    const DAMPING = 0.92;
    const RETURN_STRENGTH = 0.015;
    const ROTATION_DAMPING = 0.94;
    const ROTATION_RETURN = 0.02;
    
    // ── Animation loop ──
    const animate = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const particles = particlesRef.current;
      const mouse = mouseRef.current;
      const reducedMotion = reducedMotionRef.current;
      
      ctx.clearRect(0, 0, w, h);
      timeRef.current++;
      const t = timeRef.current;
      
      // Mouse velocity magnitude (for velocity-sensitive interaction)
      const mouseSpeed = Math.sqrt(mouse.vx * mouse.vx + mouse.vy * mouse.vy);
      // Decay mouse velocity when not moving
      mouse.vx *= 0.85;
      mouse.vy *= 0.85;
      
      const safeZone = getHeroSafeZone(w, h);
      
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        
        if (!reducedMotion) {
          // ── Autonomous drift ──
          p.driftPhase += p.driftSpeed;
          const driftModX = Math.sin(p.driftPhase) * p.driftVx;
          const driftModY = Math.cos(p.driftPhase * 0.7) * p.driftVy;
          
          p.baseX += driftModX;
          p.baseY += driftModY;
          
          // ── Cursor interaction ──
          if (mouse.active) {
            const dx = p.x - mouse.x;
            const dy = p.y - mouse.y;
            const distSq = dx * dx + dy * dy;
            
            if (distSq < INTERACTION_RADIUS_SQ && distSq > 1) {
              const dist = Math.sqrt(distSq);
              const falloff = 1 - (dist / INTERACTION_RADIUS);
              const falloffCurve = falloff * falloff; // Quadratic falloff — smooth
              
              // Velocity-sensitive force: faster mouse = stronger push
              const velocityBoost = 1 + Math.min(mouseSpeed * 0.08, 1.5);
              const forceMag = falloffCurve * 0.35 * velocityBoost;
              
              // Repulsion force (normalized direction away from cursor)
              const nx = dx / dist;
              const ny = dy / dist;
              p.vx += nx * forceMag;
              p.vy += ny * forceMag;
              
              // Slight rotation from interaction
              const crossProduct = dx * mouse.vy - dy * mouse.vx;
              p.rotationVelocity += crossProduct * 0.00003 * falloffCurve;
            }
          }
          
          // ── Physics: damping + return to base ──
          p.vx *= DAMPING;
          p.vy *= DAMPING;
          p.vx += (p.baseX - p.x) * RETURN_STRENGTH;
          p.vy += (p.baseY - p.y) * RETURN_STRENGTH;
          
          p.x += p.vx;
          p.y += p.vy;
          
          // ── Rotation damping ──
          p.rotationVelocity *= ROTATION_DAMPING;
          p.rotationVelocity += (p.baseRotation - p.rotation) * ROTATION_RETURN;
          p.rotation += p.rotationVelocity;
          
          // ── Viewport wrapping (smooth, no popping) ──
          const margin = 30;
          if (p.baseX < -margin) { p.baseX = w + margin; p.x = p.baseX; }
          if (p.baseX > w + margin) { p.baseX = -margin; p.x = p.baseX; }
          if (p.baseY < -margin) { p.baseY = h + margin; p.y = p.baseY; }
          if (p.baseY > h + margin) { p.baseY = -margin; p.y = p.baseY; }
        }
        
        // ── Alpha: reduce in safe zone ──
        let drawAlpha = p.baseAlpha;
        if (isInSafeZone(p.x, p.y, safeZone)) {
          drawAlpha *= 0.35;
        }
        
        // ── Draw: tiny directional stroke ──
        const halfLen = p.length / 2;
        const cosR = Math.cos(p.rotation);
        const sinR = Math.sin(p.rotation);
        const x1 = p.x - cosR * halfLen;
        const y1 = p.y - sinR * halfLen;
        const x2 = p.x + cosR * halfLen;
        const y2 = p.y + sinR * halfLen;
        
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${drawAlpha})`;
        ctx.lineWidth = p.width;
        ctx.lineCap = 'round';
        ctx.stroke();
      }
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseleave', onMouseLeave);
      document.removeEventListener('mouseenter', onMouseEnter);
      window.removeEventListener('resize', resize);
      motionQuery.removeEventListener('change', onMotionChange);
    };
  }, []);
  
  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1,
      }}
    />
  );
}
