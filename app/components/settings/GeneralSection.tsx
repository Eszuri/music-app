'use client';

import {useCallback, useEffect, useState} from 'react';
import {motion} from 'framer-motion';
import type {KeyboardEvent} from 'react';
import {getAccent} from '../../lib/colors';
import {t, type Lang} from '../../lib/translations';
import {SelectStub, SettingGroup, SettingRow, ToggleStub} from './controls';
import {useHoverDescription} from '../../hooks/useHoverDescription';
import type {OutputMode} from '../../lib/storage';
import {
    getStorageUsage,
    openConfigFolder,
    cleanAiModelsData,
    cleanAllAppData,
    type StorageUsage,
} from '../../lib/storage';

function formatBytes(bytes: number): string {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

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
    fadeAudio,
    setFadeAudio,
    fadeDuration,
    setFadeDuration,
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
    onResetAllSettings,
    outputMode,
    nativeOutputActive = false,
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
    fadeAudio: boolean;
    setFadeAudio: (v: boolean) => void;
    fadeDuration: number;
    setFadeDuration: (v: number) => void;
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
    onResetAllSettings: () => void;
    outputMode?: OutputMode;
    nativeOutputActive?: boolean;
}) {
    const accent = getAccent(accentColor);
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [showCleanModelsConfirm, setShowCleanModelsConfirm] = useState(false);
    const [showFullWipeConfirm, setShowFullWipeConfirm] = useState(false);
    const [storageCleaning, setStorageCleaning] = useState(false);
    const [storageInfo, setStorageInfo] = useState<StorageUsage | null>(null);

    const refreshStorage = useCallback(async () => {
        const usage = await getStorageUsage();
        if (usage) setStorageInfo(usage);
    }, []);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void refreshStorage();
        }, 0);
        return () => window.clearTimeout(timer);
    }, [refreshStorage]);

    const folderBtnHover = useHoverDescription(t(lang, 'status.changeFolder'));
    const wallpaperChangeBtnHover = useHoverDescription(t(lang, 'status.settingItem'));
    const wallpaperDeleteBtnHover = useHoverDescription(t(lang, 'status.settingItem'));
    const resetBtnHover = useHoverDescription(t(lang, 'status.settingItem'));
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
                    <div className="flex items-center gap-2 max-w-65">
                        {musicFolder ? (
                            <div className="text-xs text-zinc-400 font-mono truncate flex-1" title={musicFolder}>
                                {musicFolder}
                            </div>
                        ) : (
                            <div className="text-xs text-zinc-600 flex-1" />
                        )}
                        <button
                            {...folderBtnHover}
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
                    <div className="flex items-center gap-2 max-w-65">
                        {defaultWallpaper ? (
                            <div className="text-xs text-zinc-400 font-mono truncate flex-1" title={defaultWallpaper}>
                                {defaultWallpaper.split('\\').pop()?.split('/').pop()}
                            </div>
                        ) : (
                            <div className="text-xs text-zinc-600 flex-1" />
                        )}
                        <button
                            {...wallpaperChangeBtnHover}
                            onClick={onPickWallpaper}
                            className="px-2.5 py-1 rounded-md text-[11px] font-medium text-zinc-300 bg-zinc-800/60 hover:bg-zinc-700/70 border border-zinc-700/50 transition-colors cursor-pointer shrink-0"
                        >
                            {defaultWallpaper ? t(lang, 'general.wallpaperDefault.changeBtn') : t(lang, 'general.wallpaperDefault.setBtn')}
                        </button>
                        {defaultWallpaper && (
                            <button
                                {...wallpaperDeleteBtnHover}
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
                        description={nativeOutputActive
                            ? t(lang, 'general.volumeMode.nativeDisabled')
                            : t(lang, 'general.volumeMode.desc')}
                >
                    <SelectStub
                        ariaLabel={t(lang, 'general.volumeMode.title')}
                        disabled={nativeOutputActive}
                        options={[['app', t(lang, 'general.volumeMode.app')], ['system', t(lang, 'general.volumeMode.system')]]}
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
                            ['1', '1'],
                            ['2', '2'],
                            ['3', '3'],
                            ['4', '4'],
                            ['5', '5'],
                            ['6', '6'],
                            ['7', '7'],
                            ['8', '8'],
                            ['9', '9'],
                            ['10', '10'],
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
                <SettingRow
                    title={t(lang, 'general.fadeAudio.title')}
                    description={
                        outputMode !== 'html_audio'
                            ? t(lang, 'general.fadeAudio.disabledNative')
                            : t(lang, 'general.fadeAudio.desc')
                    }
                >
                    <div className="flex flex-col items-end gap-1.5">
                        <div>
                            <SelectStub
                                ariaLabel={t(lang, 'general.fadeAudio.title')}
                                disabled={outputMode !== 'html_audio'}
                                options={[
                                    ['true', t(lang, 'general.pauseIfMuted.on')],
                                    ['false', t(lang, 'general.pauseIfMuted.off')],
                                ]}
                                value={String(fadeAudio)}
                                onChange={(v) => setFadeAudio(v === 'true')}
                            />
                        </div>
                        {outputMode !== 'html_audio' && (
                            <span className="text-[10px] font-semibold text-amber-400/90 bg-amber-950/40 border border-amber-800/40 px-2 py-0.5 rounded-md flex items-center gap-1">
                                🔒 {t(lang, 'general.fadeAudio.disabledNative')}
                            </span>
                        )}
                    </div>
                </SettingRow>
                {fadeAudio && outputMode === 'html_audio' && (
                    <SettingRow
                        title={t(lang, 'general.fadeDuration.title')}
                        description={t(lang, 'general.fadeDuration.desc')}
                    >
                        <SelectStub
                            options={[
                                ['200', '200 ms (0.2s)'],
                                ['300', '300 ms (0.3s)'],
                                ['500', '500 ms (0.5s)'],
                                ['800', '800 ms (0.8s)'],
                                ['1000', '1000 ms (1.0s)'],
                                ['1500', '1500 ms (1.5s)'],
                            ]}
                            value={String(fadeDuration)}
                            onChange={(v) => setFadeDuration(parseInt(v, 10))}
                        />
                    </SettingRow>
                )}
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

            <SettingGroup title={t(lang, 'general.group.storage')}>
                <SettingRow
                    title={t(lang, 'general.storage.total')}
                    description={t(lang, 'general.storage.desc')}
                >
                    <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-3 text-xs text-zinc-300">
                            {storageInfo ? (
                                <span className="font-mono font-medium text-zinc-200">
                                    {formatBytes(storageInfo.total_bytes)}
                                </span>
                            ) : (
                                <span className="text-zinc-500 font-mono">--</span>
                            )}
                            <button
                                onClick={openConfigFolder}
                                className="px-2.5 py-1 rounded-md text-[11px] font-medium text-zinc-300 bg-zinc-800/60 hover:bg-zinc-700/70 border border-zinc-700/50 transition-colors cursor-pointer"
                            >
                                {t(lang, 'general.storage.openFolder')}
                            </button>
                        </div>
                        {storageInfo && (
                            <div className="flex items-center gap-3 text-[11px] text-zinc-400 font-mono">
                                <span>Config: {formatBytes(storageInfo.config_bytes)}</span>
                                <span>•</span>
                                <span>Models: {formatBytes(storageInfo.models_bytes)}</span>
                            </div>
                        )}
                    </div>
                </SettingRow>

                {storageInfo && storageInfo.models_bytes > 0 && (
                    <SettingRow
                        title={t(lang, 'general.storage.cleanModels')}
                        description={t(lang, 'general.storage.cleanModelsDesc')}
                    >
                        <button
                            onClick={() => setShowCleanModelsConfirm(true)}
                            disabled={storageCleaning}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium text-amber-400 bg-amber-950/30 hover:bg-amber-900/40 border border-amber-800/40 transition-colors cursor-pointer"
                        >
                            {t(lang, 'general.storage.cleanModels')}
                        </button>
                    </SettingRow>
                )}

                <SettingRow
                    title={t(lang, 'general.resetSettings.title')}
                    description={t(lang, 'general.resetSettings.desc')}
                >
                    <button
                        {...resetBtnHover}
                        onClick={() => setShowResetConfirm(true)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-300 bg-zinc-800/60 hover:bg-zinc-700/70 border border-zinc-700/50 transition-colors cursor-pointer"
                    >
                        {t(lang, 'general.resetSettings.button')}
                    </button>
                </SettingRow>

                <SettingRow
                    title={t(lang, 'general.storage.cleanAll')}
                    description={t(lang, 'general.storage.cleanAllDesc')}
                >
                    <button
                        onClick={() => setShowFullWipeConfirm(true)}
                        disabled={storageCleaning}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 bg-red-950/30 hover:bg-red-900/50 border border-red-800/40 transition-colors cursor-pointer"
                    >
                        {t(lang, 'general.storage.cleanAll')}
                    </button>
                </SettingRow>
            </SettingGroup>

            {/* Reset Settings Confirmation Modal */}
            {showResetConfirm && (
                <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 w-95 max-w-[90vw] shadow-2xl">
                        <h3 className="text-sm font-semibold text-zinc-100 mb-2">
                            {t(lang, 'general.resetSettings.confirmTitle')}
                        </h3>
                        <p className="text-xs text-zinc-400 mb-5 leading-relaxed">
                            {t(lang, 'general.resetSettings.confirmMessage')}
                        </p>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setShowResetConfirm(false)}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-300 bg-zinc-800/60 hover:bg-zinc-700/70 border border-zinc-700/50 transition-colors cursor-pointer"
                            >
                                {t(lang, 'confirm.defaultCancel')}
                            </button>
                            <button
                                onClick={onResetAllSettings}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium text-white ${accent.bg500} hover:opacity-90 transition-opacity cursor-pointer border ${accent.border500}`}
                            >
                                {t(lang, 'general.resetSettings.confirm')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Clean AI Models Confirmation Modal */}
            {showCleanModelsConfirm && (
                <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 w-95 max-w-[90vw] shadow-2xl">
                        <h3 className="text-sm font-semibold text-amber-300 mb-2">
                            {t(lang, 'general.storage.cleanModels')}
                        </h3>
                        <p className="text-xs text-zinc-400 mb-5 leading-relaxed">
                            {t(lang, 'general.storage.cleanModelsConfirm')}
                        </p>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setShowCleanModelsConfirm(false)}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-300 bg-zinc-800/60 hover:bg-zinc-700/70 border border-zinc-700/50 transition-colors cursor-pointer"
                            >
                                {t(lang, 'confirm.defaultCancel')}
                            </button>
                            <button
                                onClick={async () => {
                                    setStorageCleaning(true);
                                    await cleanAiModelsData();
                                    await refreshStorage();
                                    setStorageCleaning(false);
                                    setShowCleanModelsConfirm(false);
                                }}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-amber-600 hover:bg-amber-500 transition-colors cursor-pointer"
                            >
                                {t(lang, 'general.storage.cleanModels')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Full Wipe Confirmation Modal */}
            {showFullWipeConfirm && (
                <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="bg-zinc-900 border border-red-800/60 rounded-xl p-5 w-95 max-w-[90vw] shadow-2xl">
                        <h3 className="text-sm font-semibold text-red-400 mb-2">
                            {t(lang, 'general.storage.cleanAll')}
                        </h3>
                        <p className="text-xs text-zinc-400 mb-5 leading-relaxed">
                            {t(lang, 'general.storage.cleanAllConfirm')}
                        </p>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setShowFullWipeConfirm(false)}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-300 bg-zinc-800/60 hover:bg-zinc-700/70 border border-zinc-700/50 transition-colors cursor-pointer"
                            >
                                {t(lang, 'confirm.defaultCancel')}
                            </button>
                            <button
                                onClick={async () => {
                                    setStorageCleaning(true);
                                    await cleanAllAppData();
                                    window.location.reload();
                                }}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-red-600 hover:bg-red-500 transition-colors cursor-pointer"
                            >
                                {t(lang, 'general.storage.cleanAll')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
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
    const updateBtnHover = useHoverDescription(t(lang, 'status.settingItem'));
    return (
        <div className="flex flex-col items-end gap-2 min-w-65">
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
                    <span className="text-xs text-zinc-400 max-w-40 truncate" title={status}>
                        {status}
                    </span>
                )}
                <button
                    {...updateBtnHover}
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
        const frame = requestAnimationFrame(() => {
            setDraft(volumeLimit.toString());
            setSaved(volumeLimit);
        });
        return () => cancelAnimationFrame(frame);
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
