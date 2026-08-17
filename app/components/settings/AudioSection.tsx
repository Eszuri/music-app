'use client';

import {useCallback, useEffect, useState} from 'react';
import {SelectStub, SettingGroup, SettingRow} from './controls';
import {t, type Lang} from '../../lib/translations';
import {getAccent} from '../../lib/colors';
import {useBitPerfectEngine, type EngineDevice} from '../../hooks/useBitPerfectEngine';
import type {OutputMode} from '../../lib/storage';
import ConfirmDialog from '../ConfirmDialog';

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
    outputMode: OutputMode;
    setOutputMode: (v: OutputMode) => void;
    accentColor: string;
}) {
    const accent = getAccent(accentColor);
    const {status, engineState, getDevices} = useBitPerfectEngine();
    const [devices, setDevices] = useState<EngineDevice[]>([]);
    const [confirmExclusiveOpen, setConfirmExclusiveOpen] = useState(false);
    const installed = status?.installed === true;
    const nativeMode = outputMode === 'wasapi_shared' || outputMode === 'wasapi_exclusive';

    const refreshDevices = useCallback(() => {
        getDevices().then((list) => {
            if (list.length > 0) setDevices(list);
        });
    }, [getDevices]);

    useEffect(() => {
        if (installed) refreshDevices();
    }, [installed, refreshDevices]);

    const selectMode = (value: string) => {
        if ((value === 'wasapi_shared' || value === 'wasapi_exclusive') && !installed) {
            setOutputMode('html_audio');
            return;
        }
        if (value === 'wasapi_exclusive') {
            setConfirmExclusiveOpen(true);
            return;
        }
        if (value === 'html_audio' || value === 'wasapi_shared') {
            setOutputMode(value);
        }
    };

    const activeMode = engineState?.mode
        ?? (engineState?.exclusive ? 'exclusive' : null)
        ?? (outputMode === 'wasapi_exclusive' ? 'exclusive' : outputMode === 'wasapi_shared' ? 'shared' : null);
    const activeLabel = activeMode === 'exclusive'
        ? t(lang, 'audio.outputMode.wasapiExclusive')
        : activeMode === 'shared'
            ? t(lang, 'audio.outputMode.wasapiShared')
            : t(lang, 'audio.outputMode.htmlAudio');

    return (
        <div className="space-y-6">
            <ConfirmDialog
                lang={lang}
                open={confirmExclusiveOpen}
                title={t(lang, 'audio.bitperfect.confirmTitle')}
                message={t(lang, 'audio.bitperfect.confirmMessage')}
                confirmLabel={t(lang, 'audio.bitperfect.confirmBtn')}
                cancelLabel={t(lang, 'confirm.defaultCancel')}
                accentColor={accentColor}
                onConfirm={() => {
                    setOutputMode('wasapi_exclusive');
                    setConfirmExclusiveOpen(false);
                }}
                onCancel={() => setConfirmExclusiveOpen(false)}
            />

            <SettingGroup title={t(lang, 'audio.group.mode')}>
                <SettingRow
                    title={t(lang, 'audio.outputMode.title')}
                    description={installed
                        ? t(lang, 'audio.outputMode.desc')
                        : t(lang, 'audio.outputMode.needsPlugin')}
                >
                    <SelectStub
                        options={[
                            ['html_audio', t(lang, 'audio.outputMode.htmlAudio')],
                            ['wasapi_shared', t(lang, 'audio.outputMode.wasapiShared')],
                            ['wasapi_exclusive', t(lang, 'audio.outputMode.wasapiExclusive')],
                        ]}
                        value={outputMode}
                        onChange={selectMode}
                    />
                </SettingRow>
                <SettingRow
                    title={t(lang, 'audio.bitperfect.device.title')}
                    description={nativeMode
                        ? t(lang, 'audio.bitperfect.device.desc')
                        : t(lang, 'audio.outputMode.deviceIgnored')}
                >
                    <div className="flex items-center gap-2">
                        <select
                            value={outputDevice || ''}
                            onChange={(e) => setOutputDevice(e.target.value ? e.target.value : null)}
                            disabled={!installed || !nativeMode}
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
                            disabled={!installed || !nativeMode}
                            className="px-2.5 py-1.5 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-xs text-zinc-400 cursor-pointer hover:bg-zinc-700/70 hover:text-zinc-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {t(lang, 'audio.bitperfect.device.refresh')}
                        </button>
                    </div>
                </SettingRow>
                {nativeMode && engineState?.state === 'playing' && engineState.sampleRate && (
                    <SettingRow
                        title={t(lang, 'audio.outputMode.activeTitle')}
                        description={t(lang, 'audio.bitperfect.nowPlaying', {
                            rate: engineState.sampleRate,
                            bits: engineState.bitDepth ?? 0,
                            device: engineState.deviceName ?? '',
                        })}
                    >
                        <span className={`text-[10px] font-semibold uppercase tracking-wider ${accent.text400}`}>
                            ● {activeLabel}
                        </span>
                    </SettingRow>
                )}
            </SettingGroup>
        </div>
    );
}
