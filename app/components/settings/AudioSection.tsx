'use client';

import {useCallback, useEffect, useState} from 'react';
import {SettingGroup, SettingRow, ToggleStub} from './controls';
import {t, type Lang} from '../../lib/translations';
import {getAccent} from '../../lib/colors';
import {useBitPerfectEngine, type EngineDevice} from '../../hooks/useBitPerfectEngine';
import {getTauri, isBrowserTauri} from '../../lib/homeState';
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
    outputMode: 'default' | 'bitperfect';
    setOutputMode: (v: 'default' | 'bitperfect') => void;
    accentColor: string;
}) {
    const accent = getAccent(accentColor);
    const {
        status,
        engineState,
        getDevices,
    } = useBitPerfectEngine();

    const [devices, setDevices] = useState<EngineDevice[]>([]);
    const [confirmBpOpen, setConfirmBpOpen] = useState(false);

    const installed = status?.installed === true;

    const refreshDevices = useCallback(() => {
        getDevices().then((list) => {
            if (list.length > 0) setDevices(list);
        });
    }, [getDevices]);

    useEffect(() => {
        if (installed) refreshDevices();
    }, [installed, refreshDevices]);



    return (
        <div className="space-y-6">
            <ConfirmDialog
                lang={lang}
                open={confirmBpOpen}
                title={t(lang, 'audio.bitperfect.confirmTitle')}
                message={t(lang, 'audio.bitperfect.confirmMessage')}
                confirmLabel={t(lang, 'audio.bitperfect.confirmBtn')}
                cancelLabel={t(lang, 'confirm.defaultCancel')}
                accentColor={accentColor}
                onConfirm={() => {
                    setOutputMode('bitperfect');
                    setConfirmBpOpen(false);
                }}
                onCancel={() => setConfirmBpOpen(false)}
            />


            <SettingGroup title={t(lang, 'audio.group.mode')}>
                <SettingRow
                    title={
                        <div className="flex items-center gap-2">
                            {t(lang, 'audio.bitperfect.enable.title')}
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase bg-amber-500/20 text-amber-500 border border-amber-500/30">
                                Beta
                            </span>
                        </div>
                    }
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
                        onChange={(v) => {
                            if (v) {
                                setConfirmBpOpen(true);
                            } else {
                                setOutputMode('default');
                            }
                        }}
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

        </div>
    );
}
