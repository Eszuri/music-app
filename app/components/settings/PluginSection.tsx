'use client';

import {useCallback, useEffect, useState} from 'react';
import {SettingGroup, SettingRow} from './controls';
import {t, type Lang} from '../../lib/translations';
import {getAccent} from '../../lib/colors';
import {useBitPerfectEngine} from '../../hooks/useBitPerfectEngine';
import {getTauri, isBrowserTauri} from '../../lib/homeState';

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

    // Realtime check for plugin missing
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
                title: "Pilih file plugin (.exe)",
                filters: [{name: "Executable", extensions: ["exe"]}],
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

    const downloadPct = downloadProgress && downloadProgress.total > 0
        ? Math.min(100, Math.round((downloadProgress.downloaded / downloadProgress.total) * 100))
        : 0;

    return (
        <div className="space-y-6 pb-6">
            <div className="flex items-center gap-3 px-1 mb-4">
                <div className="p-2 bg-zinc-900 rounded-xl border border-zinc-800">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
                        <rect width="7" height="7" x="14" y="3" rx="1"/>
                        <path d="M10 21V8a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5a1 1 0 0 0-1-1H3"/>
                    </svg>
                </div>
                <div>
                    <h2 className="text-lg font-bold text-zinc-100">{t(lang, 'sections.plugin') || 'Plugin Manager'}</h2>
                    <p className="text-xs text-zinc-500">{t(lang, 'plugin.description') || 'Kelola plugin eksternal untuk memperluas fitur aplikasi.'}</p>
                </div>
            </div>

            <SettingGroup title="Bit-Perfect Audio Engine">
                <SettingRow
                    title={
                        <div className="flex items-center gap-2">
                            Bit-Perfect Audio Engine
                            {installed ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                    {t(lang, 'audio.bitperfect.badge.installed') || 'Terpasang'}
                                </span>
                            ) : (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-zinc-500/20 text-zinc-400 border border-zinc-500/30">
                                    {t(lang, 'audio.bitperfect.badge.notInstalled') || 'Belum Terpasang'}
                                </span>
                            )}
                        </div>
                    }
                    description={t(lang, 'audio.bitperfect.plugin.desc') || 'Bypass mixer OS Windows, dan kirim file audio langsung ke perangkat audio DAC (Exclusive Mode).'}
                >
                    <div className="flex flex-col gap-2 items-end">
                        {!installed ? (
                            downloading ? (
                                <div className="flex items-center gap-2">
                                    <div className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-zinc-800 text-zinc-200 border border-zinc-700/50 flex items-center gap-2 select-none">
                                        <div className="w-3 h-3 rounded-full border-2 border-zinc-400 border-t-transparent animate-spin" />
                                        <span>{t(lang, 'audio.bitperfect.plugin.installing', { pct: downloadPct })}</span>
                                    </div>
                                    <button
                                        onClick={handleCancelDownload}
                                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition-colors flex items-center gap-1.5 cursor-pointer"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="18" y1="6" x2="6" y2="18"/>
                                            <line x1="6" y1="6" x2="18" y2="18"/>
                                        </svg>
                                        <span>{t(lang, 'audio.bitperfect.plugin.cancel') || 'Batal Unduh'}</span>
                                    </button>
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleInstallFromFile}
                                        disabled={installingFromFile}
                                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/50 transition-colors disabled:opacity-50 cursor-pointer"
                                    >
                                        {t(lang, 'audio.bitperfect.plugin.installFromFile') || 'Install dari File'}
                                    </button>
                                    <button
                                        onClick={handleInstall}
                                        disabled={installingFromFile}
                                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${accent.bg500} text-white hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2 cursor-pointer`}
                                    >
                                        {t(lang, 'audio.bitperfect.plugin.install') || 'Unduh & Install'}
                                    </button>
                                </div>
                            )
                        ) : (
                            <button
                                onClick={handleUninstall}
                                disabled={isPlaying}
                                title={isPlaying ? t(lang, 'audio.bitperfect.plugin.uninstall.disabledPlaying') || 'Hentikan pemutaran musik terlebih dahulu untuk menghapus plugin' : ''}
                                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            >
                                {t(lang, 'audio.bitperfect.plugin.uninstall') || 'Hapus Plugin'}
                            </button>
                        )}
                    </div>
                </SettingRow>
                
                {installed && status?.path && (
                    <SettingRow
                        title={t(lang, 'audio.bitperfect.plugin.fileInfo') || 'Informasi File'}
                        description={status.path}
                    >
                        <div className="text-xs text-zinc-500 font-mono bg-zinc-950 px-2 py-1 rounded">
                            {sizeMB}
                        </div>
                    </SettingRow>
                )}

                {actionError && (
                    <div className="px-4 py-3 bg-rose-500/10 border-t border-rose-500/20">
                        <p className="text-xs text-rose-400 flex items-start gap-2">
                            <span className="mt-0.5">⚠️</span>
                            <span className="flex-1 break-all">{actionError}</span>
                        </p>
                    </div>
                )}
            </SettingGroup>
        </div>
    );
}
