import React from 'react';
import { formatTokenCount } from '../services/tokenEstimator';

export default function DonutContextGauge({
  currentTokens = 0,
  limit = 1048576,
  rollingThreshold = 32768,
  isRolled = false,
  onOpenSettings
}) {
  const size = 80;
  const strokeWidth = 7;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Percentage of context window used
  const rawPercent = limit > 0 ? (currentTokens / limit) * 100 : 0;
  const clampedPercent = Math.min(100, Math.max(0.5, rawPercent));
  const strokeDashoffset = circumference - (clampedPercent / 100) * circumference;

  // Threshold marker relative to limit. The <svg> is rotated -90deg, so the marker
  // angle must be expressed in the unrotated coordinate system (fraction * 360).
  // Subtracting another 90deg placed the dot one quadrant away from the real cut.
  const thresholdPercent = Math.min(100, (rollingThreshold / limit) * 100);
  const thresholdAngle = (thresholdPercent / 100) * 360;
  const thresholdRad = (thresholdAngle * Math.PI) / 180;
  const markerX = size / 2 + radius * Math.cos(thresholdRad);
  const markerY = size / 2 + radius * Math.sin(thresholdRad);

  // Status color logic
  const isOverThreshold = currentTokens >= rollingThreshold;
  const isNearLimit = rawPercent >= 85;

  let strokeColor = '#00ffaa'; // Emerald sci-fi default
  let glowColor = 'rgba(0, 255, 170, 0.45)';
  let textColor = 'text-emerald-300';

  if (isNearLimit) {
    strokeColor = '#ff007f'; // Magenta / danger
    glowColor = 'rgba(255, 0, 127, 0.5)';
    textColor = 'text-rose-400';
  } else if (isOverThreshold) {
    strokeColor = '#ffaa00'; // Amber warning
    glowColor = 'rgba(255, 170, 0, 0.5)';
    textColor = 'text-amber-300';
  }

  // Display label inside ring
  const displayPercent = rawPercent < 0.1 && rawPercent > 0 
    ? '<0.1%' 
    : rawPercent >= 10 
      ? `${Math.round(rawPercent)}%` 
      : `${rawPercent.toFixed(1)}%`;

  return (
    <div
      onClick={onOpenSettings}
      className="group relative flex flex-col items-center justify-center cursor-pointer select-none transition-transform hover:scale-105"
      title={`Context Window: ${formatTokenCount(currentTokens)} / ${formatTokenCount(limit)} tokens (${rawPercent.toFixed(1)}%)\nRolling Threshold: ${formatTokenCount(rollingThreshold)} tokens\nClick to adjust rolling settings.`}
    >
      {/* Sci-Fi Circular Glow Background */}
      <div 
        className="absolute inset-0 rounded-full blur-md opacity-25 group-hover:opacity-45 transition-opacity pointer-events-none"
        style={{ backgroundColor: strokeColor }}
      />

      <div className="relative w-20 h-20 flex items-center justify-center">
        <svg width={size} height={size} className="transform -rotate-90">
          <defs>
            <linearGradient id="emeraldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00ffaa" />
              <stop offset="100%" stopColor="#00f0ff" />
            </linearGradient>
            <filter id="gaugeGlow">
              <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* Background Outer Ring Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#141b2d"
            strokeWidth={strokeWidth}
            fill="transparent"
          />

          {/* Rolling Threshold Indicator Dot/Dash */}
          {thresholdPercent > 0 && thresholdPercent < 100 && (
            <circle
              cx={markerX}
              cy={markerY}
              r={strokeWidth / 2 + 1}
              fill="#ffaa00"
              stroke="#06080d"
              strokeWidth="1.5"
            />
          )}

          {/* Active Context Progress Stroke */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={isOverThreshold || isNearLimit ? strokeColor : "url(#emeraldGrad)"}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            style={{
              transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.3s ease',
              filter: `drop-shadow(0 0 4px ${glowColor})`
            }}
          />
        </svg>

        {/* Center Content Inside Gauge */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className={`text-[12px] font-bold font-mono tracking-tight leading-none ${textColor}`}>
            {displayPercent}
          </span>
          <span className="text-[8px] font-mono font-semibold uppercase tracking-wider text-slate-400 mt-0.5">
            CTX
          </span>
          {isRolled && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping absolute -top-0.5 right-1" />
          )}
        </div>
      </div>

      {/* Mini Token Readout */}
      <div className="text-[10px] font-mono text-slate-400 text-center mt-1 leading-tight group-hover:text-cyan-300 transition-colors">
        <span className="font-semibold text-slate-200">{formatTokenCount(currentTokens)}</span>
        <span className="text-slate-500"> / </span>
        <span>{formatTokenCount(limit)}</span>
      </div>
    </div>
  );
}
