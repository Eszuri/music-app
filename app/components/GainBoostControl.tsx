'use client';

import React, {memo, useState} from 'react';
import {getAccent} from '../lib/colors';
import {useHoverDescription} from '../hooks/useHoverDescription';
import {t, type Lang} from '../lib/translations';

interface GainBoostControlProps {
    gain: number;          // 1.0 – 3.0 (100% – 300%)
    minGain: number;
    maxGain: number;
    setGain: (v: number) => void;
    supported: boolean;
    accentColor: string;
    lang?: Lang;
}

function ZapIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
    );
}

function AlertTriangleIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
    );
}

function CustomTooltip({
    content,
    children,
    variant = 'warning',
}: {
    content: React.ReactNode;
    children: React.ReactNode;
    variant?: 'warning' | 'info';
}) {
    const [isVisible, setIsVisible] = useState(false);

    return (
        <div
            className="relative inline-flex items-center justify-center"
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
            onFocus={() => setIsVisible(true)}
            onBlur={() => setIsVisible(false)}
        >
            {children}
            {isVisible && content && (
                <div
                    className={`absolute bottom-full mb-2.5 left-1/2 -translate-x-1/2 z-50 pointer-events-none whitespace-nowrap px-2.5 py-1.5 text-[11px] font-medium rounded-lg shadow-xl backdrop-blur-md border transition-all duration-150 animate-in fade-in zoom-in-95 ${
                        variant === 'warning'
                            ? 'bg-zinc-950/95 text-red-300 border-red-500/40 shadow-red-950/50'
                            : 'bg-zinc-900/95 text-zinc-200 border-zinc-700/60 shadow-black/50'
                    }`}
                >
                    {content}
                    <div
                        className={`absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 ${
                            variant === 'warning'
                                ? 'border-t-red-500/40'
                                : 'border-t-zinc-700/60'
                        }`}
                    />
                </div>
            )}
        </div>
    );
}

