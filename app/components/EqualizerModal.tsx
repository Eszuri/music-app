'use client';

import React, {memo, useEffect} from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import {getAccent} from '../lib/colors';
import {t, type Lang} from '../lib/translations';
import {modalContentMotion, backdropMotion} from '../lib/animations';
import {
    type EQBandMode,
    type EQPresetKey,
    type useEqualizer,
} from '../hooks/useEqualizer';

interface EqualizerModalProps {
    isOpen: boolean;
    onClose: () => void;
    equalizer: ReturnType<typeof useEqualizer>;
    accentColor: string;
    lang: Lang;
}

const BAND_MODE_OPTIONS: EQBandMode[] = [5, 10, 15, 31];

const PRESET_OPTIONS: EQPresetKey[] = [
    'flat',
    'bassBoost',
    'trebleBoost',
    'rock',
    'pop',
    'jazz',
    'classical',
    'electronic',
    'vocal',
    'custom',
];

function EQIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="21" x2="4" y2="14" />
            <line x1="4" y1="10" x2="4" y2="3" />
            <line x1="12" y1="21" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12" y2="3" />
            <line x1="20" y1="21" x2="20" y2="16" />
            <line x1="20" y1="12" x2="20" y2="3" />
            <line x1="1" y1="14" x2="7" y2="14" />
            <line x1="9" y1="8" x2="15" y2="8" />
            <line x1="17" y1="16" x2="23" y2="16" />
        </svg>
    );
}

function PowerIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
            <line x1="12" y1="2" x2="12" y2="12" />
        </svg>
    );
}

function RotateCcwIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
        </svg>
    );
}

function XIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
    );
}

function formatFreqLabel(freqHz: number): string {
    if (freqHz >= 1000) {
        const k = freqHz / 1000;
        return Number.isInteger(k) ? `${k}k` : `${k.toFixed(1)}k`;
    }
    return Number.isInteger(freqHz) ? `${freqHz}` : `${freqHz.toFixed(1)}`;
}

