'use client';

import ConfirmDialog from '../ConfirmDialog';
import SettingsModal from '../SettingsModal';
import StreamingModal from '../StreamingModal';
import type {LogEntry} from '../../types/log';

interface HomeModalsProps {
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
    volume: number;
    defaultWallpaper: string | null;
    onPickWallpaper: () => void;
    onClearWallpaper: () => void;
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
    volume,
    defaultWallpaper,
    onPickWallpaper,
    onClearWallpaper,
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
    logs,
    onCheckUpdate,
    updateStatus,
    updateChecking,
    updateDownloaded,
    updateTotal,
    streamingOpen,
    onCloseStreaming,
}: HomeModalsProps) {
    return (
        <>
            <ConfirmDialog
                open={pendingFolderChange}
                title="Ganti Folder Musik?"
                message="Musik sedang diputar. Mengganti folder akan menghentikan pemutaran saat ini. Lanjutkan?"
                confirmLabel="Ganti & Hentikan"
                cancelLabel="Batal"
                onConfirm={onConfirmFolderChange}
                onCancel={onCancelFolderChange}
                accentColor={accentColor}
            />
            <SettingsModal
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
                volume={volume}
                defaultWallpaper={defaultWallpaper}
                onPickWallpaper={onPickWallpaper}
                onClearWallpaper={onClearWallpaper}
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
                logs={logs}
                onCheckUpdate={onCheckUpdate}
                updateStatus={updateStatus}
                updateChecking={updateChecking}
                updateDownloaded={updateDownloaded}
                updateTotal={updateTotal}
            />
            <StreamingModal
                open={streamingOpen}
                onClose={onCloseStreaming}
                accentColor={accentColor}
            />
        </>
    );
}
