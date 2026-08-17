'use client';

import { useEffect, useState } from 'react';
import { SettingGroup, SettingRow } from './controls';
import { t, type Lang } from '../../lib/translations';
import { getAccent } from '../../lib/colors';
import { useBitPerfectEngine } from '../../hooks/useBitPerfectEngine';
import { useAiLyricsPlugin } from '../../hooks/useAiLyricsPlugin';
import { useEqualizerPlugin } from '../../hooks/useEqualizerPlugin';
import { useTagEditorPlugin } from '../../hooks/useTagEditorPlugin';
import { getTauri, isBrowserTauri } from '../../lib/homeState';

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
    setOutputMode?: (v: 'default' | 'bitperfect') => void;
    setOutputDevice?: (v: string | null) => void;
}) {
    const accent = getAccent(accentColor);

    // Plugin 1: Bit-Perfect Engine
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

    // Plugin 3: Equalizer DSP Engine
    const {
        status: eqStatus,
        downloading: eqDownloading,
        downloadProgress: eqDownloadProgress,
        downloadPlugin: eqDownload,
        cancelDownload: eqCancelDownload,
        installFromFile: eqInstallFromFile,
        uninstall: eqUninstall,
        refreshStatus: eqRefreshStatus,
    } = useEqualizerPlugin();

    // Plugin 4: Tag & Metadata Editor
    const {
        status: tagStatus,
        downloading: tagDownloading,
        downloadProgress: tagDownloadProgress,
        downloadPlugin: tagDownload,
        cancelDownload: tagCancelDownload,
        installFromFile: tagInstallFromFile,
        uninstall: tagUninstall,
        refreshStatus: tagRefreshStatus,
    } = useTagEditorPlugin();

    const [bitActionError, setBitActionError] = useState<string | null>(null);
    const [aiActionError, setAiActionError] = useState<string | null>(null);
    const [eqActionError, setEqActionError] = useState<string | null>(null);
    const [tagActionError, setTagActionError] = useState<string | null>(null);
    const [installingFromFile, setInstallingFromFile] = useState(false);

    const bitInstalled = bitStatus?.installed === true;
    const aiInstalled = aiStatus?.installed === true;
    const eqInstalled = eqStatus?.installed === true;
    const tagInstalled = tagStatus?.installed === true;

    // Realtime check for plugin statuses
    useEffect(() => {
        const interval = setInterval(() => {
            bitRefreshStatus();
            aiRefreshStatus();
            eqRefreshStatus();
            tagRefreshStatus();
        }, 3000);
        return () => clearInterval(interval);
    }, [bitRefreshStatus, aiRefreshStatus, eqRefreshStatus, tagRefreshStatus]);

    // Bit-Perfect Handlers
    const handleBitInstall = async () => {
        setBitActionError(null);
        try {
            await bitDownload();
        } catch (e) {
            const msg = String(e);
            if (!msg.toLowerCase().includes("dibatalkan") && !msg.toLowerCase().includes("cancel")) {
                setBitActionError(msg);
            }
        }
    };

    const handleBitCancelDownload = async () => {
        setBitActionError(null);
        try {
            await bitCancelDownload();
        } catch {
            // ignore
        }
    };

    const handleBitInstallFromFile = async () => {
        if (!isBrowserTauri()) return;
        setInstallingFromFile(true);
        setBitActionError(null);
        try {
            const mod = await getTauri();
            const selected = await mod.invoke<string | null>("pick_single_file", {
                title: t(lang, 'plugin.selectAudioExeTitle'),
                filters: [{ name: "Executable", extensions: ["exe"] }],
            });
            if (selected) {
                await bitInstallFromFile(selected);
            }
        } catch (e) {
            setBitActionError((e as Error).message || String(e));
        } finally {
            setInstallingFromFile(false);
        }
    };

    const handleBitUninstall = async () => {
        setBitActionError(null);
        try {
            await bitUninstall();
            setOutputMode?.('default');
            setOutputDevice?.(null);
        } catch (e) {
            setBitActionError(String(e));
        }
    };

    // AI Lyrics Handlers
    const handleAiInstall = async () => {
        setAiActionError(null);
        try {
            await aiDownload();
        } catch (e) {
            const msg = String(e);
            if (!msg.toLowerCase().includes("dibatalkan") && !msg.toLowerCase().includes("cancel")) {
                setAiActionError(msg);
            }
        }
    };

    const handleAiInstallFromFile = async () => {
        if (!isBrowserTauri()) return;
        setInstallingFromFile(true);
        setAiActionError(null);
        try {
            await aiInstallFromFile();
        } catch (e) {
            setAiActionError((e as Error).message || String(e));
        } finally {
            setInstallingFromFile(false);
        }
    };

    const handleAiUninstall = async () => {
        setAiActionError(null);
        try {
            await aiUninstall();
        } catch (e) {
            setAiActionError(String(e));
        }
    };

    // Equalizer Handlers
    const handleEqInstall = async () => {
        setEqActionError(null);
        try {
            await eqDownload();
        } catch (e) {
            const msg = String(e);
            if (!msg.toLowerCase().includes("dibatalkan") && !msg.toLowerCase().includes("cancel")) {
                setEqActionError(msg);
            }
        }
    };

    const handleEqCancelDownload = async () => {
        setEqActionError(null);
        try {
            await eqCancelDownload();
        } catch {
            // ignore
        }
    };

    const handleEqInstallFromFile = async () => {
        if (!isBrowserTauri()) return;
        setInstallingFromFile(true);
        setEqActionError(null);
        try {
            const mod = await getTauri();
            const selected = await mod.invoke<string | null>("pick_single_file", {
                title: t(lang, 'plugin.selectEqualizerExeTitle'),
                filters: [{ name: "Executable", extensions: ["exe"] }],
            });
            if (selected) {
                await eqInstallFromFile(selected);
            }
        } catch (e) {
            setEqActionError((e as Error).message || String(e));
        } finally {
            setInstallingFromFile(false);
        }
    };

    const handleEqUninstall = async () => {
        setEqActionError(null);
        try {
            await eqUninstall();
        } catch (e) {
            setEqActionError(String(e));
        }
    };

    // Tag Editor Handlers
    const handleTagInstall = async () => {
        setTagActionError(null);
        try {
            await tagDownload();
        } catch (e) {
            const msg = String(e);
            if (!msg.toLowerCase().includes("dibatalkan") && !msg.toLowerCase().includes("cancel")) {
                setTagActionError(msg);
            }
        }
    };

    const handleTagCancelDownload = async () => {
        setTagActionError(null);
        try {
            await tagCancelDownload();
        } catch {
            // ignore
        }
    };

    const handleTagInstallFromFile = async () => {
        if (!isBrowserTauri()) return;
        setInstallingFromFile(true);
        setTagActionError(null);
        try {
            const mod = await getTauri();
            const selected = await mod.invoke<string | null>("pick_single_file", {
                title: t(lang, 'plugin.selectTagEditorExeTitle'),
                filters: [{ name: "Executable", extensions: ["exe"] }],
            });
            if (selected) {
                await tagInstallFromFile(selected);
            }
        } catch (e) {
            setTagActionError((e as Error).message || String(e));
        } finally {
            setInstallingFromFile(false);
        }
    };

    const handleTagUninstall = async () => {
        setTagActionError(null);
        try {
            await tagUninstall();
        } catch (e) {
            setTagActionError(String(e));
        }
    };

    const bitSizeMB = bitStatus?.size_bytes ? `${(bitStatus.size_bytes / (1024 * 1024)).toFixed(1)} MB` : '';
    const aiSizeMB = aiStatus?.size_bytes ? `${(aiStatus.size_bytes / (1024 * 1024)).toFixed(1)} MB` : '';
    const eqSizeMB = eqStatus?.size ? `${(eqStatus.size / (1024 * 1024)).toFixed(1)} MB` : '';
    const tagSizeMB = tagStatus?.size ? `${(tagStatus.size / (1024 * 1024)).toFixed(1)} MB` : '';

    const bitDownloadPct = bitDownloadProgress && bitDownloadProgress.total > 0
        ? Math.min(100, Math.round((bitDownloadProgress.downloaded / bitDownloadProgress.total) * 100))
        : 0;

    const aiDownloadPct = aiDownloadProgress && aiDownloadProgress.total > 0
        ? Math.min(100, Math.round((aiDownloadProgress.downloaded / aiDownloadProgress.total) * 100))
        : 0;

    const eqDownloadPct = eqDownloadProgress && eqDownloadProgress.total > 0
        ? Math.min(100, Math.round((eqDownloadProgress.downloaded / eqDownloadProgress.total) * 100))
        : 0;

    const tagDownloadPct = tagDownloadProgress && tagDownloadProgress.total > 0
        ? Math.min(100, Math.round((tagDownloadProgress.downloaded / tagDownloadProgress.total) * 100))
        : 0;

    return (
        <div className="space-y-6 pb-6">
            {/* Header Title & Section Badge */}
            <div className="flex items-center gap-3.5 px-1 mb-5">
                <div className="p-2.5 bg-zinc-900/90 rounded-2xl border border-zinc-800/80 shadow-md flex items-center justify-center shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-300">
                        <rect width="7" height="7" x="14" y="3" rx="1.5"/>
                        <path d="M10 21V8a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5a1 1 0 0 0-1-1H3"/>
                    </svg>
                </div>
                <div>
                    <h2 className="text-lg font-bold text-zinc-100 tracking-tight">{t(lang, 'sections.plugin')}</h2>
                    <p className="text-xs text-zinc-400/90 mt-0.5 leading-relaxed">{t(lang, 'plugin.description')}</p>
                </div>
            </div>

            {/* Plugin 1: Bit-Perfect Engine */}
            <SettingGroup title={t(lang, 'audio.bitperfect.plugin.title')}>
                <SettingRow
                    title={
                        <div className="flex items-center gap-2.5">
                            <span className="font-semibold text-zinc-100">{t(lang, 'audio.bitperfect.plugin.title')}</span>
                            {bitInstalled ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-xs">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    {t(lang, 'audio.bitperfect.badge.installed')}
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700/60">
                                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                                    {t(lang, 'audio.bitperfect.badge.notInstalled')}
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
                                            <div className="w-3.5 h-3.5 rounded-full border-2 border-zinc-400 border-t-transparent animate-spin" />
                                            <span>{t(lang, 'audio.bitperfect.plugin.installing', { pct: bitDownloadPct })}</span>
                                        </div>
                                        <button
                                            onClick={handleBitCancelDownload}
                                            className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <line x1="18" y1="6" x2="6" y2="18"/>
                                                <line x1="6" y1="6" x2="18" y2="18"/>
                                            </svg>
                                            <span>{t(lang, 'audio.bitperfect.plugin.cancel')}</span>
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
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
                                            <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
                                            <path d="M14 2v4a1 1 0 0 0 1 1h4"/>
                                        </svg>
                                        <span>{t(lang, 'audio.bitperfect.plugin.installFromFile')}</span>
                                    </button>
                                    <button
                                        onClick={handleBitInstall}
                                        disabled={installingFromFile}
                                        className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl ${accent.bg500} text-white hover:opacity-95 transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95`}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                            <polyline points="7 10 12 15 17 10"/>
                                            <line x1="12" y1="15" x2="12" y2="3"/>
                                        </svg>
                                        <span>{t(lang, 'audio.bitperfect.plugin.install')}</span>
                                    </button>
                                </div>
                            )
                        ) : (
                            <button
                                onClick={handleBitUninstall}
                                disabled={isPlaying}
                                title={isPlaying ? t(lang, 'audio.bitperfect.plugin.uninstall.disabledPlaying') : ''}
                                className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 shadow-xs active:scale-95"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="3 6 5 6 21 6"/>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                </svg>
                                <span>{t(lang, 'audio.bitperfect.plugin.uninstall')}</span>
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
                            <span className="flex-1 break-all">{bitActionError}</span>
                        </p>
                    </div>
                )}
            </SettingGroup>

            {/* Plugin 2: Local AI Lyrics Generator */}
            <SettingGroup title={t(lang, 'lyrics.aiPlugin.title')}>
                <SettingRow
                    title={
                        <div className="flex items-center gap-2.5">
                            <span className="font-semibold text-zinc-100">{t(lang, 'lyrics.aiPlugin.title')}</span>
                            {aiInstalled ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-xs">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    {t(lang, 'audio.bitperfect.badge.installed')}
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700/60">
                                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                                    {t(lang, 'audio.bitperfect.badge.notInstalled')}
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
                                            <div className="w-3.5 h-3.5 rounded-full border-2 border-purple-400 border-t-transparent animate-spin" />
                                            <span>{t(lang, 'audio.bitperfect.plugin.installing', { pct: aiDownloadPct })}</span>
                                        </div>
                                        <button
                                            onClick={() => aiCancelDownload()}
                                            className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                                        >
                                            <span>{t(lang, 'audio.bitperfect.plugin.cancel')}</span>
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
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
                                            <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
                                            <path d="M14 2v4a1 1 0 0 0 1 1h4"/>
                                        </svg>
                                        <span>{t(lang, 'audio.bitperfect.plugin.installFromFile')}</span>
                                    </button>
                                    <button
                                        onClick={handleAiInstall}
                                        disabled={installingFromFile}
                                        className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl ${accent.bg500} text-white hover:opacity-95 transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95`}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                            <polyline points="7 10 12 15 17 10"/>
                                            <line x1="12" y1="15" x2="12" y2="3"/>
                                        </svg>
                                        <span>{t(lang, 'audio.bitperfect.plugin.install')}</span>
                                    </button>
                                </div>
                            )
                        ) : (
                            <button
                                onClick={handleAiUninstall}
                                disabled={aiIsGenerating}
                                title={aiIsGenerating ? t(lang, 'lyrics.aiPlugin.uninstall.disabledGenerating') : ''}
                                className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 shadow-xs active:scale-95"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="3 6 5 6 21 6"/>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                </svg>
                                <span>{t(lang, 'audio.bitperfect.plugin.uninstall')}</span>
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
                            <span className="flex-1 break-all">{aiActionError}</span>
                        </p>
                    </div>
                )}
            </SettingGroup>

            {/* Plugin 3: Equalizer Audio DSP Engine */}
            <SettingGroup title={t(lang, 'plugin.equalizer.title')}>
                <SettingRow
                    title={
                        <div className="flex items-center gap-2.5">
                            <span className="font-semibold text-zinc-100">{t(lang, 'plugin.equalizer.title')}</span>
                            {eqInstalled ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-xs">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    {t(lang, 'plugin.equalizer.badge.installed')}
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700/60">
                                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                                    {t(lang, 'plugin.equalizer.badge.notInstalled')}
                                </span>
                            )}
                        </div>
                    }
                    description={t(lang, 'plugin.equalizer.desc')}
                >
                    <div className="flex flex-col gap-2.5 items-end">
                        {!eqInstalled ? (
                            eqDownloading ? (
                                <div className="flex flex-col gap-2 items-end">
                                    <div className="flex items-center gap-2">
                                        <div className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-zinc-900 text-zinc-200 border border-zinc-700/60 flex items-center gap-2 select-none shadow-xs">
                                            <div className="w-3.5 h-3.5 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
                                            <span>{t(lang, 'plugin.equalizer.installing', { pct: eqDownloadPct })}</span>
                                        </div>
                                        <button
                                            onClick={handleEqCancelDownload}
                                            className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                                        >
                                            <span>{t(lang, 'plugin.equalizer.cancel')}</span>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleEqInstallFromFile}
                                        disabled={installingFromFile}
                                        className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/60 transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shadow-xs active:scale-95"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
                                            <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
                                            <path d="M14 2v4a1 1 0 0 0 1 1h4"/>
                                        </svg>
                                        <span>{t(lang, 'plugin.equalizer.installFromFile')}</span>
                                    </button>
                                    <button
                                        onClick={handleEqInstall}
                                        disabled={installingFromFile}
                                        className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl ${accent.bg500} text-white hover:opacity-95 transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95`}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                            <polyline points="7 10 12 15 17 10"/>
                                            <line x1="12" y1="15" x2="12" y2="3"/>
                                        </svg>
                                        <span>{t(lang, 'plugin.equalizer.install')}</span>
                                    </button>
                                </div>
                            )
                        ) : (
                            <button
                                onClick={handleEqUninstall}
                                className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/25 transition-all cursor-pointer flex items-center gap-1.5 shadow-xs active:scale-95"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="3 6 5 6 21 6"/>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                </svg>
                                <span>{t(lang, 'plugin.equalizer.uninstall')}</span>
                            </button>
                        )}
                    </div>
                </SettingRow>

                {eqInstalled && eqStatus?.path && (
                    <SettingRow
                        title={t(lang, 'plugin.equalizer.fileInfo')}
                        description={eqStatus.path}
                    >
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-zinc-300 font-mono bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-xl shadow-xs">
                                📦 {eqSizeMB}
                            </span>
                        </div>
                    </SettingRow>
                )}

                {eqActionError && (
                    <div className="px-4 py-3 bg-rose-500/10 border-t border-rose-500/20 rounded-b-2xl">
                        <p className="text-xs text-rose-400 flex items-start gap-2 leading-relaxed">
                            <span className="mt-0.5 text-sm">⚠️</span>
                            <span className="flex-1 break-all">{eqActionError}</span>
                        </p>
                    </div>
                )}
            </SettingGroup>

            {/* Plugin 4: Tag & Metadata Editor */}
            <SettingGroup title={t(lang, 'plugin.tagEditor.title')}>
                <SettingRow
                    title={
                        <div className="flex items-center gap-2.5">
                            <span className="font-semibold text-zinc-100">{t(lang, 'plugin.tagEditor.title')}</span>
                            {tagInstalled ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-xs">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    {t(lang, 'plugin.tagEditor.badge.installed')}
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700/60">
                                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                                    {t(lang, 'plugin.tagEditor.badge.notInstalled')}
                                </span>
                            )}
                        </div>
                    }
                    description={t(lang, 'plugin.tagEditor.desc')}
                >
                    <div className="flex flex-col gap-2.5 items-end">
                        {!tagInstalled ? (
                            tagDownloading ? (
                                <div className="flex flex-col gap-2 items-end">
                                    <div className="flex items-center gap-2">
                                        <div className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-zinc-900 text-zinc-200 border border-zinc-700/60 flex items-center gap-2 select-none shadow-xs">
                                            <div className="w-3.5 h-3.5 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
                                            <span>{t(lang, 'plugin.tagEditor.installing', { pct: tagDownloadPct })}</span>
                                        </div>
                                        <button
                                            onClick={handleTagCancelDownload}
                                            className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                                        >
                                            <span>{t(lang, 'plugin.tagEditor.cancel')}</span>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleTagInstallFromFile}
                                        disabled={installingFromFile}
                                        className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/60 transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shadow-xs active:scale-95"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
                                            <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
                                            <path d="M14 2v4a1 1 0 0 0 1 1h4"/>
                                        </svg>
                                        <span>{t(lang, 'plugin.tagEditor.installFromFile')}</span>
                                    </button>
                                    <button
                                        onClick={handleTagInstall}
                                        disabled={installingFromFile}
                                        className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl ${accent.bg500} text-white hover:opacity-95 transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95`}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                            <polyline points="7 10 12 15 17 10"/>
                                            <line x1="12" y1="15" x2="12" y2="3"/>
                                        </svg>
                                        <span>{t(lang, 'plugin.tagEditor.install')}</span>
                                    </button>
                                </div>
                            )
                        ) : (
                            <button
                                onClick={handleTagUninstall}
                                className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/25 transition-all cursor-pointer flex items-center gap-1.5 shadow-xs active:scale-95"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="3 6 5 6 21 6"/>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                </svg>
                                <span>{t(lang, 'plugin.tagEditor.uninstall')}</span>
                            </button>
                        )}
                    </div>
                </SettingRow>

                {tagInstalled && tagStatus?.path && (
                    <SettingRow
                        title={t(lang, 'plugin.tagEditor.fileInfo')}
                        description={tagStatus.path}
                    >
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-zinc-300 font-mono bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-xl shadow-xs">
                                📦 {tagSizeMB}
                            </span>
                        </div>
                    </SettingRow>
                )}

                {tagActionError && (
                    <div className="px-4 py-3 bg-rose-500/10 border-t border-rose-500/20 rounded-b-2xl">
                        <p className="text-xs text-rose-400 flex items-start gap-2 leading-relaxed">
                            <span className="mt-0.5 text-sm">⚠️</span>
                            <span className="flex-1 break-all">{tagActionError}</span>
                        </p>
                    </div>
                )}
            </SettingGroup>
        </div>
    );
}
