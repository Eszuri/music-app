'use client';

import { useEffect, useState } from 'react';
import { SettingRow } from './controls';
import { t, type Lang } from '../../lib/translations';
import { getTauri, isBrowserTauri } from '../../lib/homeState';

interface AudioDeviceInfo {
    name: string;
    is_default: boolean;
    default_sample_rate: number;
    max_channels: number;
}

export default function AudioSection({
    lang,
    outputMode,
    setOutputMode,
    outputDevice,
    setOutputDevice,
    accentColor,
}: {
    lang: Lang;
    outputMode: 'shared' | 'exclusive';
    setOutputMode: (v: 'shared' | 'exclusive') => void;
    outputDevice: string | null;
    setOutputDevice: (v: string | null) => void;
    accentColor: string;
}) {
    const [devices, setDevices] = useState<AudioDeviceInfo[]>([]);

    useEffect(() => {
        if (isBrowserTauri) {
            getTauri().then(mod => {
                mod.invoke<AudioDeviceInfo[]>('engine_get_output_devices')
                    .then(res => {
                        if (Array.isArray(res)) setDevices(res);
                    })
                    .catch(() => {});
            });
        }
    }, []);

    return (
        <div className="space-y-6">
            <SettingRow
                title={t(lang, 'audio.outputMode.title')}
                description={t(lang, 'audio.outputMode.desc')}
            >
                <div className="flex flex-col gap-2">
                    {[
                        { id: 'shared', labelKey: 'audio.outputMode.shared', isBeta: false, disabled: false },
                        { 
                            id: 'exclusive', 
                            labelKey: 'audio.outputMode.exclusive', 
                            isBeta: true,
                            disabled: !isBrowserTauri, 
                            disabledHint: t(lang, 'audio.outputMode.desktopOnly') 
                        }
                    ].map(mode => {
                        const isDisabled = mode.disabled;
                        return (
                            <label
                                key={mode.id}
                                className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                                    isDisabled
                                        ? 'bg-zinc-900/30 border-zinc-800/30 opacity-50 cursor-not-allowed'
                                        : outputMode === mode.id
                                        ? 'bg-zinc-800/80 border-zinc-600 cursor-pointer'
                                        : 'bg-zinc-900/50 border-zinc-800/50 hover:bg-zinc-800/50 hover:border-zinc-700/50 cursor-pointer'
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="outputMode"
                                    value={mode.id}
                                    disabled={isDisabled}
                                    checked={outputMode === mode.id}
                                    onChange={() => !isDisabled && setOutputMode(mode.id as 'shared' | 'exclusive')}
                                    className="w-4 h-4 text-zinc-100 bg-zinc-800 border-zinc-600 focus:ring-zinc-500 focus:ring-2 cursor-pointer disabled:cursor-not-allowed"
                                />
                                <span className="text-sm text-zinc-200 font-medium select-none flex items-center gap-2">
                                    {t(lang, mode.labelKey)}
                                    {mode.isBeta && (
                                        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wider">
                                            {t(lang, 'audio.bitPerfect.betaTag')}
                                        </span>
                                    )}
                                    {isDisabled && mode.disabledHint && (
                                        <span className="text-xs text-amber-400 font-normal">
                                            {mode.disabledHint}
                                        </span>
                                    )}
                                </span>
                            </label>
                        );
                    })}
                </div>
            </SettingRow>

            {outputMode === 'exclusive' && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs leading-relaxed">
                    {t(lang, 'audio.bitPerfect.warning')}
                </div>
            )}

            <SettingRow
                title={t(lang, 'audio.outputDevice.title')}
                description={t(lang, 'audio.outputDevice.desc')}
            >
                <select
                    value={outputDevice || ''}
                    onChange={(e) => setOutputDevice(e.target.value ? e.target.value : null)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-600"
                >
                    <option value="">{t(lang, 'audio.outputDevice.default')}</option>
                    {devices.map((dev, idx) => (
                        <option key={idx} value={dev.name}>
                            {dev.name} {dev.is_default ? `(${t(lang, 'audio.outputDevice.default')})` : ''} - {dev.default_sample_rate}Hz
                        </option>
                    ))}
                </select>
            </SettingRow>
        </div>
    );
}