function GainBoostControl({
    gain,
    minGain,
    maxGain,
    setGain,
    supported,
    accentColor,
    lang = 'en',
}: GainBoostControlProps) {
    const accent = getAccent(accentColor);
    const pct = Math.round(gain * 100);
    const isBoosted = gain > minGain + 0.001;
    const isOver200 = gain > 2.0 + 0.001; // > 200%
    const range = maxGain - minGain;
    const visualPct = range > 0 ? ((gain - minGain) / range) * 100 : 0;

    const minPct = Math.round(minGain * 100);
    const maxPct = Math.round(maxGain * 100);
    const isDecreaseDisabled = pct <= minPct;
    const isIncreaseDisabled = pct >= maxPct;

    // Color logic: Green (<=150%), Yellow (151%-200%), Red (>200%)
    let sliderColorHex = accent.hex400;
    let trackGradient = `linear-gradient(90deg, ${accent.hex500}, ${accent.hex400})`;
    let textClass = 'text-white/50';

    if (isBoosted) {
        if (pct <= 150) {
            // Hijau (Green)
            sliderColorHex = '#22c55e';
            trackGradient = 'linear-gradient(90deg, #22c55e, #16a34a)';
            textClass = 'text-emerald-400 font-medium';
        } else if (pct <= 200) {
            // Kuning (Yellow / Amber)
            sliderColorHex = '#eab308';
            trackGradient = 'linear-gradient(90deg, #22c55e 0%, #eab308 100%)';
            textClass = 'text-yellow-400 font-medium';
        } else {
            // Merah (Red)
            sliderColorHex = '#ef4444';
            trackGradient = 'linear-gradient(90deg, #22c55e 0%, #eab308 50%, #ef4444 100%)';
            textClass = 'text-red-400 font-bold';
        }
    }

    const hoverMain = useHoverDescription(
        supported
            ? t(lang, 'gainBoost.desc')
            : t(lang, 'gainBoost.unsupported'),
    );

    const warningText = t(lang, 'gainBoost.warningTooltip');
    const warningHover = useHoverDescription(isOver200 ? warningText : null);

    const resetHover = useHoverDescription(t(lang, 'gainBoost.resetTooltip'));

    const onSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = parseFloat(e.target.value);
        if (Number.isFinite(v)) setGain(v / 100);
    };

    const reset = () => setGain(minGain);

    const stepDown = () => {
        const next = Math.max(minPct, pct - 5);
        setGain(next / 100);
    };

    const stepUp = () => {
        const next = Math.min(maxPct, pct + 5);
        setGain(next / 100);
    };

    const btnBaseClass = "w-5 h-5 flex items-center justify-center rounded transition-colors";
    const decreaseBtnClass = `${btnBaseClass} ${
        isDecreaseDisabled
            ? "text-white/30 bg-transparent cursor-not-allowed pointer-events-none"
            : "text-white/80 hover:text-white hover:bg-white/10 cursor-pointer"
    }`;
    const increaseBtnClass = `${btnBaseClass} ${
        isIncreaseDisabled
            ? "text-white/30 bg-transparent cursor-not-allowed pointer-events-none"
            : "text-white/80 hover:text-white hover:bg-white/10 cursor-pointer"
    }`;

    if (!supported) {
        return (
            <div className="flex items-center gap-2 w-full justify-center text-white/40 text-[11px]">
                <ZapIcon />
                <span>{t(lang, 'gainBoost.unsupported')}</span>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2 w-full justify-center">
            {/* Reset Button (Zap) — Column 1 (w-7) matching Volume Icon */}
            <CustomTooltip content={t(lang, 'gainBoost.resetTooltip')} variant="info">
                <button
                    {...resetHover}
                    onClick={reset}
                    className={`flex items-center justify-center w-7 h-7 shrink-0 cursor-pointer transition-colors ${
                        isBoosted ? textClass : 'text-white/50 hover:text-white/80'
                    }`}
                >
                    <ZapIcon />
                </button>
            </CustomTooltip>

            {/* Minus Step Button — Column 2 (w-5) matching Volume minus button */}
            <button
                onClick={stepDown}
                disabled={isDecreaseDisabled}
                className={decreaseBtnClass}
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14" />
                </svg>
            </button>

            {/* Slider — Column 3 (flex-1 min-w-14 max-w-40) matching Volume slider */}
            <div {...hoverMain} className="relative flex-1 min-w-14 max-w-40 h-5 flex items-center">
                <div className="absolute inset-x-0 h-1 rounded-full bg-zinc-800/80" />
                <div
                    className="absolute h-1 rounded-full transition-all duration-75"
                    style={{
                        width: `${visualPct}%`,
                        background: trackGradient,
                    }}
                />
                <div
                    className="absolute w-2.5 h-2.5 rounded-full pointer-events-none transition-all duration-75"
                    style={{
                        left: `calc(${visualPct}% - 5px)`,
                        backgroundColor: sliderColorHex,
                        boxShadow: `0 0 6px ${sliderColorHex}80`,
                    }}
                />
                <input
                    type="range"
                    min={minGain * 100}
                    max={maxGain * 100}
                    step="5"
                    value={pct}
                    onChange={onSliderChange}
                    className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
                />
            </div>

            {/* Column 4 (w-5): Shows Warning Icon with CustomTooltip if > 200%, or Plus Step Button if <= 200% */}
            {isOver200 ? (
                <CustomTooltip content={warningText} variant="warning">
                    <button
                        {...warningHover}
                        onClick={stepUp}
                        disabled={isIncreaseDisabled}
                        className="w-5 h-5 flex items-center justify-center rounded text-red-500 hover:text-red-400 transition-colors animate-pulse cursor-help"
                    >
                        <AlertTriangleIcon />
                    </button>
                </CustomTooltip>
            ) : (
                <button
                    onClick={stepUp}
                    disabled={isIncreaseDisabled}
                    className={increaseBtnClass}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 5v14M5 12h14" />
                    </svg>
                </button>
            )}

            {/* Percentage Text — Column 5 (min-w-9) matching Volume percentage text */}
            <span className={`text-[11px] tabular-nums text-right font-medium min-w-9 ${textClass}`}>
                {pct}%
            </span>
        </div>
    );
}

export default memo(GainBoostControl);
