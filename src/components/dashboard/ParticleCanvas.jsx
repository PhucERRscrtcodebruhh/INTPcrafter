import React, { useEffect, useRef } from 'react';

/**
 * Modern Interactive Cyber-Dust Particle Canvas
 * - 60fps HTML5 Canvas background
 * - 60-80 floating cyber-dust particles (cyan #00f0ff & violet #8b5cf6)
 * - Constellation network lines (threshold: 100px) & interactive mouse tethering
 * - Shockwave & acceleration burst on mini-game solution
 */
export default function ParticleCanvas({ triggerBurst = false, className = '' }) {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: -9999, y: -9999, active: false });
  const burstActiveRef = useRef(false);
  const shockwavesRef = useRef([]);
  const burstSparksRef = useRef([]);
  const prevTriggerRef = useRef(triggerBurst);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId;
    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize, { passive: true });

    // Handle mouse / touch tracking for interactive constellation connections
    const onMouseMove = (e) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
      mouseRef.current.active = true;
    };

    const onMouseLeave = () => {
      mouseRef.current.active = false;
    };

    const onTouchMove = (e) => {
      if (e.touches && e.touches[0]) {
        mouseRef.current.x = e.touches[0].clientX;
        mouseRef.current.y = e.touches[0].clientY;
        mouseRef.current.active = true;
      }
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('mouseleave', onMouseLeave, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });

    // Initialize 65-75 ambient cyber particles
    const particleCount = Math.floor(Math.min(width, 1400) / 20) + 25; // 55-80 depending on screen width
    const particles = [];

    const CYBER_COLORS = [
      { r: 0, g: 240, b: 255 }, // Cyan #00f0ff
      { r: 139, g: 92, b: 246 }, // Violet #8b5cf6
      { r: 56, g: 189, b: 248 }, // Sky #38bdf8
    ];

    for (let i = 0; i < particleCount; i++) {
      const colorObj = CYBER_COLORS[Math.floor(Math.random() * CYBER_COLORS.length)];
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        baseVx: (Math.random() - 0.5) * 0.5,
        baseVy: -(Math.random() * 0.6 + 0.3), // Drifting upward
        vx: (Math.random() - 0.5) * 0.5,
        vy: -(Math.random() * 0.6 + 0.3),
        radius: Math.random() * 1.6 + 1.0,
        color: colorObj,
        alpha: Math.random() * 0.45 + 0.15,
        pulsePhase: Math.random() * Math.PI * 2,
        pulseSpeed: 0.015 + Math.random() * 0.02,
      });
    }

    // Helper to spawn a shockwave and outward burst sparks
    const triggerBurstEffect = () => {
      const centerX = width / 2;
      const centerY = height / 2;

      // Shockwave circle
      shockwavesRef.current.push({
        x: centerX,
        y: centerY,
        radius: 10,
        maxRadius: Math.max(width, height) * 0.75,
        alpha: 0.85,
        speed: 16,
      });

      // 40 radial spark particles
      for (let i = 0; i < 45; i++) {
        const angle = (Math.PI * 2 * i) / 45 + (Math.random() - 0.5) * 0.3;
        const speed = Math.random() * 8 + 4;
        const colorObj = Math.random() > 0.4 ? CYBER_COLORS[0] : CYBER_COLORS[1];
        burstSparksRef.current.push({
          x: centerX + (Math.random() - 0.5) * 60,
          y: centerY + (Math.random() - 0.5) * 40,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: Math.random() * 2.5 + 1.5,
          color: colorObj,
          alpha: 1.0,
          decay: Math.random() * 0.02 + 0.015,
        });
      }

      // Temporarily accelerate ambient particles
      particles.forEach((p) => {
        p.vx = p.baseVx * 4 + (Math.random() - 0.5) * 4;
        p.vy = p.baseVy * 3 - Math.random() * 3;
        p.alpha = Math.min(p.alpha * 1.8, 0.95);
      });
    };

    // Main animation loop
    const render = () => {
      // Clear with transparent background (dashboard provides the slate base)
      ctx.clearRect(0, 0, width, height);

      // Check if burst was triggered externally
      if (burstActiveRef.current) {
        burstActiveRef.current = false;
        triggerBurstEffect();
      }

      // Update & render shockwaves
      for (let s = shockwavesRef.current.length - 1; s >= 0; s--) {
        const wave = shockwavesRef.current[s];
        wave.radius += wave.speed;
        wave.alpha -= 0.018;

        if (wave.alpha <= 0 || wave.radius >= wave.maxRadius) {
          shockwavesRef.current.splice(s, 1);
          continue;
        }

        ctx.save();
        ctx.beginPath();
        ctx.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0, 240, 255, ${wave.alpha * 0.6})`;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 15;
        ctx.stroke();
        ctx.restore();
      }

      // Update & render burst sparks
      for (let b = burstSparksRef.current.length - 1; b >= 0; b--) {
        const spark = burstSparksRef.current[b];
        spark.x += spark.vx;
        spark.y += spark.vy;
        spark.vx *= 0.96;
        spark.vy *= 0.96;
        spark.alpha -= spark.decay;

        if (spark.alpha <= 0) {
          burstSparksRef.current.splice(b, 1);
          continue;
        }

        ctx.beginPath();
        ctx.arc(spark.x, spark.y, spark.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${spark.color.r}, ${spark.color.g}, ${spark.color.b}, ${spark.alpha})`;
        ctx.fill();
      }

      // Draw faint constellation lines between particles (< 100px)
      const maxDistance = 100;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.hypot(dx, dy);

          if (dist < maxDistance) {
            const lineAlpha = (1 - dist / maxDistance) * 0.22;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(0, 240, 255, ${lineAlpha})`;
            ctx.lineWidth = 0.75;
            ctx.stroke();
          }
        }
      }

      // Draw interactive lines to user cursor (< 120px)
      if (mouseRef.current.active) {
        const mouseDistMax = 120;
        for (let i = 0; i < particles.length; i++) {
          const dx = particles[i].x - mouseRef.current.x;
          const dy = particles[i].y - mouseRef.current.y;
          const dist = Math.hypot(dx, dy);

          if (dist < mouseDistMax) {
            const lineAlpha = (1 - dist / mouseDistMax) * 0.45;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(mouseRef.current.x, mouseRef.current.y);
            ctx.strokeStyle = `rgba(0, 240, 255, ${lineAlpha})`;
            ctx.lineWidth = 1.1;
            ctx.stroke();
          }
        }
      }

      // Update & render particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Smooth damping back to baseline velocity if accelerated
        p.vx = p.vx * 0.98 + p.baseVx * 0.02;
        p.vy = p.vy * 0.98 + p.baseVy * 0.02;

        p.x += p.vx;
        p.y += p.vy;

        // Subtle pulsing opacity
        p.pulsePhase += p.pulseSpeed;
        const currentAlpha = Math.max(0.12, Math.min(0.85, p.alpha + Math.sin(p.pulsePhase) * 0.12));

        // Screen wrapping (drift upward)
        if (p.y < -15) {
          p.y = height + 10;
          p.x = Math.random() * width;
        } else if (p.y > height + 15) {
          p.y = -10;
        }

        if (p.x < -15) {
          p.x = width + 10;
        } else if (p.x > width + 15) {
          p.x = -10;
        }

        // Draw particle dot with soft glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${currentAlpha})`;
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseleave', onMouseLeave);
      window.removeEventListener('touchmove', onTouchMove);
    };
  }, []);

  // Watch triggerBurst prop changes to dispatch burst effect
  useEffect(() => {
    if (triggerBurst && !prevTriggerRef.current) {
      burstActiveRef.current = true;
    }
    prevTriggerRef.current = triggerBurst;
  }, [triggerBurst]);

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 pointer-events-none z-0 ${className}`}
      aria-hidden="true"
    />
  );
}
