import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Send, Square } from 'lucide-react';

const BUTTON_SIZE = 52;
const EDGE_PADDING = 16;
const DEFAULT_BOTTOM_OFFSET = 85;

export default function MobileFloatingSendBubble({
  prompt = '',
  onSend,
  isBusy = false,
  onAbort,
  isMobile = true,
}) {
  const [mounted, setMounted] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const dragRef = useRef({
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    moved: false,
    isDragging: false,
  });

  const lastActionTimeRef = useRef(0);

  // Initialize position to bottom-right of viewport on mount
  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      setPos({
        x: Math.max(EDGE_PADDING, window.innerWidth - BUTTON_SIZE - EDGE_PADDING),
        y: Math.max(50, window.innerHeight - BUTTON_SIZE - DEFAULT_BOTTOM_OFFSET),
      });
    }
  }, []);

  // Keep within viewport boundaries when window resizes or device rotates
  useEffect(() => {
    const handleResize = () => {
      setPos((prev) => {
        const maxX = window.innerWidth - BUTTON_SIZE - EDGE_PADDING;
        const maxY = window.innerHeight - BUTTON_SIZE - 20;
        return {
          x: Math.min(Math.max(EDGE_PADDING, prev.x), maxX),
          y: Math.min(Math.max(50, prev.y), maxY),
        };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const triggerAction = useCallback(() => {
    const now = Date.now();
    if (now - lastActionTimeRef.current < 350) return;
    lastActionTimeRef.current = now;

    if (isBusy) {
      onAbort?.();
    } else if (prompt.trim()) {
      onSend?.();
    }
  }, [isBusy, onAbort, onSend, prompt]);

  // Touch Handlers
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

      const maxX = window.innerWidth - BUTTON_SIZE - 8;
      const maxY = window.innerHeight - BUTTON_SIZE - 20;
      const newX = Math.min(Math.max(8, dragRef.current.originX + dx), maxX);
      const newY = Math.min(Math.max(50, dragRef.current.originY + dy), maxY);

      setPos({ x: newX, y: newY });
    }
  };

  const handleTouchEnd = (e) => {
    if (dragRef.current.isDragging && dragRef.current.moved) {
      if (e.cancelable) e.preventDefault();
      // Snap to closest screen edge (left or right)
      const midX = window.innerWidth / 2;
      const snapX =
        pos.x + BUTTON_SIZE / 2 < midX
          ? EDGE_PADDING
          : window.innerWidth - BUTTON_SIZE - EDGE_PADDING;
      setPos((prev) => ({ ...prev, x: snapX }));
    } else if (!dragRef.current.moved) {
      triggerAction();
    }
    dragRef.current.isDragging = false;
    setIsDragging(false);
  };

  // Mouse Drag Handlers (for desktop testing / hybrid touch screens)
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

        const maxX = window.innerWidth - BUTTON_SIZE - 8;
        const maxY = window.innerHeight - BUTTON_SIZE - 20;
        const newX = Math.min(Math.max(8, dragRef.current.originX + dx), maxX);
        const newY = Math.min(Math.max(50, dragRef.current.originY + dy), maxY);

        setPos({ x: newX, y: newY });
      }
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);

      if (dragRef.current.isDragging && dragRef.current.moved) {
        const midX = window.innerWidth / 2;
        const snapX =
          pos.x + BUTTON_SIZE / 2 < midX
            ? EDGE_PADDING
            : window.innerWidth - BUTTON_SIZE - EDGE_PADDING;
        setPos((prev) => ({ ...prev, x: snapX }));
      } else if (!dragRef.current.moved) {
        triggerAction();
      }
      dragRef.current.isDragging = false;
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  if (!mounted || typeof document === 'undefined' || !isMobile) return null;

  const hasText = Boolean(prompt && prompt.trim());

  // Determine appearance based on state
  let buttonStyle = '';
  let buttonTitle = '';

  if (isBusy) {
    buttonStyle =
      'bg-rose-950/95 border-2 border-rose-400 text-rose-300 shadow-glow-rose-sm shadow-[0_0_18px_rgba(244,63,94,0.45)] animate-pulse';
    buttonTitle = 'Dừng tạo (Stop)';
  } else if (hasText) {
    buttonStyle =
      'bg-gradient-to-tr from-cyan-400 to-emerald-400 text-black shadow-glow-emerald border-2 border-cyan-200 active:scale-95';
    buttonTitle = 'Gửi tin nhắn (Send)';
  } else {
    buttonStyle =
      'bg-cyber-950/85 border-2 border-slate-700/60 text-slate-500 opacity-50 shadow-none cursor-not-allowed';
    buttonTitle = 'Nhập tin nhắn để gửi';
  }

  return createPortal(
    <div
      className="md:hidden fixed z-50 select-none pointer-events-auto"
      style={{
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        width: `${BUTTON_SIZE}px`,
        height: `${BUTTON_SIZE}px`,
        touchAction: 'none',
        transition: isDragging ? 'none' : 'left 0.22s ease-out, top 0.22s ease-out',
      }}
    >
      <button
        type="button"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        aria-label={buttonTitle}
        title={buttonTitle}
        className={`w-full h-full rounded-full flex items-center justify-center backdrop-blur-md cursor-pointer transition-transform ${buttonStyle}`}
        style={{ touchAction: 'none' }}
      >
        {isBusy ? (
          <Square size={20} className="fill-current text-rose-300" />
        ) : (
          <Send
            size={22}
            className={`translate-x-0.5 ${hasText ? 'text-black' : 'text-slate-500'}`}
          />
        )}
      </button>
    </div>,
    document.body
  );
}
