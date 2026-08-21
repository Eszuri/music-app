'use client';

import {useState} from 'react';
import {motion, AnimatePresence} from 'framer-motion';
import {SettingGroup, SettingRow, ToggleStub, SelectStub} from './controls';
import {t, type Lang} from '../../lib/translations';
import {getAccent} from '../../lib/colors';
import {useWallpaperPlugin} from '../../hooks/useWallpaperPlugin';
import type {WallpaperFitMode, WallpaperEffect, WallpaperTransition} from '../../lib/storage';

interface WallpaperSectionProps {
    lang: Lang;
    accentColor: string;
    autoWallpaper?: boolean;
    setAutoWallpaper?: (v: boolean) => void;
    resetOnClose?: boolean;
    setResetOnClose?: (v: boolean) => void;
    defaultWallpaper?: string | null;
    onPickWallpaper?: () => void;
    onClearWallpaper?: () => void;
    wallpaperFitMode?: WallpaperFitMode;
    setWallpaperFitMode?: (v: WallpaperFitMode) => void;
    wallpaperEffect?: WallpaperEffect;
    setWallpaperEffect?: (v: WallpaperEffect) => void;
    wallpaperTransition?: WallpaperTransition;
    setWallpaperTransition?: (v: WallpaperTransition) => void;
}

