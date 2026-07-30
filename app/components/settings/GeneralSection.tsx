'use client';

import {useEffect, useState} from 'react';
import {motion} from 'framer-motion';
import type {KeyboardEvent} from 'react';
import {getAccent} from '../../lib/colors';
import {t, type Lang} from '../../lib/translations';
import {SelectStub, SettingGroup, SettingRow, ToggleStub} from './controls';

export default function GeneralSection({
    lang,
    musicFolder,
    onChangeFolder,
    autoWallpaper,
    setAutoWallpaper,
    resetOnClose,
    setResetOnClose,
    setLang,
    volumeStep,
    setVolumeStep,
    volumeMode,
    setVolumeMode,
    volumeLimit,
    setVolumeLimit,
    pauseIfMuted,
    setPauseIfMuted,
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
    lang: Lang;
    setLang: (v: Lang) => void;
    musicFolder: string | null;
    onChangeFolder: () => void;
    autoWallpaper: boolean;
    setAutoWallpaper: (v: boolean) => void;
    resetOnClose: boolean;
    setResetOnClose: (v: boolean) => void;
    volumeStep: number;
    setVolumeStep: (v: number) => void;
    volumeMode: string;
    setVolumeMode: (v: string) => void;
    volumeLimit: number;
    setVolumeLimit: (v: number) => void;
    pauseIfMuted: boolean;
    setPauseIfMuted: (v: boolean) => void;
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
        <div className="space-y-5">
            <SettingGroup title={t(lang, 'general.group.app')}>
            <SettingRow
                title={t(lang, 'general.language.title')}
                description={t(lang, 'general.language.desc')}
            >
                <SelectStub
                    options={[
                        ['en', t(lang, 'lang.en')],
                        ['id', t(lang, 'lang.id')],
                    ]}
                    value={lang}
                    onChange={(v) => setLang(v as Lang)}
                />
            </SettingRow>
            <SettingRow
                title={t(lang, 'general.folderMusic.title')}
                description={t(lang, 'general.folderMusic.desc')}
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
                        {musicFolder ? t(lang, 'general.folderMusic.changeBtn') : t(lang, 'general.folderMusic.setBtn')}
                    </button>
                </div>
            </SettingRow>
            </SettingGroup>

            <SettingGroup title={t(lang, 'general.group.wallpaper')}>
            <SettingRow
                title={t(lang, 'general.autoWallpaper.title')}
                description={t(lang, 'general.autoWallpaper.desc')}
            >
                <ToggleStub checked={autoWallpaper} onChange={setAutoWallpaper} accent={accent} />
            </SettingRow>
            <SettingRow
                title={t(lang, 'general.wallpaperDefault.title')}
                description={t(lang, 'general.wallpaperDefault.desc')}
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
                        {defaultWallpaper ? t(lang, 'general.wallpaperDefault.changeBtn') : t(lang, 'general.wallpaperDefault.setBtn')}
                    </button>
                    {defaultWallpaper && (
                        <button
                            onClick={onClearWallpaper}
                            className="px-2 py-1 rounded-md text-[11px] font-medium text-red-400 bg-zinc-800/60 hover:bg-red-900/40 border border-zinc-700/50 transition-colors cursor-pointer shrink-0"
                        >
                            {t(lang, 'general.wallpaperDefault.deleteBtn')}
                        </button>
                    )}
                </div>
            </SettingRow>
            <SettingRow
                title={t(lang, 'general.resetWallpaper.title')}
                description={t(lang, 'general.resetWallpaper.desc')}
            >
                <div className="flex flex-col items-end gap-1">
                    <ToggleStub checked={resetOnClose} onChange={setResetOnClose} disabled={!defaultWallpaper} accent={accent} />
                    {!defaultWallpaper && (
                        <span className="text-[10px] text-zinc-600 whitespace-nowrap">{t(lang, 'general.resetWallpaper.hint')}</span>
                    )}
                </div>
            </SettingRow>
            </SettingGroup>

            <SettingGroup title={t(lang, 'general.group.volume')}>
            <SettingRow
                title={t(lang, 'general.volumeMode.title')}
                description={t(lang, 'general.volumeMode.desc')}
            >
                <SelectStub
                    options={[[ 'app', t(lang, 'general.volumeMode.app') ], [ 'system', t(lang, 'general.volumeMode.system') ]]}
                    value={volumeMode}
                    onChange={setVolumeMode}
                />
            </SettingRow>
            <SettingRow
                title={t(lang, 'general.stepVolume.title')}
                description={t(lang, 'general.stepVolume.desc')}
            >
                <SelectStub
                    options={[
                        [ '1', '1' ],
                        [ '2', '2' ],
                        [ '3', '3' ],
                        [ '4', '4' ],
                        [ '5', '5' ],
                        [ '6', '6' ],
                        [ '7', '7' ],
                        [ '8', '8' ],
                        [ '9', '9' ],
                        [ '10', '10' ],
                    ]}
                    value={String(volumeStep)}
                    onChange={(v) => setVolumeStep(parseInt(v, 10))}
                />
            </SettingRow>
            <SettingRow
                title={t(lang, 'general.pauseIfMuted.title')}
                description={t(lang, 'general.pauseIfMuted.desc')}
            >
                <SelectStub
                    options={[
                        ['true', t(lang, 'general.pauseIfMuted.on')],
                        ['false', t(lang, 'general.pauseIfMuted.off')],
                    ]}
                    value={String(pauseIfMuted)}
                    onChange={(v) => setPauseIfMuted(v === 'true')}
                />
            </SettingRow>
            {volumeMode === 'system' && (
                <SettingRow
                    title={t(lang, 'general.volumeLimit.title')}
                    description={t(lang, 'general.volumeLimit.desc')}
                >
                    <VolumeLimitInput
                        volumeLimit={volumeLimit}
                        setVolumeLimit={setVolumeLimit}
                        currentVolume={volume}
                        lang={lang}
                    />
                </SettingRow>
            )}
            </SettingGroup>

            <SettingGroup title={t(lang, 'general.group.update')}>
            <SettingRow
                title={t(lang, 'general.update.title')}
                description={t(lang, 'general.update.desc')}
            >
                <UpdateControl
                    lang={lang}
                    accent={accent}
                    status={updateStatus}
                    checking={updateChecking}
                    downloaded={updateDownloaded}
                    total={updateTotal}
                    onCheck={onCheckUpdate}
                />
            </SettingRow>
            </SettingGroup>
        </div>
    );
}

function UpdateControl({
    lang,
    accent,
    status,
    checking,
    downloaded,
    total,
    onCheck,
}: {
    lang: Lang;
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
                    {checking ? t(lang, 'general.update.checking') : t(lang, 'general.update.checkBtn')}
                </button>
            </div>
        </div>
    );
}

function VolumeLimitInput({
    volumeLimit,
    setVolumeLimit,
    currentVolume,
    lang,
}: {
    volumeLimit: number;
    setVolumeLimit: (v: number) => void;
    currentVolume: number;
    lang: Lang;
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
                {t(lang, 'general.volumeLimit.save')}
            </button>
            {saved > 0 && (
                <span className="text-[10px] text-zinc-500">
                    {Math.round(currentVolume * 100) > saved ? t(lang, 'general.volumeLimit.over') : t(lang, 'general.volumeLimit.limit', {value: String(saved)})}
                </span>
            )}
        </div>
    );
}
