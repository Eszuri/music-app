'use client';

import {useCallback, useEffect, useState} from 'react';
import {SettingGroup, SettingRow, ToggleStub} from './controls';
import {t, type Lang} from '../../lib/translations';
import {getAccent} from '../../lib/colors';
import {useBitPerfectEngine, type EngineDevice} from '../../hooks/useBitPerfectEngine';

export default function AudioSection({
    lang,
    outputDevice,
    setOutputDevice,
    outputMode,
    setOutputMode,
    accentColor,
}: {
    lang: Lang;
    outputDevice: string | null;
    setOutputDevice: (v: string | null) => void;
    outputMode: 'default' | 'bitperfect';
    setOutputMode: (v: 'default' | 'bitperfect') => void;
    accentColor: string;
}) {
    const accent = getAccent(accentColor);
    const {
        status,
        downloading,
        downloadProgress,
        engineState,
        download,
        uninstall,
        getDevices,
    } = useBitPerfectEngine();

    const [devices, setDevices] = useState<EngineDevice[]>([]);
    const [actionError, setActionError] = useState<string | null>(null);

    const installed = status?.installed === true;

    const refreshDevices = useCallback(() => {
        getDevices().then((list) => {
            if (list.length > 0) setDevices(list);
        });
    }, [getDevices]);

    useEffect(() => {
        if (installed) refreshDevices();
    }, [installed, refreshDevices]);

    const handleInstall = async () => {
        setActionError(null);
        try {
            await download();
        } catch (e) {
            setActionError(String(e));
        }
    };

    const handleUninstall = async () => {
        setActionError(null);
        try {
            await uninstall();
            setDevices([]);
            if (outputMode === 'bitperfect') setOutputMode('default');
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
        <div className="space-y-6">
            <SettingGroup title={t(lang, 'audio.group.mode')}>
                <SettingRow
                    title={t(lang, 'audio.bitperfect.enable.title')}
                    description={
                        installed
                            ? t(lang, 'audio.bitperfect.enable.desc')
                            : t(lang, 'audio.bitperfect.enable.needsPlugin')
                    }
                >
                    <ToggleStub
                        checked={outputMode === 'bitperfect'}
                        disabled={!installed}
                        accent={accent}
                        onChange={(v) => setOutputMode(v ? 'bitperfect' : 'default')}
                    />
                </SettingRow>
                <SettingRow
                    title={t(lang, 'audio.bitperfect.device.title')}
                    description={t(lang, 'audio.bitperfect.device.desc')}
                >
                    <div className="flex items-center gap-2">
                        <select
                            value={outputDevice || ''}
                            onChange={(e) => setOutputDevice(e.target.value ? e.target.value : null)}
                            disabled={!installed}
                            className="px-3 py-1.5 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-xs text-zinc-300 cursor-pointer min-w-35 max-w-55 outline-none hover:bg-zinc-700/70 focus:bg-zinc-700/70 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <option value="" className="bg-zinc-900 text-zinc-200">
                                {t(lang, 'audio.bitperfect.device.default')}
                            </option>
                            {devices.map((dev) => (
                                <option key={dev.id} value={dev.id} className="bg-zinc-900 text-zinc-200">
                                    {dev.name}{dev.isDefault ? ` (${t(lang, 'audio.bitperfect.device.default')})` : ''}
                                </option>
                            ))}
                        </select>
                        <button
                            type="button"
                            onClick={refreshDevices}
                            disabled={!installed}
                            className="px-2.5 py-1.5 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-xs text-zinc-400 cursor-pointer hover:bg-zinc-700/70 hover:text-zinc-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {t(lang, 'audio.bitperfect.device.refresh')}
                        </button>
                    </div>
                </SettingRow>
                {outputMode === 'bitperfect' && engineState?.state === 'playing' && engineState.sampleRate && (
                    <SettingRow
                        title={t(lang, 'audio.bitperfect.enable.title')}
                        description={t(lang, 'audio.bitperfect.nowPlaying', {
                            rate: engineState.sampleRate,
                            bits: engineState.bitDepth ?? 0,
                            device: engineState.deviceName ?? '',
                        })}
                    >
                        <span className={`text-[10px] font-semibold uppercase tracking-wider ${accent.text400}`}>
                            ● EXCLUSIVE
                        </span>
                    </SettingRow>
                )}
            </SettingGroup>

            <SettingGroup title={t(lang, 'audio.bitperfect.group')}>
                <SettingRow
                    title={t(lang, 'audio.bitperfect.plugin.title')}
                    description={t(lang, 'audio.bitperfect.plugin.desc')}
                >
                    <div className="flex flex-col items-end gap-1.5">
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-zinc-500">
                                {installed
                                    ? t(lang, 'audio.bitperfect.plugin.installed', {size: sizeMB})
                                    : t(lang, 'audio.bitperfect.plugin.notInstalled')}
                            </span>
                            {installed ? (
                                <button
                                    type="button"
                                    onClick={handleUninstall}
                                    className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400 cursor-pointer hover:bg-red-500/20 transition-colors"
                                >
                                    {t(lang, 'audio.bitperfect.plugin.uninstall')}
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleInstall}
                                    disabled={downloading}
                                    className={`px-3 py-1.5 rounded-lg border text-xs cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-wait ${accent.bg15} ${accent.text400} ${accent.border500_20}`}
                                >
                                    {downloading
                                        ? t(lang, 'audio.bitperfect.plugin.installing', {pct: downloadPct})
                                        : t(lang, 'audio.bitperfect.plugin.install')}
                                </button>
                            )}
                        </div>
                        {downloading && (
                            <div className="w-40 h-1 rounded-full bg-zinc-800 overflow-hidden">
                                <div
                                    className={`h-full ${accent.bg500} transition-all duration-200`}
                                    style={{width: `${downloadPct}%`}}
                                />
                            </div>
                        )}
                    </div>
                </SettingRow>
                {actionError && (
                    <div className="px-4 py-2.5 text-xs text-red-400 border-t border-zinc-800/40">
                        {t(lang, 'audio.bitperfect.plugin.error', {msg: actionError})}
                    </div>
                )}
            </SettingGroup>
        </div>
    );
}