function EqualizerModal({
    isOpen,
    onClose,
    equalizer,
    accentColor,
    lang,
}: EqualizerModalProps) {
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    const accent = getAccent(accentColor);
    const {
        enabled,
        bandMode,
        preampDb,
        preset,
        gains,
        frequencies,
        toggleEnabled,
        setBandMode,
        setPreampDb,
        setPreset,
        setBandGain,
        resetFlat,
    } = equalizer;

    const isCompactMode = bandMode > 15;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    key="eq-backdrop"
                    {...backdropMotion}
                    onClick={onClose}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm cursor-pointer"
                >
                    {/* Modal Box */}
                    <motion.div
                        key="eq-modal"
                        {...modalContentMotion}
                        onClick={(e) => e.stopPropagation()}
                        className={`relative w-full ${bandMode >= 15 ? 'max-w-4xl' : 'max-w-2xl'} bg-zinc-950/95 border border-zinc-800/90 rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-all cursor-default`}
                    >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/40">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl bg-zinc-800/80 ${enabled ? accent.text400 : 'text-zinc-500'}`}>
                            <EQIcon />
                        </div>
                        <div>
                            <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                                {t(lang, 'equalizer.title')}
                                <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700/60 text-zinc-400 font-normal">
                                    {bandMode} Bands
                                </span>
                            </h2>
                            <p className="text-[11px] text-zinc-400">
                                {t(lang, 'equalizer.subtitle')}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Power Switch */}
                        <button
                            onClick={toggleEnabled}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                                enabled
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs shadow-emerald-950'
                                    : 'bg-zinc-800/80 text-zinc-400 border border-zinc-700/60 hover:text-zinc-200'
                            }`}
                        >
                            <PowerIcon />
                            <span>{enabled ? t(lang, 'equalizer.on') : t(lang, 'equalizer.off')}</span>
                        </button>

                        {/* Close Button */}
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 transition-colors cursor-pointer"
                        >
                            <XIcon />
                        </button>
                    </div>
                </div>

                {/* Control Bar: Band Mode, Preamp, Presets & Reset */}
                <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-b border-zinc-800/50 bg-zinc-900/20 text-xs">
                    <div className="flex flex-wrap items-center gap-4">
                        {/* Band Mode Dropdown */}
                        <div className="flex items-center gap-2">
                            <label className="text-zinc-400 font-medium">{t(lang, 'equalizer.bandMode')}:</label>
                            <select
                                value={bandMode}
                                onChange={(e) => setBandMode(parseInt(e.target.value) as EQBandMode)}
                                disabled={!enabled}
                                className="px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700/80 text-zinc-200 font-medium focus:outline-none focus:border-zinc-500 disabled:opacity-50 cursor-pointer"
                            >
                                {BAND_MODE_OPTIONS.map((bm) => (
                                    <option key={bm} value={bm}>
                                        {t(lang, `equalizer.bandMode.${bm}` as any)}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Preset Dropdown */}
                        <div className="flex items-center gap-2">
                            <label className="text-zinc-400 font-medium">{t(lang, 'equalizer.preset')}:</label>
                            <select
                                value={preset}
                                onChange={(e) => setPreset(e.target.value as EQPresetKey)}
                                disabled={!enabled}
                                className="px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700/80 text-zinc-200 font-medium focus:outline-none focus:border-zinc-500 disabled:opacity-50 cursor-pointer"
                            >
                                {PRESET_OPTIONS.map((key) => (
                                    <option key={key} value={key}>
                                        {t(lang, `equalizer.preset.${key}` as any)}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <button
                        onClick={resetFlat}
                        disabled={!enabled}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/60 transition-colors disabled:opacity-50 cursor-pointer ml-auto"
                    >
                        <RotateCcwIcon />
                        <span>{t(lang, 'equalizer.reset')}</span>
                    </button>
                </div>

                {/* Main Sliders View: Preamp + N-Band Grid */}
                <div className={`p-6 flex gap-6 transition-opacity duration-200 ${enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                    {/* Preamp Column */}
                    <div className="flex flex-col items-center shrink-0 pr-4 border-r border-zinc-800/80 h-56">
                        <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider mb-2">
                            {t(lang, 'equalizer.preamp')}
                        </span>
                        <span
                            className={`text-[10px] tabular-nums font-semibold mb-2 ${
                                preampDb > 0
                                    ? 'text-amber-400'
                                    : preampDb < 0
                                    ? 'text-rose-400'
                                    : 'text-zinc-500'
                            }`}
                        >
                            {preampDb > 0 ? `+${preampDb}` : `${preampDb}`} dB
                        </span>

                        <div
                            className="relative flex-1 w-3.5 bg-zinc-900 rounded-full border border-zinc-800/90 flex items-end overflow-hidden cursor-pointer"
                            onDoubleClick={() => setPreampDb(0)}
                            title={`Preamp: ${preampDb > 0 ? '+' : ''}${preampDb} dB (Double-click to reset)`}
                        >
                            <div
                                className="w-full rounded-full transition-all duration-75"
                                style={{
                                    height: `${((preampDb + 12) / 24) * 100}%`,
                                    background:
                                        preampDb > 0
                                            ? 'linear-gradient(0deg, #f59e0b, #d97706)'
                                            : preampDb < 0
                                            ? 'linear-gradient(0deg, #f43f5e, #e11d48)'
                                            : accent.hex500,
                                }}
                            />
                            <input
                                type="range"
                                min="-12"
                                max="12"
                                step="1"
                                value={preampDb}
                                onChange={(e) => setPreampDb(parseFloat(e.target.value))}
                                style={{
                                    writingMode: 'bt-lr',
                                    WebkitAppearance: 'slider-vertical',
                                } as any}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                        </div>

                        <span className="text-[10px] font-bold text-zinc-500 mt-2.5">
                            PRE
                        </span>
                    </div>

                    {/* Band Sliders Container (Scrollable for 31 bands) */}
                    <div className="relative flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-zinc-800">
                        <div className="relative flex items-center justify-between gap-1.5 h-56 min-w-full px-2" style={{minWidth: bandMode === 31 ? '850px' : 'auto'}}>
                            {/* Reference lines: +12dB, 0dB, -12dB */}
                            <div className="absolute inset-x-2 top-0 h-px bg-zinc-800/60 pointer-events-none" />
                            <div className="absolute inset-x-2 top-1/2 h-px bg-zinc-700/50 border-t border-dashed border-zinc-600/40 pointer-events-none" />
                            <div className="absolute inset-x-2 bottom-0 h-px bg-zinc-800/60 pointer-events-none" />

                            {frequencies.map((freqHz, index) => {
                                const db = gains[index] ?? 0;
                                const fillPct = Math.max(0, Math.min(100, ((db + 12) / 24) * 100));

                                return (
                                    <div key={`${bandMode}-${freqHz}`} className="relative flex-1 flex flex-col items-center h-full z-10 min-w-3">
                                        {/* dB Badge */}
                                        <span
                                            className={`tabular-nums font-semibold mb-2 ${isCompactMode ? 'text-[9px]' : 'text-[10px]'} ${
                                                db > 0
                                                    ? 'text-emerald-400'
                                                    : db < 0
                                                    ? 'text-rose-400'
                                                    : 'text-zinc-500'
                                            }`}
                                        >
                                            {db > 0 ? `+${db}` : `${db}`}
                                        </span>

                                        {/* Vertical Slider Track */}
                                        <div
                                            className={`relative flex-1 ${isCompactMode ? 'w-2.5' : 'w-3.5'} bg-zinc-900 rounded-full border border-zinc-800/90 flex items-end overflow-hidden cursor-pointer group`}
                                            onDoubleClick={() => setBandGain(index, 0)}
                                            title={`${formatFreqLabel(freqHz)} Hz: ${db > 0 ? '+' : ''}${db} dB (Double-click to reset)`}
                                        >
                                            <div
                                                className="w-full rounded-full transition-all duration-75"
                                                style={{
                                                    height: `${fillPct}%`,
                                                    background:
                                                        db > 0
                                                            ? 'linear-gradient(0deg, #22c55e, #10b981)'
                                                            : db < 0
                                                            ? 'linear-gradient(0deg, #f43f5e, #e11d48)'
                                                            : accent.hex500,
                                                }}
                                            />
                                            <input
                                                type="range"
                                                min="-12"
                                                max="12"
                                                step="1"
                                                value={db}
                                                onChange={(e) => setBandGain(index, parseFloat(e.target.value))}
                                                style={{
                                                    writingMode: 'bt-lr',
                                                    WebkitAppearance: 'slider-vertical',
                                                } as any}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            />
                                        </div>

                                        {/* Frequency Label */}
                                        <span className={`font-medium text-zinc-400 mt-2.5 truncate max-w-full ${isCompactMode ? 'text-[9px]' : 'text-[11px]'}`}>
                                            {formatFreqLabel(freqHz)}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Footer Tip */}
                <div className="px-6 py-3 border-t border-zinc-800/60 bg-zinc-900/30 flex items-center justify-between text-[11px] text-zinc-500">
                    <span>{t(lang, 'equalizer.tip')}</span>
                    <button
                        onClick={onClose}
                        className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium transition-colors cursor-pointer"
                    >
                        {t(lang, 'equalizer.done')}
                    </button>
                </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

export default memo(EqualizerModal);
