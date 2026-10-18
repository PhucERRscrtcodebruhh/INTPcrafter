import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { formatTokenCount } from '../../services/tokenEstimator';

const BUBBLE_SIZE = 44; // w-11 h-11 (44px, easy to tap on mobile)
const EDGE_PADDING = 12; // 12px from edge
const DEFAULT_BOTTOM_OFFSET = 180; // 180px from bottom (Option A: Floating just above the dock)

export default function MobileContextBubbleTrigger({
  onClick,
  currentTokens = 0,
  tokensUsed,
  limit = 1048576,
  tokenCap,
  percentage,
  className = '',
}) {
  const [mounted, setMounted] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [hasPosition, setHasPosition] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const dragRef = useRef({
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    moved: false,
    isDragging: false,
  });

  const lastClickTimeRef = useRef(0);

  // Initialize position: loads saved position or defaults to bottom-[180px] right-3
  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('intp_mobile_context_bubble_pos');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
            const maxX = window.innerWidth - BUBBLE_SIZE - EDGE_PADDING;
            const maxY = window.innerHeight - BUBBLE_SIZE - 20;
            setPos({
              x: Math.min(Math.max(EDGE_PADDING, parsed.x), maxX),
              y: Math.min(Math.max(50, parsed.y), maxY),
            });
            setHasPosition(true);
            return;
          }
        }
      } catch {
        // ignore
      }

      // Default position: fixed bottom-[180px] right-3
      setPos({
        x: Math.max(EDGE_PADDING, window.innerWidth - BUBBLE_SIZE - EDGE_PADDING),
        y: Math.max(60, window.innerHeight - BUBBLE_SIZE - DEFAULT_BOTTOM_OFFSET),
      });
      setHasPosition(true);
    }
  }, []);

  // Window resize safety clamp
  useEffect(() => {
    const handleResize = () => {
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
  }, []);

  // Telemetry
  const effectiveLimit = Math.max(1, limit || tokenCap || 1048576);
  const usedTokens = currentTokens ?? tokensUsed ?? 0;
  const rawPercent = percentage !== undefined ? percentage : (usedTokens / effectiveLimit) * 100;

  // Glow styles:
  // Cyan (#00f0ff) when < 65%
  // Amber (#f59e0b) when 65% - 85%
  // Red (#f43f5e) when > 85%
  const isRed = rawPercent > 85;
  const isAmber = rawPercent >= 65 && rawPercent <= 85;

  const glowStyle = isRed
    ? 'border-rose-500 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.65)]'
    : isAmber
      ? 'border-amber-400 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.55)]'
      : 'border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(0,240,255,0.45)]';

  const percentLabel = rawPercent < 0.1 && rawPercent > 0
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
    dragRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      originX: pos.x,
      originY: pos.y,
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

  // Mouse Handlers for Desktop Testing / Mobile Emulation (DevTools)
  const handleMouseDown = (e) => {
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: pos.x,
      originY: pos.y,
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

  if (!mounted || !hasPosition) return null;

  const bubbleContent = (
    <div
      role="button"
      tabIndex={0}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      style={{
        position: 'fixed',
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        zIndex: 45,
        touchAction: 'none',
        transition: isDragging ? 'none' : 'left 0.25s cubic-bezier(0.16, 1, 0.3, 1), transform 0.15s ease',
      }}
      className={`md:hidden flex flex-col items-center justify-center w-11 h-11 rounded-full bg-[#0a0f1d]/90 border backdrop-blur-md active:scale-95 transition-transform select-none cursor-pointer shadow-lg ${glowStyle} ${className}`}
      aria-label="Open Context Control"
      title={`Context: ${formatTokenCount(usedTokens)} / ${formatTokenCount(effectiveLimit)} tokens (${rawPercent.toFixed(1)}%)\nChạm để mở Context Controller & Bộ nén Blank RAG.\nKéo để di chuyển bong bóng.`}
    >
      <span className="text-[10px] font-mono font-bold leading-none pointer-events-none">CTX</span>
      <span className="text-[9px] font-mono text-slate-400 leading-none mt-0.5 pointer-events-none">
        {percentLabel}
      </span>
    </div>
  );

  return createPortal(bubbleContent, document.body);
}
