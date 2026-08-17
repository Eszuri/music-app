'use client';

import {useCallback, useEffect, useState} from 'react';
import {SelectStub, SettingGroup, SettingRow, ToggleStub} from './controls';
import {t, type Lang} from '../../lib/translations';
import {getAccent} from '../../lib/colors';
import {useBitPerfectEngine, type EngineDevice} from '../../hooks/useBitPerfectEngine';
import type {PlaybackRuntimeInfo} from '../../hooks/audio/playbackTypes';
import type {OutputMode} from '../../lib/storage';
import ConfirmDialog from '../ConfirmDialog';

function isNativeMode(mode: OutputMode): boolean {
    const nativeModes: OutputMode[] = ['wasapi_shared', 'wasapi_exclusive'];
    return nativeModes.includes(mode);
}

export default function AudioSection({
    lang,
    outputDevice,
    setOutputDevice,
    outputMode,
    setOutputMode,
    audioRuntime,
    accentColor,
    autoFallbackHtmlAudio = false,
    setAutoFallbackHtmlAudio,
}: {
    lang: Lang;
    outputDevice: string | null;
    setOutputDevice: (v: string | null) => void;
    outputMode: OutputMode;
    setOutputMode: (v: OutputMode) => void;
    audioRuntime: PlaybackRuntimeInfo;
    onRetryNativeAudio?: () => void;
    accentColor: string;
    autoFallbackHtmlAudio?: boolean;
    setAutoFallbackHtmlAudio?: (v: boolean) => void;
}) {
    const accent = getAccent(accentColor);
    const {status, getDevices} = useBitPerfectEngine();
    const [devices, setDevices] = useState<EngineDevice[]>([]);
    const [devicesLoading, setDevicesLoading] = useState(false);
    const [devicesError, setDevicesError] = useState<string | null>(null);
    const [pendingMode, setPendingMode] = useState<OutputMode | null>(null);
    const [confirmModeOpen, setConfirmModeOpen] = useState(false);
    const [selectedDevice, setSelectedDevice] = useState<string | null>(outputDevice);
    const [appliedFeedback, setAppliedFeedback] = useState(false);

    useEffect(() => {
        setSelectedDevice(outputDevice);
    }, [outputDevice]);

    const installed = status?.installed === true;
    const nativeMode = isNativeMode(outputMode);
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

    const handleApplyDevice = () => {
        setOutputDevice(selectedDevice);
        setAppliedFeedback(true);
        window.setTimeout(() => setAppliedFeedback(false), 1800);
    };

    const deviceOptions: [string, string, boolean?][] = [
        ['', t(lang, 'audio.device.default')],
        ...(activeDeviceKnown && selectedDevice && !devices.some((device) => device.id === selectedDevice)
            ? [[selectedDevice, `${audioRuntime.deviceName} (${t(lang, 'audio.device.active')})`]] as [string, string][]
            : []),
        ...devices.map((device) => [
            device.id,
            `${device.name}${device.isDefault ? ` (${t(lang, 'audio.device.default')})` : ''}`,
        ] as [string, string]),
    ];

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
                        accent={accent}
                        accentColor={accentColor}
                    />
                </SettingRow>
                <div className="px-4 py-3.5 border-b border-zinc-800/40 last:border-0">
                    <div className="text-sm font-medium text-zinc-100">{t(lang, 'audio.outputDevice.title')}</div>
                    <p className="text-xs text-zinc-500 mt-0.5">{nativeMode ? t(lang, 'audio.outputDevice.desc') : t(lang, 'audio.outputMode.deviceIgnored')}</p>

                    <div className="mt-3 space-y-3">
                        <SelectStub
                            ariaLabel={t(lang, 'audio.outputDevice.title')}
                            options={deviceOptions}
                            value={selectedDevice || ''}
                            onChange={(val) => setSelectedDevice(val || null)}
                            disabled={!installed || !nativeMode || devicesLoading}
                            accent={accent}
                            accentColor={accentColor}
                            fullWidth
                        />
                        <div className="flex items-center gap-2.5">
                            <button
                                type="button"
                                onClick={handleApplyDevice}
                                disabled={!installed || !nativeMode || devicesLoading}
                                className={`px-4 py-2 rounded-lg text-xs font-semibold text-white transition-all duration-150 shadow-sm cursor-pointer active:scale-[0.98] ${
                                    appliedFeedback
                                        ? 'bg-emerald-600 hover:bg-emerald-500'
                                        : `${accent.bg500} hover:brightness-110`
                                } disabled:cursor-not-allowed disabled:opacity-40`}
                            >
                                {appliedFeedback ? t(lang, 'audio.device.applied') : t(lang, 'audio.device.apply')}
                            </button>
                            <button
                                type="button"
                                onClick={() => void refreshDevices()}
                                disabled={!installed || !nativeMode || devicesLoading}
                                className="px-4 py-2 rounded-lg border border-zinc-700/60 bg-zinc-800/80 text-xs font-medium text-zinc-300 transition-all duration-150 hover:bg-zinc-700/70 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer active:scale-[0.98]"
                            >
                                {devicesLoading ? t(lang, 'audio.device.refreshing') : t(lang, 'audio.device.refresh')}
                            </button>
                        </div>
                    </div>
                </div>
                <SettingRow
                    title={t(lang, 'audio.autoFallback.title')}
                    description={t(lang, 'audio.autoFallback.desc')}
                >
                    <ToggleStub
                        checked={autoFallbackHtmlAudio}
                        onChange={(val) => setAutoFallbackHtmlAudio?.(val)}
                        disabled={!installed}
                        accent={accent}
                    />
                </SettingRow>
                {devicesError && nativeMode && !activeDeviceKnown && <div className="border-b border-zinc-800/40 px-4 py-3 text-xs text-amber-300" role="status">{devicesError}</div>}
            </SettingGroup>
        </div>
    );
}
