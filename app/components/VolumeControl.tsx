'use client';

import React, {useState} from 'react';
import {motion} from 'framer-motion';
import {getAccent} from '../lib/colors';
import {t, type Lang} from '../lib/translations';
import {useHoverDescription} from '../hooks/useHoverDescription';

interface VolumeControlProps {
    lang: Lang;
    volume: number; // 0.0 to 1.0 (appVolume or systemVolume depending on volumeMode)
    volumeMode: 'app' | 'system';
    systemVolumeSynced: boolean;
    systemMuted: boolean;
    volumeLimit: number;
    volumeStep: number;
    handleVolumeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    accentColor: string;
}

function VolumeIcon({muted, low}: {muted: boolean; low: boolean}) {
    if (muted) {
        return (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
        );
    }
    if (low) {
        return (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
        );
    }
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </svg>
    );
}

function makeChangeEvent(value: number): React.ChangeEvent<HTMLInputElement> {
    return {target: {value: String(value)}} as React.ChangeEvent<HTMLInputElement>;
}

export default function VolumeControl({
    lang,
    volume,
    volumeMode,
    systemVolumeSynced,
    systemMuted,
    volumeLimit,
    volumeStep,
    handleVolumeChange,
    accentColor,
}: VolumeControlProps) {
    const accent = getAccent(accentColor);
    const [hovering, setHovering] = useState(false);
    const [prevVolume, setPrevVolume] = useState(volume);

    const isSystem = volumeMode === 'system';
    const limit = volumeLimit;
    const pct = Math.round(volume * 100);

    // Pengkondisian terpisah untuk Aturan Batas Volume Sistem
    let isDecreaseDisabled = false;
    let isIncreaseDisabled = false;
    let isSliderDisabled = false;

    if (isSystem && limit > 0) {
        // Kondisi 1: Nilai volume sistem LEBIH BESAR dari batas suara
        if (pct > limit) {
            isDecreaseDisabled = true;
            isIncreaseDisabled = true;
            isSliderDisabled = true;
        }
        // Kondisi 2: Nilai volume sistem SAMA DENGAN batas suara
        else if (pct === limit) {
            isDecreaseDisabled = false;
            isIncreaseDisabled = true;
            isSliderDisabled = false;
        }
        // Kondisi 3: Nilai volume sistem DI BAWAH batas suara
        else {
            isDecreaseDisabled = false;
            isIncreaseDisabled = false;
            isSliderDisabled = false;
        }
    }

    const showResetButton = isSystem && limit > 0 && pct > limit;

    const sliderMax = isSystem
        ? (limit > 0 ? limit : 100)
        : 1;

    const showSlider = !isSystem || systemVolumeSynced;
    const muted = isSystem ? (systemMuted || pct <= 0) : volume <= 0;
    const low = pct < 50;
    const label = isSystem
        ? systemVolumeSynced ? (muted ? t(lang, 'volume.muted') : `${pct}%`) : t(lang, 'volume.notSynced')
        : `${pct}%`;

    const toggleMute = () => {
        if (!muted) {
            setPrevVolume(volume);
            handleVolumeChange(makeChangeEvent(0));
        } else {
            const restored = prevVolume || 0.5;
            handleVolumeChange(makeChangeEvent(restored));
        }
    };

    const onSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (isSliderDisabled) return;
        if (isSystem) {
            let sysVal = parseFloat(e.target.value);
            if (limit > 0 && sysVal > limit) {
                sysVal = limit;
            }
            handleVolumeChange(makeChangeEvent(sysVal / 100));
        } else {
            handleVolumeChange(e);
        }
    };

    const onStepButton = (direction: 'up' | 'down') => {
        if (direction === 'up' && isIncreaseDisabled) return;
        if (direction === 'down' && isDecreaseDisabled) return;

        const step = volumeStep / 100;
        const delta = direction === 'up' ? step : -step;
        let newVol = Math.max(0, Math.min(1, Math.round((volume + delta) / step) * step));

        if (isSystem && limit > 0) {
            const targetPct = Math.round(newVol * 100);
            if (pct > limit) return;
            if (pct === limit && direction === 'up') return;
            if (targetPct > limit) {
                newVol = limit / 100;
            }
        }
        handleVolumeChange(makeChangeEvent(newVol));
    };

    const onResetToLimit = () => {
        if (isSystem && limit > 0) {
            handleVolumeChange(makeChangeEvent(limit / 100));
        }
    };

    const decreaseBtnClass = `w-5 h-5 flex items-center justify-center rounded transition-colors ${isDecreaseDisabled
        ? "text-white/30 bg-transparent cursor-not-allowed pointer-events-none"
        : "text-white/80 hover:text-white hover:bg-white/10 cursor-pointer"
        }`;

    const increaseBtnClass = `w-5 h-5 flex items-center justify-center rounded transition-colors ${isIncreaseDisabled
        ? "text-white/30 bg-transparent cursor-not-allowed pointer-events-none"
        : "text-white/80 hover:text-white hover:bg-white/10 cursor-pointer"
        }`;

    const visualPct = isSystem ? Math.min(pct, sliderMax) : volume * 100;

    const muteHover = useHoverDescription(t(lang, muted ? 'status.unmute' : 'status.mute'));
    const volumeHover = useHoverDescription(t(lang, 'status.volume'));

    return (
        <div className="flex items-center gap-2 w-full justify-center">
            <motion.button
                {...muteHover}
                onClick={toggleMute}
                whileHover={{scale: 1.1}}
                whileTap={{scale: 0.9}}
                className="text-white/80 hover:text-white cursor-pointer flex items-center justify-center w-7 h-7 shrink-0"
            >
                <VolumeIcon muted={muted} low={low} />
            </motion.button>

            {/* Decrease button (-) */}
            <motion.button
                {...volumeHover}
                onClick={() => onStepButton('down')}
                disabled={isDecreaseDisabled}
                whileHover={isDecreaseDisabled ? undefined : {scale: 1.05}}
                whileTap={isDecreaseDisabled ? undefined : {scale: 0.95}}
                className={decreaseBtnClass}
                title={isDecreaseDisabled ? t(lang, 'volume.decreaseDisabled') : t(lang, 'volume.decrease')}
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14" />
                </svg>
            </motion.button>

            <div
                {...volumeHover}
                className="relative flex-1 min-w-[56px] max-w-40 h-5 flex items-center"
                onMouseEnter={() => setHovering(true)}
                onMouseLeave={() => setHovering(false)}
            >
                <div className="absolute inset-x-0 h-1 rounded-full bg-zinc-800/80" />
                {showSlider && (
                    <>
                        <div
                            className="absolute h-1 rounded-full transition-all duration-75"
                            style={{
                                width: isSystem && sliderMax > 0 ? `${(visualPct / sliderMax) * 100}%` : `${visualPct}%`,
                                background: isSliderDisabled
                                    ? '#52525b'
                                    : `linear-gradient(90deg, ${accent.hex500}, ${accent.hex400})`,
                            }}
                        />
                        <motion.div
                            className="absolute w-2.5 h-2.5 rounded-full pointer-events-none"
                            style={{
                                left: isSystem && sliderMax > 0
                                    ? `calc(${(visualPct / sliderMax) * 100}% - 5px)`
                                    : `calc(${visualPct}% - 5px)`,
                                backgroundColor: isSliderDisabled ? '#71717a' : accent.hex400,
                                boxShadow: isSliderDisabled ? 'none' : `0 0 0 2px ${accent.hex500}20`,
                            }}
                            animate={{scale: hovering && !isSliderDisabled ? 1.3 : 1}}
                            transition={{duration: 0.15}}
                        />
                    </>
                )}
                <input
                    type="range"
                    min="0"
                    max={isSystem ? String(sliderMax) : "1"}
                    step={isSystem ? "1" : "0.01"}
                    disabled={isSliderDisabled}
                    value={showSlider ? (isSystem ? visualPct : volume) : 0}
                    onChange={onSliderChange}
                    className={`absolute inset-0 w-full h-full opacity-0 z-10 ${isSliderDisabled ? "cursor-not-allowed" : "cursor-pointer"
                        }`}
                />
            </div>

            {/* Increase button (+) or Reset button */}
            {showResetButton ? (
                <motion.button
                    {...volumeHover}
                    onClick={onResetToLimit}
                    whileHover={{scale: 1.1}}
                    whileTap={{scale: 0.9}}
                    className="w-5 h-5 ml-3 -mr-3 flex items-center justify-center rounded text-amber-300 hover:text-amber-100 bg-amber-950/80 hover:bg-amber-900/90 border border-amber-600/60 cursor-pointer transition-colors shadow-xs"
                    title={t(lang, 'volume.resetToLimit', {limit})}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                        <path d="M3 3v5h5" />
                    </svg>
                </motion.button>
            ) : (
                <motion.button
                    {...volumeHover}
                    onClick={() => onStepButton('up')}
                    disabled={isIncreaseDisabled}
                    whileHover={isIncreaseDisabled ? undefined : {scale: 1.05}}
                    whileTap={isIncreaseDisabled ? undefined : {scale: 0.95}}
                    className={increaseBtnClass}
                    title={isIncreaseDisabled ? t(lang, 'volume.increaseDisabled') : t(lang, 'volume.increase')}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 5v14M5 12h14" />
                    </svg>
                </motion.button>
            )}

            <span className="text-[11px] tabular-nums text-right text-white/50 font-medium min-w-[36px]">
                {label}
            </span>
        </div>
    );
}
