'use client';

import React from 'react';

interface WanfinanceLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showTrafficLights?: boolean;
  showSubtitle?: boolean;
  className?: string;
}

export function WanfinanceLogo({
  size = 'md',
  showTrafficLights = true,
  showSubtitle = true,
  className = '',
}: WanfinanceLogoProps) {
  const isSm = size === 'sm';
  const isLg = size === 'lg';

  return (
    <div id="wanfinance-brand-logo" className={`flex items-center gap-3 select-none ${className}`}>
      {/* Apple-style Window Traffic Lights (Red, Amber, Green) */}
      {showTrafficLights && (
        <div className="flex items-center gap-1.5 pr-1">
          <span
            className={`${
              isSm ? 'w-2.5 h-2.5' : isLg ? 'w-3.5 h-3.5' : 'w-3 h-3'
            } rounded-full bg-[#FF5F56] border border-[#E0443E]/50 shadow-2xs hover:brightness-110 transition-all cursor-pointer`}
            title="Fechar / Janela"
          />
          <span
            className={`${
              isSm ? 'w-2.5 h-2.5' : isLg ? 'w-3.5 h-3.5' : 'w-3 h-3'
            } rounded-full bg-[#FFBD2E] border border-[#DEA123]/50 shadow-2xs hover:brightness-110 transition-all cursor-pointer`}
            title="Minimizar"
          />
          <span
            className={`${
              isSm ? 'w-2.5 h-2.5' : isLg ? 'w-3.5 h-3.5' : 'w-3 h-3'
            } rounded-full bg-[#27C93F] border border-[#1AAB29]/50 shadow-2xs hover:brightness-110 transition-all cursor-pointer`}
            title="Expandir"
          />
        </div>
      )}

      {/* Main Logo Icon: Vibrant Blue to Purple Apple Squircle with 'W' */}
      <div
        className={`relative ${
          isSm ? 'w-7 h-7 rounded-lg' : isLg ? 'w-10 h-10 rounded-2xl' : 'w-8.5 h-8.5 rounded-xl'
        } bg-gradient-to-br from-[#3B82F6] via-[#6366F1] to-[#8B5CF6] flex items-center justify-center shadow-md shadow-indigo-500/25 border border-white/20 flex-shrink-0 group overflow-hidden`}
      >
        {/* Subtle Specular Inset Highlight (Apple Glass Effect) */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-transparent to-black/15 pointer-events-none" />

        {/* Crisp Bold Letter 'W' */}
        <span
          className={`font-black text-white leading-none tracking-tighter ${
            isSm ? 'text-xs' : isLg ? 'text-lg' : 'text-sm'
          } drop-shadow-xs transform transition-transform group-hover:scale-105`}
        >
          W
        </span>
      </div>

      {/* Brand Text & Badges */}
      <div className="flex flex-col justify-center">
        <div className="flex items-center gap-1.5">
          <span
            className={`font-extrabold tracking-tight text-[#1D1D1F] ${
              isSm ? 'text-xs' : isLg ? 'text-base' : 'text-sm'
            }`}
            style={{
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", system-ui, sans-serif',
            }}
          >
            Wanfinance
          </span>

          {/* Pill Badge 'Pro' */}
          <span className="px-1.5 py-0.2 bg-slate-100 text-slate-800 border border-slate-200 text-[9px] font-bold rounded-full tracking-wide uppercase shadow-2xs">
            Pro
          </span>
        </div>

        {/* Subtitle Pill 'Excellence' */}
        {showSubtitle && (
          <div className="mt-0.5">
            <span className="inline-block px-1.5 py-0.2 bg-slate-100 text-slate-500 border border-slate-200/80 rounded text-[8.5px] font-medium tracking-wide">
              Excellence
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
