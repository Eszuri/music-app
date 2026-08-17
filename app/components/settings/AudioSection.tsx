'use client';

import {useCallback, useEffect, useState} from 'react';
import {SelectStub, SettingGroup, SettingRow} from './controls';
import {t, type Lang} from '../../lib/translations';
import {getAccent} from '../../lib/colors';
import {useBitPerfectEngine, type EngineDevice} from '../../hooks/useBitPerfectEngine';
import type {OutputMode} from '../../lib/storage';
import type {PlaybackRuntimeInfo} from '../../hooks/audio/playbackTypes';
import ConfirmDialog from '../ConfirmDialog';

const nativeModes: OutputMode[] = ['wasapi_shared', 'wasapi_exclusive'];

function isNativeMode(mode: OutputMode): boolean {
    return nativeModes.includes(mode);
}

function modeLabel(lang: Lang, mode: OutputMode | null): string {
    if (mode === 'wasapi_shared') return t(lang, 'audio.outputMode.wasapiShared');
    if (mode === 'wasapi_exclusive') return t(lang, 'audio.outputMode.wasapiExclusive');
    return t(lang, 'audio.outputMode.htmlAudio');
}

function runtimeStatusLabel(lang: Lang, status: PlaybackRuntimeInfo['status']): string {
    return t(lang, `audio.runtime.status.${status}`);
}

