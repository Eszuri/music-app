'use client';

import {useEffect, useState} from 'react';
import {motion} from 'framer-motion';
import type {KeyboardEvent} from 'react';
import {getAccent} from '../../lib/colors';
import {SelectStub, SettingRow, ToggleStub} from './controls';

export default function GeneralSection({
    musicFolder,
    onChangeFolder,
    autoWallpaper,
    setAutoWallpaper,
    resetOnClose,
    setResetOnClose,
    volumeMode,
    setVolumeMode,
    volumeLimit,
    setVolumeLimit,
    volume,
    defaultWallpaper,
    onPickWallpaper,
    onClearWallpaper,
    accentColor,
    onCheckUpdate,
    updateStatus,
    updateChecking,
    updateDownloaded,
    updateTotal,
}: {
    musicFolder: string | null;
    onChangeFolder: () => void;
    autoWallpaper: boolean;
    setAutoWallpaper: (v: boolean) => void;
    resetOnClose: boolean;
    setResetOnClose: (v: boolean) => void;
    volumeMode: string;
    setVolumeMode: (v: string) => void;
    volumeLimit: number;
    setVolumeLimit: (v: number) => void;
    volume: number;
    defaultWallpaper: string | null;
    onPickWallpaper: () => void;
    onClearWallpaper: () => void;
    accentColor: string;
    onCheckUpdate: () => void;
    updateStatus: string;
    updateChecking: boolean;
    updateDownloaded: number;
    updateTotal: number;
}) {
    const accent = getAccent(accentColor);
    return (
        <div className="space-y-6">
            <SettingRow
                title="Folder Musik"
                description="Folder tempat koleksi musik kamu disimpan"
            >
                <div className="flex items-center gap-2 max-w-[260px]">
                    {musicFolder ? (
                        <div className="text-xs text-zinc-400 font-mono truncate flex-1" title={musicFolder}>
                            {musicFolder}
                        </div>
                    ) : (
                        <div className="text-xs text-zinc-600 flex-1" />
                    )}
                    <button
                        onClick={onChangeFolder}
                        className="px-2.5 py-1 rounded-md text-[11px] font-medium text-zinc-300 bg-zinc-800/60 hover:bg-zinc-700/70 border border-zinc-700/50 transition-colors cursor-pointer shrink-0"
                    >
                        {musicFolder ? 'Ganti' : 'Set Folder'}
                    </button>
                </div>
            </SettingRow>
            <SettingRow
                title="Auto Wallpaper"
                description="Gunakan cover art sebagai wallpaper desktop saat lagu diputar"
            >
                <ToggleStub checked={autoWallpaper} onChange={setAutoWallpaper} accent={accent} />
            </SettingRow>
            <SettingRow
                title="Wallpaper Default"
                description="Gambar yang akan digunakan sebagai wallpaper saat reset atau tutup aplikasi"
            >
                <div className="flex items-center gap-2 max-w-[260px]">
                    {defaultWallpaper ? (
                        <div className="text-xs text-zinc-400 font-mono truncate flex-1" title={defaultWallpaper}>
                            {defaultWallpaper.split('\\').pop()?.split('/').pop()}
                        </div>
                    ) : (
                        <div className="text-xs text-zinc-600 flex-1" />
                    )}
                    <button
                        onClick={onPickWallpaper}
                        className="px-2.5 py-1 rounded-md text-[11px] font-medium text-zinc-300 bg-zinc-800/60 hover:bg-zinc-700/70 border border-zinc-700/50 transition-colors cursor-pointer shrink-0"
                    >
                        {defaultWallpaper ? 'Ganti' : 'Set Wallpaper'}
                    </button>
                    {defaultWallpaper && (
                        <button
                            onClick={onClearWallpaper}
                            className="px-2 py-1 rounded-md text-[11px] font-medium text-red-400 bg-zinc-800/60 hover:bg-red-900/40 border border-zinc-700/50 transition-colors cursor-pointer shrink-0"
                        >
                            Hapus
                        </button>
                    )}
                </div>
            </SettingRow>
            <SettingRow
                title="Reset Wallpaper on Close"
                description="Kembalikan wallpaper ke default saat aplikasi ditutup"
            >
                <div className="flex flex-col items-end gap-1">
                    <ToggleStub checked={resetOnClose} onChange={setResetOnClose} disabled={!defaultWallpaper} accent={accent} />
                    {!defaultWallpaper && (
                        <span className="text-[10px] text-zinc-600 whitespace-nowrap">Set wallpaper default dulu</span>
                    )}
                </div>
            </SettingRow>
            <SettingRow
                title="Mode Volume"
                description="Volume App: kontrol sendiri. Volume Sistem: ikuti volume Windows."
            >
                <SelectStub
                    options={[[ 'app', 'App Volume' ], [ 'system', 'System Volume' ]]}
                    value={volumeMode}
                    onChange={setVolumeMode}
                />
            </SettingRow>
            {volumeMode === 'system' && (
                <SettingRow
                    title="Batas Volume Sistem"
                    description="Beri peringatan jika volume sistem melebihi batas ini (0 = tidak ada batas)"
                >
                    <VolumeLimitInput
                        volumeLimit={volumeLimit}
                        setVolumeLimit={setVolumeLimit}
                        currentVolume={volume}
                    />
                </SettingRow>
            )}
            <SettingRow
                title="Update"
                description="Periksa versi terbaru Symvonia"
            >
                <UpdateControl
                    accent={accent}
                    status={updateStatus}
                    checking={updateChecking}
                    downloaded={updateDownloaded}
                    total={updateTotal}
                    onCheck={onCheckUpdate}
                />
            </SettingRow>
        </div>
    );
}

