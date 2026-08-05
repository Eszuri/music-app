'use client';

import ConfirmDialog from '../ConfirmDialog';
import SettingsModal from '../SettingsModal';
import StreamingModal from '../StreamingModal';
import type {LogEntry} from '../../types/log';
import {t, type Lang} from '../../lib/translations';

interface HomeModalsProps {
    lang: Lang;
    setLang: (v: Lang) => void;
    pendingFolderChange: boolean;
    onConfirmFolderChange: () => void;
    onCancelFolderChange: () => void;
    settingsOpen: boolean;
    onCloseSettings: () => void;
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
    layoutMode?: 'default' | 'compact' | 'immersive';
    setLayoutMode?: (v: 'default' | 'compact' | 'immersive') => void;
    outputDevice: string | null;
    setOutputDevice: (v: string | null) => void;
    outputMode: 'default' | 'bitperfect';
    setOutputMode: (v: 'default' | 'bitperfect') => void;
    folderSort: string;
    setFolderSort: (v: string) => void;
    fileSort: string;
    setFileSort: (v: string) => void;
    sortDir: string;
    setSortDir: (v: string) => void;
    nameSource: string;
    setNameSource: (v: string) => void;
    formats: string[];
    setFormats: (v: string[]) => void;
    shortcuts: Record<string, string>;
    updateShortcut: (action: string, key: string) => void;
    resetShortcuts: () => void;
    accentColor: string;
    setAccentColor: (v: string) => void;
    customAccentHex: string;
    setCustomAccentHex: (v: string) => void;
    onResetSidebarWidth: () => void;
    onResetAllSettings: () => void;
    logs: LogEntry[];
    onCheckUpdate: () => void;
    updateStatus: string;
    updateChecking: boolean;
    updateDownloaded: number;
    updateTotal: number;
    streamingOpen: boolean;
    onCloseStreaming: () => void;
}

export default function HomeModals({
    lang,
    pendingFolderChange,
    onConfirmFolderChange,
    onCancelFolderChange,
    settingsOpen,
    onCloseSettings,
    musicFolder,
    onChangeFolder,
    autoWallpaper,
    setAutoWallpaper,
    resetOnClose,
    setResetOnClose,
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
    layoutMode = 'default',
    setLayoutMode,
    outputDevice,
    setOutputDevice,
    outputMode,
    setOutputMode,
    folderSort,
    setFolderSort,
    fileSort,
    setFileSort,
    sortDir,
    setSortDir,
    nameSource,
    setNameSource,
    formats,
    setFormats,
    shortcuts,
    updateShortcut,
    resetShortcuts,
    accentColor,
    setAccentColor,
    customAccentHex,
    setCustomAccentHex,
    onResetSidebarWidth,
    onResetAllSettings,
    logs,
    onCheckUpdate,
    updateStatus,
    updateChecking,
    updateDownloaded,
    setLang,
    updateTotal,
    streamingOpen,
    onCloseStreaming,
}: HomeModalsProps) {
    return (
        <>
            <ConfirmDialog
                lang={lang}
                open={pendingFolderChange}
                title={t(lang, 'homeModal.changeFolderTitle')}
                message={t(lang, 'homeModal.changeFolderMessage')}
                confirmLabel={t(lang, 'homeModal.changeFolderConfirm')}
                cancelLabel={t(lang, 'homeModal.cancel')}
                onConfirm={onConfirmFolderChange}
                onCancel={onCancelFolderChange}
                accentColor={accentColor}
            />
            <SettingsModal
                lang={lang}
                setLang={setLang}
                open={settingsOpen}
                onClose={onCloseSettings}
                musicFolder={musicFolder}
                onChangeFolder={onChangeFolder}
                autoWallpaper={autoWallpaper}
                setAutoWallpaper={setAutoWallpaper}
                resetOnClose={resetOnClose}
                setResetOnClose={setResetOnClose}
                volumeStep={volumeStep}
                setVolumeStep={setVolumeStep}
                volumeMode={volumeMode}
                setVolumeMode={setVolumeMode}
                volumeLimit={volumeLimit}
                setVolumeLimit={setVolumeLimit}
                pauseIfMuted={pauseIfMuted}
                setPauseIfMuted={setPauseIfMuted}
                fadeAudio={fadeAudio}
                setFadeAudio={setFadeAudio}
                fadeDuration={fadeDuration}
                setFadeDuration={setFadeDuration}
                volume={volume}
                defaultWallpaper={defaultWallpaper}
                onPickWallpaper={onPickWallpaper}
                onClearWallpaper={onClearWallpaper}
                layoutMode={layoutMode}
                setLayoutMode={setLayoutMode}
                outputDevice={outputDevice}
                setOutputDevice={setOutputDevice}
                outputMode={outputMode}
                setOutputMode={setOutputMode}
                folderSort={folderSort}
                setFolderSort={setFolderSort}
                fileSort={fileSort}
                setFileSort={setFileSort}
                sortDir={sortDir}
                setSortDir={setSortDir}
                nameSource={nameSource}
                setNameSource={setNameSource}
                formats={formats}
                setFormats={setFormats}
                shortcuts={shortcuts}
                updateShortcut={updateShortcut}
                resetShortcuts={resetShortcuts}
                accentColor={accentColor}
                setAccentColor={setAccentColor}
                customAccentHex={customAccentHex}
                setCustomAccentHex={setCustomAccentHex}
                onResetSidebarWidth={onResetSidebarWidth}
                onResetAllSettings={onResetAllSettings}
                logs={logs}
                onCheckUpdate={onCheckUpdate}
                updateStatus={updateStatus}
                updateChecking={updateChecking}
                updateDownloaded={updateDownloaded}
                updateTotal={updateTotal}
            />
            <StreamingModal
                lang={lang}
                open={streamingOpen}
                onClose={onCloseStreaming}
                accentColor={accentColor}
            />
        </>
    );
}
