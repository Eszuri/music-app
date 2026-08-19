'use client';

import { useCallback, useEffect, useState } from 'react';
import { getAccent } from '../../lib/colors';
import { t, type Lang } from '../../lib/translations';
import { SettingGroup, SettingRow } from './controls';
import { useHoverDescription } from '../../hooks/useHoverDescription';
import {
    getStorageUsage,
    openConfigFolder,
    cleanLibraryCache,
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

export default function StorageSection({
    lang,
    accentColor = 'sky',
    onResetAllSettings,
}: {
    lang: Lang;
    accentColor?: string;
    onResetAllSettings: () => void;
}) {
    const accent = getAccent(accentColor);
    const [storageCleaning, setStorageCleaning] = useState(false);
    const [storageInfo, setStorageInfo] = useState<StorageUsage | null>(null);

    const [showCleanCacheConfirm, setShowCleanCacheConfirm] = useState(false);
    const [showCleanModelsConfirm, setShowCleanModelsConfirm] = useState(false);
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [showFullWipeConfirm, setShowFullWipeConfirm] = useState(false);

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

    const settingItemHover = useHoverDescription(t(lang, 'status.settingItem'));

    return (
        <div className="space-y-6">
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
                                {...settingItemHover}
                                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-zinc-200 bg-zinc-800 hover:bg-zinc-700 hover:text-white border border-zinc-700/60 shadow-xs transition-all cursor-pointer active:scale-[0.98]"
                            >
                                {t(lang, 'general.storage.openFolder')}
                            </button>
                        </div>
                        {storageInfo && (
                            <div className="flex flex-wrap items-center justify-end gap-2 text-[11px] text-zinc-400 font-mono">
                                <span>Config: {formatBytes(storageInfo.config_bytes)}</span>
                                <span>•</span>
                                <span>Models: {formatBytes(storageInfo.models_bytes)}</span>
                                <span>•</span>
                                <span>Plugins: {formatBytes(storageInfo.plugins_bytes)}</span>
                                <span>•</span>
                                <span>Cache: {formatBytes(storageInfo.cache_bytes)}</span>
                            </div>
                        )}
                    </div>
                </SettingRow>

                <SettingRow
                    title={t(lang, 'general.storage.cleanCache')}
                    description={t(lang, 'general.storage.cleanCacheDesc')}
                >
                    <button
                        onClick={() => setShowCleanCacheConfirm(true)}
                        disabled={storageCleaning}
                        {...settingItemHover}
                        className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 shadow-xs transition-all cursor-pointer active:scale-[0.98]"
                    >
                        {t(lang, 'general.storage.cleanCache')}
                    </button>
                </SettingRow>

                {storageInfo && storageInfo.models_bytes > 0 && (
                    <SettingRow
                        title={t(lang, 'general.storage.cleanModels')}
                        description={t(lang, 'general.storage.cleanModelsDesc')}
                    >
                        <button
                            onClick={() => setShowCleanModelsConfirm(true)}
                            disabled={storageCleaning}
                            {...settingItemHover}
                            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 shadow-xs transition-all cursor-pointer active:scale-[0.98]"
                        >
                            {t(lang, 'general.storage.cleanModels')}
                        </button>
                    </SettingRow>
                )}
            </SettingGroup>

            <SettingGroup title={t(lang, 'general.group.reset')}>
                <SettingRow
                    title={t(lang, 'general.resetSettings.title')}
                    description={t(lang, 'general.resetSettings.desc')}
                >
                    <button
                        onClick={() => setShowResetConfirm(true)}
                        {...settingItemHover}
                        className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-zinc-200 bg-zinc-800 hover:bg-zinc-700 hover:text-white border border-zinc-700/60 shadow-xs transition-all cursor-pointer active:scale-[0.98]"
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
                        {...settingItemHover}
                        className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 shadow-xs transition-all cursor-pointer active:scale-[0.98]"
                    >
                        {t(lang, 'general.storage.cleanAll')}
                    </button>
                </SettingRow>
            </SettingGroup>

            {/* Clean Library Cache Confirmation Modal */}
            {showCleanCacheConfirm && (
                <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="bg-zinc-900 border border-sky-800/60 rounded-xl p-5 w-95 max-w-[90vw] shadow-2xl">
                        <h3 className="text-sm font-semibold text-sky-300 mb-2">
                            {t(lang, 'general.storage.cleanCache')}
                        </h3>
                        <p className="text-xs text-zinc-400 mb-5 leading-relaxed">
                            {t(lang, 'general.storage.cleanCacheConfirm')}
                        </p>
                        <div className="flex justify-end gap-2.5">
                            <button
                                onClick={() => setShowCleanCacheConfirm(false)}
                                className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/60 shadow-xs transition-all cursor-pointer active:scale-[0.98]"
                            >
                                {t(lang, 'confirm.defaultCancel')}
                            </button>
                            <button
                                onClick={async () => {
                                    setStorageCleaning(true);
                                    await cleanLibraryCache();
                                    await refreshStorage();
                                    setStorageCleaning(false);
                                    setShowCleanCacheConfirm(false);
                                }}
                                className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 shadow-sm transition-all cursor-pointer active:scale-[0.98]"
                            >
                                {t(lang, 'general.storage.cleanCache')}
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
                        <div className="flex justify-end gap-2.5">
                            <button
                                onClick={() => setShowCleanModelsConfirm(false)}
                                className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/60 shadow-xs transition-all cursor-pointer active:scale-[0.98]"
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
                                className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 shadow-sm transition-all cursor-pointer active:scale-[0.98]"
                            >
                                {t(lang, 'general.storage.cleanModels')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
                        <div className="flex justify-end gap-2.5">
                            <button
                                onClick={() => setShowResetConfirm(false)}
                                className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/60 shadow-xs transition-all cursor-pointer active:scale-[0.98]"
                            >
                                {t(lang, 'confirm.defaultCancel')}
                            </button>
                            <button
                                onClick={onResetAllSettings}
                                className={`px-4 py-2 rounded-lg text-xs font-semibold text-white ${accent.bg500} hover:brightness-110 shadow-sm transition-all cursor-pointer active:scale-[0.98]`}
                            >
                                {t(lang, 'general.resetSettings.confirm')}
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
                        <div className="flex justify-end gap-2.5">
                            <button
                                onClick={() => setShowFullWipeConfirm(false)}
                                className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/60 shadow-xs transition-all cursor-pointer active:scale-[0.98]"
                            >
                                {t(lang, 'confirm.defaultCancel')}
                            </button>
                            <button
                                onClick={async () => {
                                    setStorageCleaning(true);
                                    await cleanAllAppData();
                                    window.location.reload();
                                }}
                                className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 shadow-sm transition-all cursor-pointer active:scale-[0.98]"
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