export default function WallpaperSection({
    lang,
    accentColor,
    autoWallpaper = true,
    setAutoWallpaper,
    resetOnClose = true,
    setResetOnClose,
    defaultWallpaper,
    onPickWallpaper,
    onClearWallpaper,
    wallpaperFitMode = 'fill',
    setWallpaperFitMode,
    wallpaperEffect = 'none',
    setWallpaperEffect,
    wallpaperTransition = 'fade',
    setWallpaperTransition,
}: WallpaperSectionProps) {
    const accent = getAccent(accentColor);
    const {
        engineState,
        isEngineRunning,
        startEngine,
        stopEngine,
        setFitMode,
        setEffect,
        setTransition,
        setIntensity,
    } = useWallpaperPlugin();

    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [wallpaperMode, setWallpaperMode] = useState<'system' | 'direct3d' | 'both'>('system');

    const handleToggleEngine = async (enabled: boolean) => {
        setErrorMsg(null);
        try {
            if (enabled) {
                await startEngine({
                    fps: engineState.fps || 30,
                    intensity: engineState.intensity ?? 1.0,
                    texturePath: defaultWallpaper || undefined,
                    fitMode: wallpaperFitMode,
                    effect: wallpaperEffect,
                    transition: wallpaperTransition,
                });
            } else {
                await stopEngine();
            }
        } catch (err: unknown) {
            setErrorMsg(err instanceof Error ? err.message : String(err));
        }
    };

    const handleFitModeChange = async (mode: string) => {
        const fit = mode as WallpaperFitMode;
        setWallpaperFitMode?.(fit);
        await setFitMode(mode);
    };

    const handleEffectChange = async (effectStr: string) => {
        const eff = effectStr as WallpaperEffect;
        setWallpaperEffect?.(eff);
        await setEffect(effectStr);
    };

    const handleTransitionChange = async (trStr: string) => {
        const tr = trStr as WallpaperTransition;
        setWallpaperTransition?.(tr);
        await setTransition(trStr);
    };

    const handleIntensityChange = async (val: number) => {
        await setIntensity(val);
    };

    const handleEnableBoth = async () => {
        setAutoWallpaper?.(true);
        if (!isEngineRunning) {
            await handleToggleEngine(true);
        }
    };

    const modeCards: Array<{
        id: 'system' | 'direct3d' | 'both';
        title: string;
        badge: string;
        desc: string;
        icon: (isSelected: boolean) => React.ReactNode;
    }> = [
        {
            id: 'system',
            title: t(lang, 'wallpaper.mode.system'),
            badge: t(lang, 'wallpaper.mode.systemBadge') || 'Native WinAPI',
            desc: t(lang, 'wallpaper.mode.systemSummary') || 'Sinkronisasi cover art lagu ke desktop Windows secara native tanpa beban GPU.',
            icon: (isSelected: boolean) => (
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`transition-colors ${isSelected ? (accent.text400 || 'text-sky-400') : 'text-zinc-400'}`}
                >
                    <rect width="20" height="14" x="2" y="3" rx="2" />
                    <line x1="8" x2="16" y1="21" y2="21" />
                    <line x1="12" x2="12" y1="17" y2="21" />
                </svg>
            ),
        },
        {
            id: 'direct3d',
            title: t(lang, 'wallpaper.mode.direct3d'),
            badge: t(lang, 'wallpaper.mode.direct3dBadge') || 'GPU Accelerated',
            desc: t(lang, 'wallpaper.mode.direct3dSummary') || 'Shader dinamis bertenaga GPU di balik ikon desktop dengan animasi reaktif.',
            icon: (isSelected: boolean) => (
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`transition-colors ${isSelected ? (accent.text400 || 'text-sky-400') : 'text-zinc-400'}`}
                >
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
            ),
        },
        {
            id: 'both',
            title: t(lang, 'wallpaper.mode.both'),
            badge: t(lang, 'wallpaper.mode.bothBadge') || 'Dual Hybrid',
            desc: t(lang, 'wallpaper.mode.bothSummary') || 'Kombinasi wallpaper native desktop dengan rendering dinamis Direct3D 11.',
            icon: (isSelected: boolean) => (
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`transition-colors ${isSelected ? (accent.text400 || 'text-sky-400') : 'text-zinc-400'}`}
                >
                    <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
                    <path d="m22 12.5-8.58 3.91a2 2 0 0 1-1.66 0L2 12.5" />
                    <path d="m22 17.5-8.58 3.91a2 2 0 0 1-1.66 0L2 17.5" />
                </svg>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            {/* Header & Visual Mode Selector Cards */}
            <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <div>
                        <div className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">
                            {t(lang, 'wallpaper.mode.groupTitle')}
                        </div>
                        <p className="text-xs text-zinc-500 mt-0.5">
                            {t(lang, 'wallpaper.mode.desc')}
                        </p>
                    </div>
                </div>

                {/* 3-Column Interactive Visual Mode Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3" role="radiogroup" aria-label={t(lang, 'wallpaper.mode.title')}>
                    {modeCards.map((card) => {
                        const isSelected = wallpaperMode === card.id;
                        const isDirect3dRunning = card.id === 'direct3d' && isEngineRunning;

                        return (
                            <button
                                key={card.id}
                                type="button"
                                role="radio"
                                aria-checked={isSelected}
                                onClick={() => setWallpaperMode(card.id)}
                                style={{
                                    borderColor: isSelected
                                        ? (accent.hex500 || '#38bdf8')
                                        : 'rgba(63, 63, 70, 0.4)',
                                    background: isSelected
                                        ? (accent.hex500
                                            ? `radial-gradient(ellipse at top left, ${accent.hex500}1a, transparent 70%), rgba(24, 24, 27, 0.85)`
                                            : 'rgba(24, 24, 27, 0.9)')
                                        : 'rgba(24, 24, 27, 0.5)',
                                    boxShadow: isSelected && accent.hex500
                                        ? `0 8px 24px -6px ${accent.hex500}30`
                                        : undefined,
                                }}
                                className={`relative p-4 rounded-2xl border text-left flex flex-col justify-between transition-all duration-200 cursor-pointer select-none hover:border-zinc-500/80 hover:bg-zinc-900/80 group active:scale-[0.99] min-h-[135px]`}
                            >
                                {/* Top row: Icon + Badges + Selection indicator */}
                                <div className="flex items-start justify-between gap-2 w-full">
                                    <div
                                        className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-all ${
                                            isSelected
                                                ? 'bg-zinc-900/90 border-zinc-700/80 shadow-xs'
                                                : 'bg-zinc-800/60 border-zinc-700/40 group-hover:bg-zinc-800'
                                        }`}
                                    >
                                        {card.icon(isSelected)}
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                        {card.id === 'direct3d' && (
                                            <span
                                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                                                    isDirect3dRunning
                                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                                        : 'bg-zinc-800 text-zinc-400 border-zinc-700/50'
                                                }`}
                                            >
                                                <span
                                                    className={`w-1.5 h-1.5 rounded-full ${
                                                        isDirect3dRunning
                                                            ? 'bg-emerald-400 shadow-xs shadow-emerald-400 animate-pulse'
                                                            : 'bg-zinc-500'
                                                    }`}
                                                />
                                                {isDirect3dRunning ? 'Active' : 'Standby'}
                                            </span>
                                        )}

                                        <span
                                            className={`px-2 py-0.5 rounded-md text-[10px] font-medium tracking-wide uppercase ${
                                                isSelected
                                                    ? 'bg-white/10 text-zinc-200 border border-white/15'
                                                    : 'bg-zinc-800/80 text-zinc-500 border border-zinc-800'
                                            }`}
                                        >
                                            {card.badge}
                                        </span>
                                    </div>
                                </div>

                                {/* Bottom info */}
                                <div className="mt-3.5 space-y-1">
                                    <div className="flex items-center justify-between">
                                        <div className={`text-sm font-semibold transition-colors ${isSelected ? 'text-white' : 'text-zinc-200 group-hover:text-white'}`}>
                                            {card.title}
                                        </div>
                                        {isSelected && (
                                            <div
                                                className="w-4 h-4 rounded-full flex items-center justify-center text-white"
                                                style={{backgroundColor: accent.hex500 || '#38bdf8'}}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="20 6 9 17 4 12" />
                                                </svg>
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-2">
                                        {card.desc}
                                    </p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Dynamic Content Views */}
            <AnimatePresence mode="wait">
                {/* 1. Mode: Wallpaper Sistem */}
                {wallpaperMode === 'system' && (
                    <motion.div
                        key="mode-system"
                        initial={{opacity: 0, y: 8}}
                        animate={{opacity: 1, y: 0}}
                        exit={{opacity: 0, y: -8}}
                        transition={{duration: 0.2}}
                        className="space-y-4"
                    >
                        <SettingGroup title={t(lang, 'wallpaper.group.system')}>
                            {setAutoWallpaper && (
                                <SettingRow
                                    title={t(lang, 'general.autoWallpaper.title')}
                                    description={t(lang, 'general.autoWallpaper.desc')}
                                >
                                    <ToggleStub checked={autoWallpaper} onChange={setAutoWallpaper} accent={accent} />
                                </SettingRow>
                            )}

                            {onPickWallpaper && (
                                <SettingRow
                                    title={t(lang, 'general.wallpaperDefault.title')}
                                    description={t(lang, 'general.wallpaperDefault.desc')}
                                >
                                    <div className="flex items-center gap-2 max-w-72">
                                        {defaultWallpaper ? (
                                            <div
                                                className="px-2.5 py-1 rounded-lg bg-zinc-800/80 border border-zinc-700/60 text-xs text-zinc-300 font-mono truncate flex-1 flex items-center gap-1.5"
                                                title={defaultWallpaper}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-zinc-400">
                                                    <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
                                                    <circle cx="9" cy="9" r="2"/>
                                                    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                                                </svg>
                                                <span className="truncate">
                                                    {defaultWallpaper.split('\\').pop()?.split('/').pop()}
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="text-xs text-zinc-500 italic flex-1">
                                                {lang === 'id' ? 'Belum ada wallpaper default' : 'No default wallpaper'}
                                            </div>
                                        )}
                                        <button
                                            type="button"
                                            onClick={onPickWallpaper}
                                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-200 bg-zinc-800 hover:bg-zinc-700 hover:text-white border border-zinc-700/60 shadow-xs transition-all cursor-pointer shrink-0 active:scale-[0.98]"
                                        >
                                            {defaultWallpaper ? t(lang, 'general.wallpaperDefault.changeBtn') : t(lang, 'general.wallpaperDefault.setBtn')}
                                        </button>
                                        {defaultWallpaper && onClearWallpaper && (
                                            <button
                                                type="button"
                                                onClick={onClearWallpaper}
                                                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 shadow-xs transition-all cursor-pointer shrink-0 active:scale-[0.98]"
                                            >
                                                {t(lang, 'general.wallpaperDefault.deleteBtn')}
                                            </button>
                                        )}
                                    </div>
                                </SettingRow>
                            )}

                            {setResetOnClose && (
                                <SettingRow
                                    title={t(lang, 'general.resetWallpaper.title')}
                                    description={t(lang, 'general.resetWallpaper.desc')}
                                >
                                    <div className="flex flex-col items-end gap-1">
                                        <ToggleStub checked={resetOnClose} onChange={setResetOnClose} disabled={!defaultWallpaper} accent={accent} />
                                        {!defaultWallpaper && (
                                            <span className="text-[10px] text-zinc-600 whitespace-nowrap">{t(lang, 'general.resetWallpaper.hint')}</span>
                                        )}
                                    </div>
                                </SettingRow>
                            )}
                        </SettingGroup>
                    </motion.div>
                )}

                {/* 2. Mode: Direct3D 11 Live Wallpaper */}
                {wallpaperMode === 'direct3d' && (
                    <motion.div
                        key="mode-direct3d"
                        initial={{opacity: 0, y: 8}}
                        animate={{opacity: 1, y: 0}}
                        exit={{opacity: 0, y: -8}}
                        transition={{duration: 0.2}}
                        className="space-y-4"
                    >
                        {/* Hero Live Engine Status Banner */}
                        <div
                            className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-zinc-900/95 via-zinc-900/80 to-zinc-950/90 border border-zinc-800 shadow-xl transition-all"
                            style={{
                                borderColor: isEngineRunning
                                    ? (accent.hex500 ? `${accent.hex500}44` : '#3f3f46')
                                    : 'rgba(63, 63, 70, 0.35)',
                                boxShadow: isEngineRunning && accent.hex500
                                    ? `0 12px 32px -12px ${accent.hex500}25`
                                    : undefined,
                            }}
                        >
                            {/* Glowing top line */}
                            <div
                                className="h-[2px] w-full transition-opacity duration-300"
                                style={{
                                    opacity: isEngineRunning ? 1 : 0.2,
                                    background: isEngineRunning
                                        ? `linear-gradient(90deg, transparent 0%, ${accent.hex500 || '#6366f1'} 50%, transparent 100%)`
                                        : 'linear-gradient(90deg, transparent 0%, rgba(113, 113, 122, 0.3) 50%, transparent 100%)',
                                }}
                            />

                            <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="space-y-1.5 flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
                                            isEngineRunning
                                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                                : 'bg-zinc-800/80 text-zinc-500 border-zinc-700/40'
                                        }`}>
                                            <span className={`w-2 h-2 rounded-full ${
                                                isEngineRunning
                                                    ? 'bg-emerald-400 shadow-sm shadow-emerald-400 animate-pulse'
                                                    : 'bg-zinc-600'
                                            }`} />
                                            {isEngineRunning
                                                ? (t(lang, 'wallpaper.engine.statusRunning') || 'Sedang Berjalan (Aktif)')
                                                : (t(lang, 'wallpaper.engine.statusStopped') || 'Standby (Nonaktif)')
                                            }
                                        </div>

                                        <span className="text-[11px] text-zinc-500 font-mono tracking-tight">
                                            {t(lang, 'wallpaper.engine.statusSpecs') || 'Direct3D 11.0 • HLSL Shaders • Zero Desktop UI Block'}
                                        </span>
                                    </div>

                                    <div className="text-base font-semibold text-zinc-100">
                                        {t(lang, 'wallpaper.liveWallpaper.title')}
                                    </div>
                                    <p className="text-xs text-zinc-400 max-w-xl leading-relaxed">
                                        {t(lang, 'wallpaper.liveWallpaper.desc')}
                                    </p>
                                </div>

                                <div className="shrink-0 flex items-center gap-3">
                                    <ToggleStub
                                        checked={isEngineRunning}
                                        onChange={handleToggleEngine}
                                        accent={accent}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Detailed Engine Configurations (Disabled & Dimmed when nonaktif) */}
                        <div
                            className={`transition-all duration-300 ${
                                !isEngineRunning
                                    ? 'opacity-35 pointer-events-none select-none grayscale-[30%]'
                                    : 'opacity-100'
                            }`}
                        >
                            <SettingGroup title={t(lang, 'wallpaper.group.enhancement')}>
                                {/* Transisi Pergantian Gambar */}
                                <SettingRow
                                    title={t(lang, 'wallpaper.transition.title')}
                                    description={t(lang, 'wallpaper.transition.desc')}
                                >
                                    <SelectStub
                                        disabled={!isEngineRunning}
                                        options={[
                                            ['fade', t(lang, 'wallpaper.transition.fade')],
                                            ['zoom_in', t(lang, 'wallpaper.transition.zoom_in')],
                                            ['zoom_out', t(lang, 'wallpaper.transition.zoom_out')],
                                            ['slide', t(lang, 'wallpaper.transition.slide')],
                                            ['none', t(lang, 'wallpaper.transition.none')],
                                        ]}
                                        value={wallpaperTransition}
                                        onChange={handleTransitionChange}
                                        accent={accent}
                                        accentColor={accentColor}
                                        className="w-52"
                                    />
                                </SettingRow>

                                {/* Efek Visual Wallpaper */}
                                <SettingRow
                                    title={t(lang, 'wallpaper.effect.title')}
                                    description={t(lang, 'wallpaper.effect.desc')}
                                >
                                    <SelectStub
                                        disabled={!isEngineRunning}
                                        options={[
                                            ['none', t(lang, 'wallpaper.effect.none')],
                                            ['reactive_glow', t(lang, 'wallpaper.effect.reactive_glow')],
                                            ['subtle_pulse', t(lang, 'wallpaper.effect.subtle_pulse')],
                                            ['cinematic_vignette', t(lang, 'wallpaper.effect.cinematic_vignette')],
                                            ['grayscale', t(lang, 'wallpaper.effect.grayscale')],
                                            ['dimmed', t(lang, 'wallpaper.effect.dimmed')],
                                        ]}
                                        value={wallpaperEffect}
                                        onChange={handleEffectChange}
                                        accent={accent}
                                        accentColor={accentColor}
                                        className="w-52"
                                    />
                                </SettingRow>

                                {/* Ukuran & Penyesuaian Wallpaper */}
                                <SettingRow
                                    title={t(lang, 'wallpaper.fit.title')}
                                    description={t(lang, 'wallpaper.fit.desc')}
                                >
                                    <SelectStub
                                        disabled={!isEngineRunning}
                                        options={[
                                            ['fill', t(lang, 'wallpaper.fit.fill')],
                                            ['fit', t(lang, 'wallpaper.fit.fit')],
                                            ['stretch', t(lang, 'wallpaper.fit.stretch')],
                                            ['center', t(lang, 'wallpaper.fit.center')],
                                            ['tile', t(lang, 'wallpaper.fit.tile')],
                                        ]}
                                        value={wallpaperFitMode === 'span' ? 'fill' : wallpaperFitMode}
                                        onChange={handleFitModeChange}
                                        accent={accent}
                                        accentColor={accentColor}
                                        className="w-52"
                                    />
                                </SettingRow>

                                {/* Intensitas Visual Shader */}
                                {wallpaperEffect !== 'none' && (
                                    <SettingRow
                                        title={t(lang, 'wallpaper.intensity.title')}
                                        description={t(lang, 'wallpaper.intensity.desc')}
                                    >
                                        <div className="flex items-center gap-3 min-w-56">
                                            <input
                                                type="range"
                                                min="0"
                                                max="2"
                                                step="0.1"
                                                disabled={!isEngineRunning}
                                                value={engineState.intensity ?? 1.0}
                                                onChange={(e) => handleIntensityChange(parseFloat(e.target.value))}
                                                style={{
                                                    accentColor: accent.hex500 || 'var(--accent-500)',
                                                }}
                                                className="w-36 h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed"
                                            />
                                            <span className="px-2 py-0.5 rounded-md bg-zinc-800 border border-zinc-700/60 text-xs font-mono text-zinc-200 w-12 text-center">
                                                {((engineState.intensity ?? 1.0) * 100).toFixed(0)}%
                                            </span>
                                        </div>
                                    </SettingRow>
                                )}
                            </SettingGroup>
                        </div>
                    </motion.div>
                )}

                {/* 3. Mode: Keduanya (Dual Engine Hybrid Dashboard) */}
                {wallpaperMode === 'both' && (
                    <motion.div
                        key="mode-both"
                        initial={{opacity: 0, y: 8}}
                        animate={{opacity: 1, y: 0}}
                        exit={{opacity: 0, y: -8}}
                        transition={{duration: 0.2}}
                        className="space-y-4"
                    >
                        {/* Dual Engine Architecture Overview */}
                        <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800 p-5 space-y-4">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <div>
                                    <div className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                                        <span>🔀</span>
                                        <span>{t(lang, 'wallpaper.both.heroTitle') || 'Arsitektur Dual Engine'}</span>
                                    </div>
                                    <p className="text-xs text-zinc-400 mt-1 max-w-xl leading-relaxed">
                                        {t(lang, 'wallpaper.both.heroDesc') || 'Jalankan wallpaper sistem bersamaan dengan shader Direct3D 11 untuk pengalaman desktop maksimal.'}
                                    </p>
                                </div>

                                {(!autoWallpaper || !isEngineRunning) ? (
                                    <button
                                        type="button"
                                        onClick={handleEnableBoth}
                                        className="px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all shadow-md cursor-pointer hover:brightness-110 active:scale-[0.98]"
                                        style={{
                                            backgroundColor: accent.hex500 || '#0284c7',
                                            boxShadow: accent.hex500 ? `0 4px 14px 0 ${accent.hex500}40` : undefined,
                                        }}
                                    >
                                        ✨ {t(lang, 'wallpaper.both.enableBoth') || 'Aktifkan Kedua Engine'}
                                    </button>
                                ) : (
                                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                        <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400 animate-pulse" />
                                        {t(lang, 'wallpaper.both.bothActive') || 'Kedua Engine Aktif'}
                                    </div>
                                )}
                            </div>

                            {/* Dual Cards Breakdown */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800/80 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-sky-400" />
                                            {t(lang, 'wallpaper.both.systemCardTitle') || '1. Wallpaper Dasar Native'}
                                        </div>
                                        {setAutoWallpaper && (
                                            <ToggleStub checked={autoWallpaper} onChange={setAutoWallpaper} accent={accent} />
                                        )}
                                    </div>
                                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                                        {t(lang, 'wallpaper.both.systemCardDesc') || 'Mengatur cover art lagu saat ini ke desktop OS Windows & lockscreen secara native.'}
                                    </p>
                                </div>

                                <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800/80 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-indigo-400" />
                                            {t(lang, 'wallpaper.both.directCardTitle') || '2. Layer Direct3D 11 Live'}
                                        </div>
                                        <ToggleStub
                                            checked={isEngineRunning}
                                            onChange={handleToggleEngine}
                                            accent={accent}
                                        />
                                    </div>
                                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                                        {t(lang, 'wallpaper.both.directCardDesc') || 'Memproyeksikan transisi 60 FPS mulus dan shader visualizer audio di atas layar desktop.'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Error message banner */}
            {errorMsg && (
                <div className="px-4 py-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl">
                    <p className="text-xs text-rose-400 flex items-start gap-2 leading-relaxed">
                        <span className="mt-0.5 text-sm">⚠️</span>
                        <span className="flex-1 break-all">{errorMsg}</span>
                    </p>
                </div>
            )}
        </div>
    );
}