function UpdateControl({
    accent,
    status,
    checking,
    downloaded,
    total,
    onCheck,
}: {
    accent: Record<string, string>;
    status: string;
    checking: boolean;
    downloaded: number;
    total: number;
    onCheck: () => void;
}) {
    const isDownloading = total > 0;
    const pct = total > 0 ? Math.min(100, Math.round((downloaded / total) * 100)) : 0;
    const fmtMB = (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB`;
    return (
        <div className="flex flex-col items-end gap-2 min-w-[260px]">
            {isDownloading && (
                <div className="w-full">
                    <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-1 font-mono">
                        <span>{fmtMB(downloaded)} / {fmtMB(total)}</span>
                        <span>{pct}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                        <motion.div
                            className={`h-full ${accent.bg500} rounded-full`}
                            initial={{width: 0}}
                            animate={{width: `${pct}%`}}
                            transition={{duration: 0.15, ease: 'linear'}}
                        />
                    </div>
                </div>
            )}
            <div className="flex items-center gap-3">
                {status && (
                    <span className="text-xs text-zinc-400 max-w-[160px] truncate" title={status}>
                        {status}
                    </span>
                )}
                <button
                    onClick={onCheck}
                    disabled={checking}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-300 border transition-colors cursor-pointer ${checking
                        ? 'bg-zinc-800/40 border-zinc-700/30 text-zinc-500 cursor-not-allowed'
                        : 'bg-zinc-800/60 hover:bg-zinc-700/70 border-zinc-700/50'
                        }`}
                >
                    {checking ? 'Memeriksa...' : 'Check for Update'}
                </button>
            </div>
        </div>
    );
}

function VolumeLimitInput({
    volumeLimit,
    setVolumeLimit,
    currentVolume,
}: {
    volumeLimit: number;
    setVolumeLimit: (v: number) => void;
    currentVolume: number;
}) {
    const [draft, setDraft] = useState(volumeLimit.toString());
    const [saved, setSaved] = useState(volumeLimit);

    useEffect(() => {
        setDraft(volumeLimit.toString());
        setSaved(volumeLimit);
    }, [volumeLimit]);

    const handleSave = () => {
        let n = parseInt(draft, 10);
        if (isNaN(n) || n < 1) n = 0;
        if (n > 100) n = 100;
        setSaved(n);
        setVolumeLimit(n);
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') handleSave();
    };

    return (
        <div className="flex items-center gap-2">
            <input
                type="number"
                min={0}
                max={100}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-16 px-2 py-1.5 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-xs text-zinc-300 outline-none focus:border-zinc-500 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                placeholder="0"
            />
            <button
                onClick={handleSave}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-300 bg-zinc-800/60 hover:bg-zinc-700/70 border border-zinc-700/50 transition-colors cursor-pointer"
            >
                Save
            </button>
            {saved > 0 && (
                <span className="text-[10px] text-zinc-500">
                    {Math.round(currentVolume * 100) > saved ? '⚠ Volume saat ini melebihi batas' : `Batas: ${saved}`}
                </span>
            )}
        </div>
    );
}
