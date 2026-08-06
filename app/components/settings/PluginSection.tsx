'use client';

import { useEffect, useState } from 'react';
import { SettingGroup, SettingRow } from './controls';
import { t, type Lang } from '../../lib/translations';
import { getAccent } from '../../lib/colors';
import { useBitPerfectEngine } from '../../hooks/useBitPerfectEngine';
import { getTauri, isBrowserTauri } from '../../lib/homeState';

export default function PluginSection({
    lang,
    accentColor,
    isPlaying,
}: {
    lang: Lang;
    accentColor: string;
    isPlaying: boolean;
}) {
    const accent = getAccent(accentColor);
    const {
        status,
        downloading,
        downloadProgress,
        download,
        cancelDownload,
        installFromFile,
        uninstall,
        refreshStatus,
    } = useBitPerfectEngine();

    const [actionError, setActionError] = useState<string | null>(null);
    const [installingFromFile, setInstallingFromFile] = useState(false);

    const installed = status?.installed === true;

    // Realtime check for plugin status
    useEffect(() => {
        const interval = setInterval(() => {
            refreshStatus();
        }, 3000);
        return () => clearInterval(interval);
    }, [refreshStatus]);

    const handleInstall = async () => {
        setActionError(null);
        try {
            await download();
        } catch (e) {
            const msg = String(e);
            if (!msg.toLowerCase().includes("dibatalkan") && !msg.toLowerCase().includes("cancel")) {
                setActionError(msg);
            }
        }
    };

    const handleCancelDownload = async () => {
        setActionError(null);
        try {
            await cancelDownload();
        } catch {
            // Silently handle cancellation without alert
        }
    };

    const handleInstallFromFile = async () => {
        if (!isBrowserTauri) return;
        setInstallingFromFile(true);
        setActionError(null);
        try {
            const mod = await getTauri();
            const selected = await mod.invoke<string | null>("pick_single_file", {
                title: lang === 'id' ? "Pilih berkas plugin (.exe)" : "Select plugin executable (.exe)",
                filters: [{ name: "Executable", extensions: ["exe"] }],
            });
            if (selected) {
                await installFromFile(selected);
            }
        } catch (e) {
            setActionError((e as Error).message || String(e));
        } finally {
            setInstallingFromFile(false);
        }
    };

    const handleUninstall = async () => {
        setActionError(null);
        try {
            await uninstall();
        } catch (e) {
            setActionError(String(e));
        }
    };

    const sizeMB = status?.size_bytes
        ? `${(status.size_bytes / (1024 * 1024)).toFixed(1)} MB`
        : '';

    const downloadedMB = downloadProgress
        ? (downloadProgress.downloaded / (1024 * 1024)).toFixed(1)
        : '0';

    const totalMB = downloadProgress && downloadProgress.total > 0
        ? (downloadProgress.total / (1024 * 1024)).toFixed(1)
        : '64.2';

    const downloadPct = downloadProgress && downloadProgress.total > 0
        ? Math.min(100, Math.round((downloadProgress.downloaded / downloadProgress.total) * 100))
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

            <SettingGroup title={t(lang, 'audio.bitperfect.plugin.title')}>
                <SettingRow
                    title={
                        <div className="flex items-center gap-2.5">
                            <span className="font-semibold text-zinc-100">{t(lang, 'audio.bitperfect.plugin.title')}</span>
                            {installed ? (
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
                        {!installed ? (
                            downloading ? (
                                <div className="flex flex-col gap-2 items-end">
                                    <div className="flex items-center gap-2">
                                        <div className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-zinc-900 text-zinc-200 border border-zinc-700/60 flex items-center gap-2 select-none shadow-xs">
                                            <div className="w-3.5 h-3.5 rounded-full border-2 border-zinc-400 border-t-transparent animate-spin" />
                                            <span>{t(lang, 'audio.bitperfect.plugin.installing', { pct: downloadPct })}</span>
                                            {downloadProgress && downloadProgress.total > 0 && (
                                                <span className="text-[10px] text-zinc-500 font-mono border-l border-zinc-700/60 pl-2">
                                                    {downloadedMB} / {totalMB} MB
                                                </span>
                                            )}
                                        </div>
                                        <button
                                            onClick={handleCancelDownload}
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
                                        onClick={handleInstallFromFile}
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
                                        onClick={handleInstall}
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
                                onClick={handleUninstall}
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

                {installed && status?.path && (
                    <SettingRow
                        title={t(lang, 'audio.bitperfect.plugin.fileInfo')}
                        description={status.path}
                    >
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-zinc-300 font-mono bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-xl shadow-xs">
                                📦 {sizeMB}
                            </span>
                        </div>
                    </SettingRow>
                )}

                {actionError && (
                    <div className="px-4 py-3 bg-rose-500/10 border-t border-rose-500/20 rounded-b-2xl">
                        <p className="text-xs text-rose-400 flex items-start gap-2 leading-relaxed">
                            <span className="mt-0.5 text-sm">⚠️</span>
                            <span className="flex-1 break-all">{actionError}</span>
                        </p>
                    </div>
                )}
            </SettingGroup>
        </div>
    );
}
