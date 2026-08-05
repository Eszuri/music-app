import type {LogEntry} from '../../types/log';

import type {Lang} from '../../lib/translations';

export type SectionId = 'general' | 'sort' | 'shortcut' | 'style' | 'audio' | 'changelog' | 'about' | 'debug';

export interface SettingsModalProps {
    lang: Lang;
    setLang: (v: Lang) => void;
    open: boolean;
    onClose: () => void;
    musicFolder: string | null;
    onChangeFolder: () => void;
    autoWallpaper: boolean;
    setAutoWallpaper: (v: boolean) => void;
    resetOnClose: boolean;
    setResetOnClose: (v: boolean) => void;
    volumeMode: string;
    setVolumeMode: (v: string) => void;
    volumeStep: number;
    setVolumeStep: (v: number) => void;
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
    layoutMode?: 'default' | 'compact' | 'immersive';
    setLayoutMode?: (v: 'default' | 'compact' | 'immersive') => void;
    outputDevice: string | null;
    setOutputDevice: (v: string | null) => void;
    outputMode: 'default' | 'bitperfect';
    setOutputMode: (v: 'default' | 'bitperfect') => void;
    onResetSidebarWidth: () => void;
    onResetAllSettings: () => void;
    logs: LogEntry[];
    onCheckUpdate: () => void;
    updateStatus: string;
    updateChecking: boolean;
    updateDownloaded: number;
    updateTotal: number;
}
