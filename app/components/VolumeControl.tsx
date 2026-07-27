'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { getAccent } from '../lib/colors';

interface VolumeControlProps {
    volume: number; // 0.0 to 1.0 (appVolume or systemVolume depending on volumeMode)
    volumeMode: 'app' | 'system';
    systemVolumeSynced: boolean;
    systemMuted: boolean;
    volumeLimit: number;
    handleVolumeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    accentColor: string;
}

function VolumeIcon({ muted, low }: { muted: boolean; low: boolean }) {
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
    return { target: { value: String(value) } } as React.ChangeEvent<HTMLInputElement>;
}

export default function VolumeControl({
    volume,
    volumeMode,
    systemVolumeSynced,
    systemMuted,
    volumeLimit,
    handleVolumeChange,
    accentColor,
}: VolumeControlProps) {
    const accent = getAccent(accentColor);
    const [hovering, setHovering] = useState(false);
    const [prevVolume, setPrevVolume] = useState(volume);

    const isSystem = volumeMode === 'system';
    const pct = Math.round(volume * 100);
    const showSlider = !isSystem || systemVolumeSynced;
    const muted = isSystem ? (systemMuted || pct <= 0) : volume <= 0;
    const low = pct < 50;
    const label = isSystem
        ? systemVolumeSynced ? (muted ? 'Muted' : `${pct}%`) : '–'
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
        if (isSystem) {
            const sysVal = parseFloat(e.target.value);
            handleVolumeChange(makeChangeEvent(sysVal / 100));
        } else {
            handleVolumeChange(e);
        }
    };

    const onStepButton = (direction: 'up' | 'down') => {
        const delta = direction === 'up' ? 0.05 : -0.05;
        let newVol = Math.max(0, Math.min(1, Math.round((volume + delta) * 100) / 100));
        if (direction === 'up' && volumeLimit > 0 && isSystem) {
            if (Math.round(newVol * 100) > volumeLimit) {
                newVol = volumeLimit / 100;
            }
        }
        handleVolumeChange(makeChangeEvent(newVol));
    };

    const btnClass = "w-5 h-5 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60 cursor-pointer transition-colors";

    return (
        <div className="flex items-center gap-2">
            <motion.button
                onClick={toggleMute}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="text-zinc-400 hover:text-zinc-200 cursor-pointer flex items-center justify-center w-7 h-7"
            >
                <VolumeIcon muted={muted} low={low} />
            </motion.button>

            {/* Decrease button */}
            <motion.button
                onClick={() => onStepButton('down')}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={btnClass}
                title="Kurangi volume"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14" />
                </svg>
            </motion.button>

            <div
                className="relative w-40 h-5 flex items-center"
                onMouseEnter={() => setHovering(true)}
                onMouseLeave={() => setHovering(false)}
            >
                <div className="absolute inset-x-0 h-1 rounded-full bg-zinc-800/80" />
                {showSlider && (
                    <>
                        <div
                            className="absolute h-1 rounded-full transition-all duration-75"
                            style={{
                                width: `${isSystem ? pct : volume * 100}%`,
                                background: `linear-gradient(90deg, ${accent.hex500}, ${accent.hex400})`,
                            }}
                        />
                        <motion.div
                            className="absolute w-2.5 h-2.5 rounded-full pointer-events-none"
                            style={{
                                left: `calc(${isSystem ? pct : volume * 100}% - 5px)`,
                                backgroundColor: accent.hex400,
                                boxShadow: `0 0 0 2px ${accent.hex500}20`,
                            }}
                            animate={{ scale: hovering ? 1.3 : 1 }}
                            transition={{ duration: 0.15 }}
                        />
                    </>
                )}
                <input
                    type="range"
                    min="0"
                    max={isSystem ? "100" : "1"}
                    step={isSystem ? "1" : "0.01"}
                    value={showSlider ? (isSystem ? pct : volume) : 0}
                    onChange={onSliderChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
            </div>

            {/* Increase button */}
            <motion.button
                onClick={() => onStepButton('up')}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={btnClass}
                title="Tambah volume"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14M5 12h14" />
                </svg>
            </motion.button>

            <span className="text-[11px] tabular-nums text-right text-zinc-500 font-medium min-w-[36px]">
                {label}
            </span>
        </div>
    );
}
