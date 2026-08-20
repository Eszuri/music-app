'use client';

import { useState } from 'react';
import { SettingGroup, SettingRow, ToggleStub, SelectStub } from './controls';
import { t, type Lang } from '../../lib/translations';
import { getAccent } from '../../lib/colors';
import { useWallpaperPlugin } from '../../hooks/useWallpaperPlugin';
import type { WallpaperFitMode, WallpaperEffect, WallpaperTransition } from '../../lib/storage';

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
        setFps,
        setIntensity,
    } = useWallpaperPlugin();

    const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

    const handleFpsChange = async (fpsStr: string) => {
        const val = parseFloat(fpsStr);
        if (!isNaN(val) && val > 0) {
            await setFps(val);
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

    return (
        <div className="space-y-5">
            {/* Live Engine Control Group */}
            <SettingGroup title={t(lang, 'wallpaper.group.controls')}>
                <SettingRow
                    title={
                        <div className="flex items-center gap-2.5">
                            <span className="font-semibold text-zinc-100">
                                {t(lang, 'wallpaper.liveWallpaper.title')}
                            </span>
                            {isEngineRunning ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-xs">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    {t(lang, 'wallpaper.engineState.running')} ({Math.round(engineState.fps)} FPS)
                                </span>
                            ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700/60">
                                    {t(lang, 'wallpaper.engineState.stopped')}
                                </span>
                            )}
                        </div>
                    }
                    description={t(lang, 'wallpaper.liveWallpaper.desc')}
                >
                    <ToggleStub
                        checked={isEngineRunning}
                        onChange={handleToggleEngine}
                        accent={accent}
                    />
                </SettingRow>

                {/* Transition Effect (Pergantian Gambar) */}
                <SettingRow
                    title={t(lang, 'wallpaper.transition.title')}
                    description={t(lang, 'wallpaper.transition.desc')}
                >
                    <SelectStub
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
                    />
                </SettingRow>

                {/* Wallpaper Effect */}
                <SettingRow
                    title={t(lang, 'wallpaper.effect.title')}
                    description={t(lang, 'wallpaper.effect.desc')}
                >
                    <SelectStub
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
                    />
                </SettingRow>

                {/* Wallpaper Fit Mode */}
                <SettingRow
                    title={t(lang, 'wallpaper.fit.title')}
                    description={t(lang, 'wallpaper.fit.desc')}
                >
                    <SelectStub
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
                    />
                </SettingRow>

                {/* Target Frame Rate */}
                <SettingRow
                    title={t(lang, 'wallpaper.fps.title')}
                    description={t(lang, 'wallpaper.fps.desc')}
                >
                    <SelectStub
                        options={[
                            ['15', '15 FPS (Ultra Power Saver)'],
                            ['30', '30 FPS (Standard / Recommended)'],
                            ['60', '60 FPS (Smooth Animation)'],
                            ['120', '120 FPS (High Refresh Rate)'],
                        ]}
                        value={String(Math.round(engineState.fps || 30))}
                        onChange={handleFpsChange}
                        accent={accent}
                        accentColor={accentColor}
                    />
                </SettingRow>

                {/* Shader Intensity */}
                {wallpaperEffect !== 'none' && (
                    <SettingRow
                        title={t(lang, 'wallpaper.intensity.title')}
                        description={t(lang, 'wallpaper.intensity.desc')}
                    >
                        <div className="flex items-center gap-3 min-w-48">
                            <input
                                type="range"
                                min="0"
                                max="2"
                                step="0.1"
                                value={engineState.intensity ?? 1.0}
                                onChange={(e) => handleIntensityChange(parseFloat(e.target.value))}
                                className={`w-32 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-${accentColor}-500`}
                            />
                            <span className="text-xs font-mono text-zinc-300 w-10 text-right">
                                {((engineState.intensity ?? 1.0) * 100).toFixed(0)}%
                            </span>
                        </div>
                    </SettingRow>
                )}
            </SettingGroup>

            {/* General Wallpaper Preferences */}
            <SettingGroup title={t(lang, 'general.group.wallpaper')}>
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
                        <div className="flex items-center gap-2 max-w-65">
                            {defaultWallpaper ? (
                                <div className="text-xs text-zinc-400 font-mono truncate flex-1" title={defaultWallpaper}>
                                    {defaultWallpaper.split('\\').pop()?.split('/').pop()}
                                </div>
                            ) : (
                                <div className="text-xs text-zinc-600 flex-1" />
                            )}
                            <button
                                onClick={onPickWallpaper}
                                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-zinc-200 bg-zinc-800 hover:bg-zinc-700 hover:text-white border border-zinc-700/60 shadow-xs transition-all cursor-pointer shrink-0 active:scale-[0.98]"
                            >
                                {defaultWallpaper ? t(lang, 'general.wallpaperDefault.changeBtn') : t(lang, 'general.wallpaperDefault.setBtn')}
                            </button>
                            {defaultWallpaper && onClearWallpaper && (
                                <button
                                    onClick={onClearWallpaper}
                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 shadow-xs transition-all cursor-pointer shrink-0 active:scale-[0.98]"
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
