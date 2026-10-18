import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { formatTokenCount } from '../../services/tokenEstimator';

const BUBBLE_SIZE = 36; // 36px (h-9 w-9)
const EDGE_PADDING = 12;

export default function MobileContextBubbleTrigger({
  onClick,
  currentTokens = 0,
  tokensUsed,
  limit = 1048576,
  tokenCap,
  percentage,
  className = ''
}) {
  const [mounted, setMounted] = useState(false);
  const [isDetached, setIsDetached] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const anchorRef = useRef(null);
  const dragRef = useRef({
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    moved: false,
    isDragging: false,
  });

  const lastClickTimeRef = useRef(0);

  useEffect(() => {
    setMounted(true);
    // Check if user previously dragged the bubble to a custom screen position
    try {
      const saved = localStorage.getItem('intp_mobile_context_bubble_pos');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
          const maxX = window.innerWidth - BUBBLE_SIZE - EDGE_PADDING;
          const maxY = window.innerHeight - BUBBLE_SIZE - 20;
          setPos({
            x: Math.min(Math.max(EDGE_PADDING, parsed.x), maxX),
            y: Math.min(Math.max(50, parsed.y), maxY)
          });
          setIsDetached(true);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Window resize safety clamp
  useEffect(() => {
    const handleResize = () => {
      if (!isDetached) return;
      setPos((prev) => {
        const maxX = window.innerWidth - BUBBLE_SIZE - EDGE_PADDING;
        const maxY = window.innerHeight - BUBBLE_SIZE - 20;
        return {
          x: Math.min(Math.max(EDGE_PADDING, prev.x), maxX),
          y: Math.min(Math.max(50, prev.y), maxY),
        };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isDetached]);

  // Telemetry & Capacity calculation
  const effectiveLimit = Math.max(1, limit || tokenCap || 1048576);
  const usedTokens = currentTokens ?? tokensUsed ?? 0;
  const rawPercent = percentage !== undefined ? percentage : (usedTokens / effectiveLimit) * 100;
  const clampedPercent = Math.min(100, Math.max(0.5, rawPercent));

  // Glow styles matching specification:
  // Cyan (#00f0ff) when < 65%
  // Amber (#f59e0b) when 65% - 85%
  // Red (#f43f5e) when > 85%
  const isRed = rawPercent > 85;
  const isAmber = rawPercent >= 65 && rawPercent <= 85;

  const accentColor = isRed ? '#f43f5e' : isAmber ? '#f59e0b' : '#00f0ff';
  const glowStyle = isRed
    ? 'shadow-[0_0_12px_rgba(244,63,94,0.7)] border-rose-500/70 text-rose-300'
    : isAmber
      ? 'shadow-[0_0_10px_rgba(245,158,11,0.6)] border-amber-500/60 text-amber-300'
      : 'shadow-[0_0_10px_rgba(0,240,255,0.5)] border-cyan-400/60 text-cyan-300';

  // SVG Radial meter math
  const strokeWidth = 3;
  const radius = (BUBBLE_SIZE - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clampedPercent / 100) * circumference;

  // Center display text
  const displayLabel = rawPercent < 0.1 && rawPercent > 0
    ? '<0.1%'
    : rawPercent >= 10
      ? `${Math.round(rawPercent)}%`
      : `${rawPercent.toFixed(1)}%`;

  const triggerOpen = useCallback(() => {
    const now = Date.now();
    if (now - lastClickTimeRef.current < 300) return;
    lastClickTimeRef.current = now;
    onClick?.();
  }, [onClick]);

  // Touch Handlers for Drag & Tap
  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    let startOriginX = pos.x;
    let startOriginY = pos.y;

    if (!isDetached && anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      startOriginX = rect.left;
      startOriginY = rect.top;
    }

    dragRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      originX: startOriginX,
      originY: startOriginY,
      moved: false,
      isDragging: true,
    };
    setIsDragging(false);
  };

  const handleTouchMove = (e) => {
    if (!dragRef.current.isDragging) return;
    const touch = e.touches[0];
    const dx = touch.clientX - dragRef.current.startX;
    const dy = touch.clientY - dragRef.current.startY;
    const dist = Math.hypot(dx, dy);

    if (dist > 6) {
      if (e.cancelable) e.preventDefault();
      dragRef.current.moved = true;
      setIsDragging(true);
      if (!isDetached) setIsDetached(true);

      const maxX = window.innerWidth - BUBBLE_SIZE - 8;
      const maxY = window.innerHeight - BUBBLE_SIZE - 20;
      const newX = Math.min(Math.max(8, dragRef.current.originX + dx), maxX);
      const newY = Math.min(Math.max(40, dragRef.current.originY + dy), maxY);

      setPos({ x: newX, y: newY });
    }
  };

  const handleTouchEnd = (e) => {
    if (dragRef.current.isDragging && dragRef.current.moved) {
      if (e.cancelable) e.preventDefault();
      // Snap to closest screen edge (left or right)
      const midX = window.innerWidth / 2;
      const snapX = pos.x + BUBBLE_SIZE / 2 < midX ? EDGE_PADDING : window.innerWidth - BUBBLE_SIZE - EDGE_PADDING;
      setPos((prev) => {
        const next = { ...prev, x: snapX };
        try {
          localStorage.setItem('intp_mobile_context_bubble_pos', JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    } else if (!dragRef.current.moved) {
      triggerOpen();
    }
    dragRef.current.isDragging = false;
    setIsDragging(false);
  };

  // Mouse Handlers for PC / Emulation
  const handleMouseDown = (e) => {
    let startOriginX = pos.x;
    let startOriginY = pos.y;

    if (!isDetached && anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      startOriginX = rect.left;
      startOriginY = rect.top;
    }

    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: startOriginX,
      originY: startOriginY,
      moved: false,
      isDragging: true,
    };

    const handleMouseMove = (ev) => {
      if (!dragRef.current.isDragging) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      const dist = Math.hypot(dx, dy);

      if (dist > 6) {
        dragRef.current.moved = true;
        setIsDragging(true);
        if (!isDetached) setIsDetached(true);

        const maxX = window.innerWidth - BUBBLE_SIZE - 8;
        const maxY = window.innerHeight - BUBBLE_SIZE - 20;
        const newX = Math.min(Math.max(8, dragRef.current.originX + dx), maxX);
        const newY = Math.min(Math.max(40, dragRef.current.originY + dy), maxY);

        setPos({ x: newX, y: newY });
      }
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);

      if (dragRef.current.isDragging && dragRef.current.moved) {
        const midX = window.innerWidth / 2;
        const snapX = pos.x + BUBBLE_SIZE / 2 < midX ? EDGE_PADDING : window.innerWidth - BUBBLE_SIZE - EDGE_PADDING;
        setPos((prev) => {
          const next = { ...prev, x: snapX };
          try {
            localStorage.setItem('intp_mobile_context_bubble_pos', JSON.stringify(next));
          } catch {
            // ignore
          }
          return next;
        });
      } else if (!dragRef.current.moved) {
        triggerOpen();
      }
      dragRef.current.isDragging = false;
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // The circular bubble JSX element
  const bubbleElement = (
    <div
      role="button"
      tabIndex={0}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      style={
        isDetached
          ? {
              position: 'fixed',
              left: `${pos.x}px`,
              top: `${pos.y}px`,
              zIndex: 48,
              touchAction: 'none',
              transition: isDragging ? 'none' : 'left 0.25s cubic-bezier(0.16, 1, 0.3, 1), transform 0.15s ease',
            }
          : undefined
      }
      className={`group relative flex items-center justify-center shrink-0 w-9 h-9 rounded-full bg-cyber-950/95 border select-none cursor-pointer active:scale-95 transition-shadow ${glowStyle} ${
        isDetached ? 'cursor-grab active:cursor-grabbing shadow-2xl' : ''
      }`}
      title={`Context Window: ${formatTokenCount(usedTokens)} / ${formatTokenCount(effectiveLimit)} (${rawPercent.toFixed(1)}%)\nChạm để mở Context Controller & Bộ nén Blank RAG.\nGiữ và kéo để di chuyển bong bóng.`}
    >
      {/* Radial SVG Arc */}
      <svg
        width={BUBBLE_SIZE}
        height={BUBBLE_SIZE}
        className="transform -rotate-90 pointer-events-none"
        viewBox={`0 0 ${BUBBLE_SIZE} ${BUBBLE_SIZE}`}
      >
        <circle
          cx={BUBBLE_SIZE / 2}
          cy={BUBBLE_SIZE / 2}
          r={radius}
          stroke="#141b2d"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <circle
          cx={BUBBLE_SIZE / 2}
          cy={BUBBLE_SIZE / 2}
          r={radius}
          stroke={accentColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          className="transition-all duration-300 ease-out"
        />
      </svg>

      {/* Center Percentage Text */}
      <span className={`absolute font-mono font-bold tracking-tighter text-[9px] pointer-events-none ${
        isRed ? 'text-rose-300' : isAmber ? 'text-amber-300' : 'text-cyan-300'
      }`}>
        {displayLabel}
      </span>
    </div>
  );

  return (
    <>
      {/* Permanent Dock Anchor Slot: Guarantees ZERO Layout Shift to Bottom Dock or Textarea */}
      <div
        ref={anchorRef}
        className={`w-9 h-9 flex items-center justify-center shrink-0 ${className}`}
      >
        {!isDetached ? (
          bubbleElement
        ) : (
          /* Subtle placeholder in dock when bubble is detached/floating */
          <button
            type="button"
            onClick={triggerOpen}
            className="w-7 h-7 rounded-full border border-dashed border-cyan-500/30 bg-cyber-950/40 flex items-center justify-center text-[8px] font-mono text-cyan-400/60 hover:text-cyan-300 hover:border-cyan-400/60 transition-colors"
            title="Mở Context Controller (Bong bóng đang nổi trên màn hình)"
          >
            ctx
          </button>
        )}
      </div>

      {/* Render via Portal when floating/detached */}
      {mounted && isDetached && createPortal(bubbleElement, document.body)}
    </>
  );
}
