'use client';

import { useEffect, useState } from 'react';
import { SettingGroup, SettingRow } from './controls';
import { t, type Lang } from '../../lib/translations';
import { getAccent } from '../../lib/colors';
import { useBitPerfectEngine } from '../../hooks/useBitPerfectEngine';
import { useAiLyricsPlugin } from '../../hooks/useAiLyricsPlugin';
import { useWallpaperPlugin } from '../../hooks/useWallpaperPlugin';
import { getTauri, isBrowserTauri } from '../../lib/homeState';
import type {OutputMode} from '../../lib/storage';

export default function PluginSection({
    lang,
    accentColor,
    isPlaying,
    setOutputMode,
    setOutputDevice,
}: {
    lang: Lang;
    accentColor: string;
    isPlaying: boolean;
    setOutputMode?: (v: OutputMode) => void;
    setOutputDevice?: (v: string | null) => void;
}) {
    const accent = getAccent(accentColor);

    // Plugin 1: Unified Audio Engine (WASAPI Exclusive, Equalizer DSP, Tag Editor)
    const {
        status: bitStatus,
        downloading: bitDownloading,
        downloadProgress: bitDownloadProgress,
        download: bitDownload,
        cancelDownload: bitCancelDownload,
        installFromFile: bitInstallFromFile,
        uninstall: bitUninstall,
        refreshStatus: bitRefreshStatus,
    } = useBitPerfectEngine();

    // Plugin 2: AI Lyrics Generator
    const {
        pluginStatus: aiStatus,
        isDownloading: aiDownloading,
        downloadProgress: aiDownloadProgress,
        isGenerating: aiIsGenerating,
        downloadPlugin: aiDownload,
        cancelDownloadPlugin: aiCancelDownload,
        installFromFile: aiInstallFromFile,
        uninstallPlugin: aiUninstall,
        refreshStatus: aiRefreshStatus,
    } = useAiLyricsPlugin();

    // Plugin 3: Standalone Wallpaper Engine
    const {
        pluginStatus: wallpaperStatus,
        isDownloading: wallpaperDownloading,
        downloadProgress: wallpaperDownloadProgress,
        isEngineRunning: isWallpaperEngineRunning,
        downloadPlugin: wallpaperDownload,
        cancelDownloadPlugin: wallpaperCancelDownload,
        installFromFile: wallpaperInstallFromFile,
        uninstallPlugin: wallpaperUninstall,
        refreshStatus: wallpaperRefreshStatus,
    } = useWallpaperPlugin();

    const [bitActionError, setBitActionError] = useState<string | null>(null);
    const [aiActionError, setAiActionError] = useState<string | null>(null);
    const [wallpaperActionError, setWallpaperActionError] = useState<string | null>(null);
    const [installingFromFile, setInstallingFromFile] = useState(false);

    const bitInstalled = bitStatus?.installed === true;
    const aiInstalled = aiStatus?.installed === true;
    const wallpaperInstalled = wallpaperStatus?.installed === true;

    // Realtime check for plugin statuses
    useEffect(() => {
        const interval = setInterval(() => {
            bitRefreshStatus();
            aiRefreshStatus();
            wallpaperRefreshStatus();
        }, 3000);
        return () => clearInterval(interval);
    }, [bitRefreshStatus, aiRefreshStatus, wallpaperRefreshStatus]);

    // Bit-Perfect Unified Engine Handlers
    const handleBitInstall = async () => {
        setBitActionError(null);
        try {
            await bitDownload();
        } catch (err: unknown) {
            setBitActionError(err instanceof Error ? err.message : String(err));
        }
    };

    const handleBitCancelDownload = () => {
        bitCancelDownload();
    };

    const handleBitInstallFromFile = async () => {
        setBitActionError(null);
        if (!isBrowserTauri()) return;
        setInstallingFromFile(true);
        try {
            const mod = await getTauri();
            const selected = await mod.invoke<string | null>('pick_single_file', {
                title: t(lang, 'audio.bitperfect.plugin.installFromFile.desc'),
                filters: [{ name: 'Executable Plugin', extensions: ['exe'] }],
            });
            if (typeof selected === 'string' && selected.length > 0) {
                await bitInstallFromFile(selected);
            }
        } catch (err: unknown) {
            setBitActionError(err instanceof Error ? err.message : String(err));
        } finally {
            setInstallingFromFile(false);
        }
    };

    const handleBitUninstall = async () => {
        if (isPlaying) return;
        setBitActionError(null);
        try {
            await bitUninstall();
            if (setOutputMode) setOutputMode('html_audio');
            if (setOutputDevice) setOutputDevice(null);
            if (isBrowserTauri()) {
                const mod = await getTauri();
                await mod.invoke('set_app_config_key', {
                    key: 'output_mode',
                    value: 'html_audio',
                });
                await mod.invoke('set_app_config_key', {
                    key: 'output_device',
                    value: null,
                });
            }
        } catch (err: unknown) {
            setBitActionError(err instanceof Error ? err.message : String(err));
        }
    };

    // AI Lyrics Handlers
    const handleAiInstall = async () => {
        setAiActionError(null);
        try {
            await aiDownload();
        } catch (err: unknown) {
            setAiActionError(err instanceof Error ? err.message : String(err));
        }
    };

    const handleAiCancelDownload = () => {
        aiCancelDownload();
    };

    const handleAiInstallFromFile = async () => {
        setAiActionError(null);
        if (!isBrowserTauri()) return;
        setInstallingFromFile(true);
        try {
            const mod = await getTauri();
            const selected = await mod.invoke<string | null>('pick_single_file', {
                title: t(lang, 'audio.bitperfect.plugin.installFromFile.desc'),
                filters: [{ name: 'Executable Plugin', extensions: ['exe'] }],
            });
            if (typeof selected === 'string' && selected.length > 0) {
                await aiInstallFromFile(selected);
            }
        } catch (err: unknown) {
            setAiActionError(err instanceof Error ? err.message : String(err));
        } finally {
            setInstallingFromFile(false);
        }
    };

    const handleAiUninstall = async () => {
        if (aiIsGenerating) return;
        setAiActionError(null);
        try {
            await aiUninstall();
        } catch (err: unknown) {
            setAiActionError(err instanceof Error ? err.message : String(err));
        }
    };

    // Wallpaper Engine Handlers
    const handleWallpaperInstall = async () => {
        setWallpaperActionError(null);
        try {
            await wallpaperDownload();
        } catch (err: unknown) {
            setWallpaperActionError(err instanceof Error ? err.message : String(err));
        }
    };

    const handleWallpaperCancelDownload = () => {
        wallpaperCancelDownload();
    };

    const handleWallpaperInstallFromFile = async () => {
        setWallpaperActionError(null);
        if (!isBrowserTauri()) return;
        setInstallingFromFile(true);
        try {
            const mod = await getTauri();
            const selected = await mod.invoke<string | null>('pick_single_file', {
                title: t(lang, 'wallpaper.plugin.installFromFile'),
                filters: [{ name: 'Executable Plugin', extensions: ['exe'] }],
            });
            if (typeof selected === 'string' && selected.length > 0) {
                await wallpaperInstallFromFile(selected);
            }
        } catch (err: unknown) {
            setWallpaperActionError(err instanceof Error ? err.message : String(err));
        } finally {
            setInstallingFromFile(false);
        }
    };

    const handleWallpaperUninstall = async () => {
        setWallpaperActionError(null);
        try {
            await wallpaperUninstall();
        } catch (err: unknown) {
            setWallpaperActionError(err instanceof Error ? err.message : String(err));
        }
    };

    const bitDownloadPct =
        bitDownloadProgress && bitDownloadProgress.total > 0
            ? Math.round(
                  (bitDownloadProgress.downloaded /
                      bitDownloadProgress.total) *
                      100
              )
            : 0;

    const aiDownloadPct =
        aiDownloadProgress && aiDownloadProgress.total > 0
            ? Math.round(
                  (aiDownloadProgress.downloaded / aiDownloadProgress.total) *
                      100
              )
            : 0;

    const wallpaperDownloadPct =
        wallpaperDownloadProgress && wallpaperDownloadProgress.total > 0
            ? Math.round(
                  (wallpaperDownloadProgress.downloaded / wallpaperDownloadProgress.total) * 100
              )
            : 0;

    const bitSizeMB = bitStatus?.size_bytes
        ? `${(bitStatus.size_bytes / (1024 * 1024)).toFixed(1)} MB`
        : '~34 MB';

    const aiSizeMB = aiStatus?.size_bytes
        ? `${(aiStatus.size_bytes / (1024 * 1024)).toFixed(1)} MB`
        : '~46 MB';

    const wallpaperSizeMB = wallpaperStatus?.size_bytes
        ? `${(wallpaperStatus.size_bytes / (1024 * 1024)).toFixed(1)} MB`
        : '~1.5 MB';

    return (
        <div className="flex flex-col gap-6">
            {/* Plugin 1: Unified Audio Engine */}
            <SettingGroup title={t(lang, 'audio.bitperfect.plugin.title')}>
                <SettingRow
                    title={
                        <div className="flex items-center gap-2.5">
                            <span className="font-semibold text-zinc-100">
                                {t(lang, 'audio.bitperfect.plugin.title')}
                            </span>
                            {bitInstalled ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-xs">
                                    {t(lang, 'audio.bitperfect.plugin.installed', {
                                        size: bitSizeMB,
                                    })}
                                </span>
                            ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700/60">
                                    {t(
                                        lang,
                                        'audio.bitperfect.plugin.notInstalled'
                                    )}
                                </span>
                            )}
                        </div>
                    }
                    description={t(lang, 'audio.bitperfect.plugin.desc')}
                >
                    <div className="flex flex-col gap-2.5 items-end">
                        {!bitInstalled ? (
                            bitDownloading ? (
                                <div className="flex flex-col gap-2 items-end">
                                    <div className="flex items-center gap-2">
                                        <div className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-zinc-900 text-zinc-200 border border-zinc-700/60 flex items-center gap-2 select-none shadow-xs">
                                            <div className="w-3.5 h-3.5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
                                            <span>
                                                {t(
                                                    lang,
                                                    'audio.bitperfect.plugin.installing',
                                                    { pct: bitDownloadPct }
                                                )}
                                            </span>
                                        </div>
                                        <button
                                            onClick={handleBitCancelDownload}
                                            className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                                        >
                                            <span>
                                                {t(
                                                    lang,
                                                    'audio.bitperfect.plugin.cancel'
                                                )}
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleBitInstallFromFile}
                                        disabled={installingFromFile}
                                        className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/60 transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shadow-xs active:scale-95"
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            width="14"
                                            height="14"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            className="text-zinc-400"
                                        >
                                            <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                                            <path d="M14 2v4a1 1 0 0 0 1 1h4" />
                                        </svg>
                                        <span>
                                            {t(
                                                lang,
                                                'audio.bitperfect.plugin.installFromFile'
                                            )}
                                        </span>
                                    </button>
                                    <button
                                        onClick={handleBitInstall}
                                        disabled={installingFromFile}
                                        className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl ${accent.bg500} text-white hover:opacity-95 transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95`}
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            width="14"
                                            height="14"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                            <polyline points="7 10 12 15 17 10" />
                                            <line x1="12" y1="15" x2="12" y2="3" />
                                        </svg>
                                        <span>
                                            {t(
                                                lang,
                                                'audio.bitperfect.plugin.install'
                                            )}
                                        </span>
                                    </button>
                                </div>
                            )
                        ) : (
                            <button
                                onClick={handleBitUninstall}
                                disabled={isPlaying}
                                title={
                                    isPlaying
                                        ? t(
                                              lang,
                                              'audio.bitperfect.plugin.uninstall.disabledPlaying'
                                          )
                                        : ''
                                }
                                className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 shadow-xs active:scale-95"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                                <span>
                                    {t(
                                        lang,
                                        'audio.bitperfect.plugin.uninstall'
                                    )}
                                </span>
                            </button>
                        )}
                    </div>
                </SettingRow>

                {bitInstalled && bitStatus?.path && (
                    <SettingRow
                        title={t(lang, 'audio.bitperfect.plugin.fileInfo')}
                        description={bitStatus.path}
                    >
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-zinc-300 font-mono bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-xl shadow-xs">
                                📦 {bitSizeMB}
                            </span>
                        </div>
                    </SettingRow>
                )}

                {bitActionError && (
                    <div className="px-4 py-3 bg-rose-500/10 border-t border-rose-500/20 rounded-b-2xl">
                        <p className="text-xs text-rose-400 flex items-start gap-2 leading-relaxed">
                            <span className="mt-0.5 text-sm">⚠️</span>
                            <span className="flex-1 break-all">
                                {bitActionError}
                            </span>
                        </p>
                    </div>
                )}
            </SettingGroup>

            {/* Plugin 2: AI Lyrics Generator */}
            <SettingGroup title={t(lang, 'lyrics.aiPlugin.title')}>
                <SettingRow
                    title={
                        <div className="flex items-center gap-2.5">
                            <span className="font-semibold text-zinc-100">
                                {t(lang, 'lyrics.aiPlugin.title')}
                            </span>
                            {aiInstalled ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-xs">
                                    {t(lang, 'audio.bitperfect.plugin.installed', {
                                        size: aiSizeMB,
                                    })}
                                </span>
                            ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700/60">
                                    {t(
                                        lang,
                                        'audio.bitperfect.plugin.notInstalled'
                                    )}
                                </span>
                            )}
                        </div>
                    }
                    description={t(lang, 'lyrics.aiPlugin.desc')}
                >
                    <div className="flex flex-col gap-2.5 items-end">
                        {!aiInstalled ? (
                            aiDownloading ? (
                                <div className="flex flex-col gap-2 items-end">
                                    <div className="flex items-center gap-2">
                                        <div className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-zinc-900 text-zinc-200 border border-zinc-700/60 flex items-center gap-2 select-none shadow-xs">
                                            <div className="w-3.5 h-3.5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
                                            <span>
                                                {t(
                                                    lang,
                                                    'audio.bitperfect.plugin.installing',
                                                    { pct: aiDownloadPct }
                                                )}
                                            </span>
                                        </div>
                                        <button
                                            onClick={handleAiCancelDownload}
                                            className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                                        >
                                            <span>
                                                {t(
                                                    lang,
                                                    'audio.bitperfect.plugin.cancel'
                                                )}
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleAiInstallFromFile}
                                        disabled={installingFromFile}
                                        className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/60 transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shadow-xs active:scale-95"
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            width="14"
                                            height="14"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            className="text-zinc-400"
                                        >
                                            <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                                            <path d="M14 2v4a1 1 0 0 0 1 1h4" />
                                        </svg>
                                        <span>
                                            {t(
                                                lang,
                                                'audio.bitperfect.plugin.installFromFile'
                                            )}
                                        </span>
                                    </button>
                                    <button
                                        onClick={handleAiInstall}
                                        disabled={installingFromFile}
                                        className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl ${accent.bg500} text-white hover:opacity-95 transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95`}
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            width="14"
                                            height="14"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                            <polyline points="7 10 12 15 17 10" />
                                            <line x1="12" y1="15" x2="12" y2="3" />
                                        </svg>
                                        <span>
                                            {t(
                                                lang,
                                                'audio.bitperfect.plugin.install'
                                            )}
                                        </span>
                                    </button>
                                </div>
                            )
                        ) : (
                            <button
                                onClick={handleAiUninstall}
                                disabled={aiIsGenerating}
                                title={
                                    aiIsGenerating
                                        ? t(
                                              lang,
                                              'lyrics.aiPlugin.uninstall.disabledGenerating'
                                          )
                                        : ''
                                }
                                className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 shadow-xs active:scale-95"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                                <span>
                                    {t(
                                        lang,
                                        'audio.bitperfect.plugin.uninstall'
                                    )}
                                </span>
                            </button>
                        )}
                    </div>
                </SettingRow>

                {aiInstalled && aiStatus?.path && (
                    <SettingRow
                        title={t(lang, 'audio.bitperfect.plugin.fileInfo')}
                        description={aiStatus.path}
                    >
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-zinc-300 font-mono bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-xl shadow-xs">
                                📦 {aiSizeMB}
                            </span>
                        </div>
                    </SettingRow>
                )}

                {aiActionError && (
                    <div className="px-4 py-3 bg-rose-500/10 border-t border-rose-500/20 rounded-b-2xl">
                        <p className="text-xs text-rose-400 flex items-start gap-2 leading-relaxed">
                            <span className="mt-0.5 text-sm">⚠️</span>
                            <span className="flex-1 break-all">
                                {aiActionError}
                            </span>
                        </p>
                    </div>
                )}
            </SettingGroup>

            {/* Plugin 3: Standalone Wallpaper Engine */}
            <SettingGroup title={t(lang, 'wallpaper.plugin.title')}>
                <SettingRow
                    title={
                        <div className="flex items-center gap-2.5">
                            <span className="font-semibold text-zinc-100">
                                {t(lang, 'wallpaper.plugin.title')}
                            </span>
                            {wallpaperInstalled ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-xs">
                                    {t(lang, 'audio.bitperfect.plugin.installed', {
                                        size: wallpaperSizeMB,
                                    })}
                                </span>
                            ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700/60">
                                    {t(
                                        lang,
                                        'audio.bitperfect.plugin.notInstalled'
                                    )}
                                </span>
                            )}
                        </div>
                    }
                    description={t(lang, 'wallpaper.plugin.desc')}
                >
                    <div className="flex flex-col gap-2.5 items-end">
                        {!wallpaperInstalled ? (
                            wallpaperDownloading ? (
                                <div className="flex flex-col gap-2 items-end">
                                    <div className="flex items-center gap-2">
                                        <div className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-zinc-900 text-zinc-200 border border-zinc-700/60 flex items-center gap-2 select-none shadow-xs">
                                            <div className="w-3.5 h-3.5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
                                            <span>
                                                {t(
                                                    lang,
                                                    'audio.bitperfect.plugin.installing',
                                                    { pct: wallpaperDownloadPct }
                                                )}
                                            </span>
                                        </div>
                                        <button
                                            onClick={handleWallpaperCancelDownload}
                                            className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                                        >
                                            <span>
                                                {t(
                                                    lang,
                                                    'audio.bitperfect.plugin.cancel'
                                                )}
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleWallpaperInstallFromFile}
                                        disabled={installingFromFile}
                                        className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/60 transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shadow-xs active:scale-95"
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            width="14"
                                            height="14"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            className="text-zinc-400"
                                        >
                                            <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                                            <path d="M14 2v4a1 1 0 0 0 1 1h4" />
                                        </svg>
                                        <span>
                                            {t(
                                                lang,
                                                'audio.bitperfect.plugin.installFromFile'
                                            )}
                                        </span>
                                    </button>
                                    <button
                                        onClick={handleWallpaperInstall}
                                        disabled={installingFromFile}
                                        className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl ${accent.bg500} text-white hover:opacity-95 transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95`}
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            width="14"
                                            height="14"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                            <polyline points="7 10 12 15 17 10" />
                                            <line x1="12" y1="15" x2="12" y2="3" />
                                        </svg>
                                        <span>
                                            {t(
                                                lang,
                                                'audio.bitperfect.plugin.install'
                                            )}
                                        </span>
                                    </button>
                                </div>
                            )
                        ) : (
                            <button
                                onClick={handleWallpaperUninstall}
                                disabled={isWallpaperEngineRunning}
                                className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 shadow-xs active:scale-95"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                                <span>
                                    {t(
                                        lang,
                                        'audio.bitperfect.plugin.uninstall'
                                    )}
                                </span>
                            </button>
                        )}
                    </div>
                </SettingRow>

                {wallpaperInstalled && wallpaperStatus?.path && (
                    <SettingRow
                        title={t(lang, 'audio.bitperfect.plugin.fileInfo')}
                        description={wallpaperStatus.path}
                    >
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-zinc-300 font-mono bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-xl shadow-xs">
                                📦 {wallpaperSizeMB}
                            </span>
                        </div>
                    </SettingRow>
                )}

                {wallpaperActionError && (
                    <div className="px-4 py-3 bg-rose-500/10 border-t border-rose-500/20 rounded-b-2xl">
                        <p className="text-xs text-rose-400 flex items-start gap-2 leading-relaxed">
                            <span className="mt-0.5 text-sm">⚠️</span>
                            <span className="flex-1 break-all">
                                {wallpaperActionError}
                            </span>
                        </p>
                    </div>
                )}
            </SettingGroup>
        </div>
    );
}
