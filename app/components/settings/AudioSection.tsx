'use client';

import {useCallback, useEffect, useState} from 'react';
import {SelectStub, SettingGroup, SettingRow} from './controls';
import {t, type Lang} from '../../lib/translations';
import {useBitPerfectEngine, type EngineDevice} from '../../hooks/useBitPerfectEngine';
import type {OutputMode} from '../../lib/storage';
import type {PlaybackRuntimeInfo} from '../../hooks/audio/playbackTypes';
import ConfirmDialog from '../ConfirmDialog';

const nativeModes: OutputMode[] = ['wasapi_shared', 'wasapi_exclusive'];

function isNativeMode(mode: OutputMode): boolean {
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
}: {
    lang: Lang;
    outputDevice: string | null;
    setOutputDevice: (v: string | null) => void;
    outputMode: OutputMode;
    setOutputMode: (v: OutputMode) => void;
    audioRuntime: PlaybackRuntimeInfo;
    onRetryNativeAudio?: () => void;
    accentColor: string;
}) {
    const {status, getDevices} = useBitPerfectEngine();
    const [devices, setDevices] = useState<EngineDevice[]>([]);
    const [devicesLoading, setDevicesLoading] = useState(false);
    const [devicesError, setDevicesError] = useState<string | null>(null);
    const [pendingMode, setPendingMode] = useState<OutputMode | null>(null);
    const [confirmModeOpen, setConfirmModeOpen] = useState(false);
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
        </div>
    );
}