export default function AudioSection({
    lang,
    outputDevice,
    setOutputDevice,
    outputMode,
    setOutputMode,
    audioRuntime,
    onRetryNativeAudio,
    accentColor,
}: {
    lang: Lang;
    outputDevice: string | null;
    setOutputDevice: (v: string | null) => void;
    outputMode: OutputMode;
    setOutputMode: (v: OutputMode) => void;
    audioRuntime: PlaybackRuntimeInfo;
    onRetryNativeAudio: () => void;
    accentColor: string;
}) {
    const accent = getAccent(accentColor);
    const {status, getDevices} = useBitPerfectEngine();
    const [devices, setDevices] = useState<EngineDevice[]>([]);
    const [devicesLoading, setDevicesLoading] = useState(false);
    const [devicesError, setDevicesError] = useState<string | null>(null);
    const [pendingMode, setPendingMode] = useState<OutputMode | null>(null);
    const [confirmModeOpen, setConfirmModeOpen] = useState(false);
    const installed = status?.installed === true;
    const nativeMode = isNativeMode(outputMode);
    const activeMode = audioRuntime.effectiveMode;
    const activeNative = isNativeMode(activeMode ?? 'html_audio');
    const activeDeviceKnown = Boolean(audioRuntime.deviceName);

    const refreshDevices = useCallback(async () => {
        if (!installed) return;
        setDevicesLoading(true);
        setDevicesError(null);
        try {
            const list = await getDevices();
            setDevices(list);
            if (list.length === 0) setDevicesError(t(lang, 'audio.device.empty'));
        } catch (error) {
            setDevices([]);
            setDevicesError((error as Error).message || t(lang, 'audio.device.error'));
        } finally {
            setDevicesLoading(false);
        }
    }, [getDevices, installed, lang]);

    useEffect(() => {
        if (!installed || !nativeMode) return;
        const timer = window.setTimeout(() => {
            void refreshDevices();
        }, 0);
        return () => window.clearTimeout(timer);
    }, [installed, nativeMode, refreshDevices]);

    const selectMode = (value: string) => {
        if (value !== 'html_audio' && value !== 'wasapi_shared' && value !== 'wasapi_exclusive') return;
        const nextMode = value as OutputMode;
        if (nextMode === outputMode) return;
        if (nextMode === 'wasapi_exclusive' || audioRuntime.status === 'playing' || audioRuntime.status === 'paused' || audioRuntime.path) {
            setPendingMode(nextMode);
            setConfirmModeOpen(true);
            return;
        }
        setOutputMode(nextMode);
    };

    const format = audioRuntime.sampleRate
        ? `${(audioRuntime.sampleRate / 1000).toFixed(audioRuntime.sampleRate % 1000 === 0 ? 0 : 1)} kHz · ${audioRuntime.bitDepth ?? '?'}-bit`
        : t(lang, 'audio.runtime.formatUnknown');

    return (
        <div className="space-y-5">
            <ConfirmDialog
                lang={lang}
                open={confirmModeOpen}
                title={t(lang, 'audio.outputMode.changeTitle')}
                message={t(lang, 'audio.outputMode.changeMessage')}
                confirmLabel={t(lang, 'audio.outputMode.changeConfirm')}
                cancelLabel={t(lang, 'confirm.defaultCancel')}
                accentColor={accentColor}
                onConfirm={() => {
                    if (pendingMode) setOutputMode(pendingMode);
                    setPendingMode(null);
                    setConfirmModeOpen(false);
                }}
                onCancel={() => {
                    setPendingMode(null);
                    setConfirmModeOpen(false);
                }}
            />

            <section
                aria-labelledby="audio-runtime-heading"
                aria-live="polite"
                className="rounded-xl border border-zinc-800 bg-linear-to-br from-zinc-900/90 to-zinc-950/80 p-4"
            >
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                            {t(lang, 'audio.runtime.eyebrow')}
                        </p>
                        <h3 id="audio-runtime-heading" className="mt-1 text-base font-semibold text-zinc-100">
                            {runtimeStatusLabel(lang, audioRuntime.status)}
                        </h3>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${audioRuntime.status === 'error' || audioRuntime.status === 'fallback'
                        ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                        : audioRuntime.status === 'playing'
                            ? `${accent.border500_30} ${accent.bg15} ${accent.text400}`
                            : 'border-zinc-700 bg-zinc-800/70 text-zinc-400'
                        }`}>
                        {audioRuntime.status}
                    </span>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-zinc-800/80 bg-black/20 p-3">
                        <p className="text-[10px] uppercase tracking-wider text-zinc-500">{t(lang, 'audio.runtime.requested')}</p>
                        <p className="mt-1 text-sm font-medium text-zinc-200">{modeLabel(lang, audioRuntime.requestedMode)}</p>
                    </div>
                    <div className="rounded-lg border border-zinc-800/80 bg-black/20 p-3">
                        <p className="text-[10px] uppercase tracking-wider text-zinc-500">{t(lang, 'audio.runtime.active')}</p>
                        <p className="mt-1 text-sm font-medium text-zinc-200">{modeLabel(lang, activeMode)}</p>
                    </div>
                    <div className="rounded-lg border border-zinc-800/80 bg-black/20 p-3">
                        <p className="text-[10px] uppercase tracking-wider text-zinc-500">{t(lang, 'audio.runtime.device')}</p>
                        <p className="mt-1 truncate text-sm font-medium text-zinc-200">
                            {audioRuntime.deviceName || (activeNative ? t(lang, 'audio.device.default') : t(lang, 'audio.runtime.notApplicable'))}
                        </p>
                    </div>
                    <div className="rounded-lg border border-zinc-800/80 bg-black/20 p-3">
                        <p className="text-[10px] uppercase tracking-wider text-zinc-500">{t(lang, 'audio.runtime.format')}</p>
                        <p className="mt-1 text-sm font-medium text-zinc-200">{format}</p>
                    </div>
                </div>
                {audioRuntime.error && (
                    <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3" role="alert">
                        <p className="text-sm font-medium text-amber-200">{audioRuntime.error.message}</p>
                        {audioRuntime.error.code && <p className="mt-1 text-[11px] text-amber-300/70">{audioRuntime.error.code}</p>}
                        <div className="mt-3 flex flex-wrap gap-2">
                            {nativeMode && <button type="button" onClick={onRetryNativeAudio} className={`min-h-10 rounded-lg px-3 text-xs font-semibold ${accent.bg500} text-white hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2`}>
                                {t(lang, 'audio.runtime.retry')}
                            </button>}
                            {audioRuntime.effectiveMode !== 'html_audio' && <button type="button" onClick={() => setOutputMode('html_audio')} className="min-h-10 rounded-lg border border-zinc-700 px-3 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2">
                                {t(lang, 'audio.runtime.useHtml')}
                            </button>}
                        </div>
                    </div>
                )}
            </section>

            <SettingGroup title={t(lang, 'audio.group.mode')}>
                <SettingRow title={t(lang, 'audio.outputMode.title')} description={t(lang, 'audio.outputMode.desc')}>
                    <SelectStub
                        ariaLabel={t(lang, 'audio.outputMode.title')}
                        options={[
                            ['html_audio', t(lang, 'audio.outputMode.htmlAudio')],
                            ['wasapi_shared', t(lang, 'audio.outputMode.wasapiShared'), !installed],
                            ['wasapi_exclusive', t(lang, 'audio.outputMode.wasapiExclusive'), !installed],
                        ]}
                        value={outputMode}
                        onChange={selectMode}
                    />
                </SettingRow>
                <SettingRow
                    title={t(lang, 'audio.outputDevice.title')}
                    description={nativeMode ? t(lang, 'audio.outputDevice.desc') : t(lang, 'audio.outputMode.deviceIgnored')}
                >
                    <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
                        <select
                            aria-label={t(lang, 'audio.outputDevice.title')}
                            value={outputDevice || ''}
                            onChange={(e) => setOutputDevice(e.target.value || null)}
                            disabled={!installed || !nativeMode || devicesLoading}
                            className="min-h-10 max-w-full min-w-35 rounded-lg border border-zinc-700/50 bg-zinc-800/60 px-3 text-base text-zinc-300 outline-none transition-colors hover:bg-zinc-700/70 focus-visible:outline-2 focus-visible:outline-offset-2 sm:text-xs disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <option value="">{t(lang, 'audio.device.default')}</option>
                            {activeDeviceKnown && outputDevice && !devices.some((device) => device.id === outputDevice) && (
                                <option value={outputDevice}>{audioRuntime.deviceName} ({t(lang, 'audio.device.active')})</option>
                            )}
                            {devices.map((device) => <option key={device.id} value={device.id}>{device.name}{device.isDefault ? ` (${t(lang, 'audio.device.default')})` : ''}</option>)}
                        </select>
                        <button
                            type="button"
                            onClick={() => void refreshDevices()}
                            disabled={!installed || !nativeMode || devicesLoading}
                            className="min-h-10 rounded-lg border border-zinc-700/50 bg-zinc-800/60 px-3 text-xs text-zinc-300 transition-colors hover:bg-zinc-700/70 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            {devicesLoading ? t(lang, 'audio.device.refreshing') : t(lang, 'audio.device.refresh')}
                        </button>
                    </div>
                </SettingRow>
                {devicesError && nativeMode && !activeDeviceKnown && <div className="border-b border-zinc-800/40 px-4 py-3 text-xs text-amber-300" role="status">{devicesError}</div>}
            </SettingGroup>

            <SettingGroup title={t(lang, 'audio.compatibility.title')}>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-130 text-left text-xs">
                        <thead className="text-[10px] uppercase tracking-wider text-zinc-500">
                            <tr><th className="px-4 py-3 font-medium">{t(lang, 'audio.compatibility.capability')}</th><th className="px-3 py-3 font-medium">{t(lang, 'audio.outputMode.htmlAudio')}</th><th className="px-3 py-3 font-medium">{t(lang, 'audio.outputMode.wasapiShared')}</th><th className="px-3 py-3 font-medium">{t(lang, 'audio.outputMode.wasapiExclusive')}</th></tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                            {([
                                ['audio.compatibility.plugin', ['No', 'Required', 'Required']],
                                ['audio.compatibility.device', ['No', 'Yes', 'Yes']],
                                ['audio.compatibility.mixer', ['Yes', 'Yes', 'No']],
                                ['audio.compatibility.processing', ['EQ · gain · fade', 'Native path', 'Native path']],
                                ['audio.compatibility.fallback', ['N/A', 'HTML Audio', 'HTML Audio']],
                            ] as [string, string[]][]).map(([key, values]) => <tr key={key}><th className="px-4 py-3 font-medium text-zinc-400">{t(lang, key)}</th>{values.map((value, index) => <td key={index} className="px-3 py-3">{value}</td>)}</tr>)}
                        </tbody>
                    </table>
                </div>
            </SettingGroup>
        </div>
    );
}
