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
    outputDevice,
    setOutputDevice,
}: {
    lang: Lang;
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
