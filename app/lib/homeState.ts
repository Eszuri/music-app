export const isBrowserTauri = typeof window !== 'undefined';

export const FOLDER_STORAGE_KEY = 'music-app-folder';
export const AUTO_WALLPAPER_KEY = 'music-app-auto-wallpaper';
export const RESET_ON_CLOSE_KEY = 'music-app-reset-on-close';
export const FOLDER_SORT_KEY = 'music-app-folder-sort';
export const FILE_SORT_KEY = 'music-app-file-sort';
export const SORT_DIR_KEY = 'music-app-sort-dir';
export const NAME_SOURCE_KEY = 'music-app-name-source';
export const SHORTCUTS_KEY = 'music-app-shortcuts';
export const ACCENT_KEY = 'music-app-accent';
export const CUSTOM_ACCENT_KEY = 'music-app-custom-accent';
export const WALLPAPER_KEY = 'music-app-wallpaper';
export const FORMATS_KEY = 'music-app-formats';
export const VOLUME_MODE_KEY = 'music-app-volume-mode';
export const VOLUME_LIMIT_KEY = 'music-app-volume-limit';
export const VOLUME_STEP_KEY = 'music-app-volume-step';
export const DEFAULT_VOLUME_STEP = 2;
export const LANGUAGE_KEY = 'music-app-language';
export const DEFAULT_LANGUAGE = 'en';
export const UPDATE_SKIP_KEY = 'music-app-update-skip';
const SESSION_STATE_KEY = 'music-app-session-state';
export const OUTPUT_MODE_KEY = 'music-app-output-mode';
export const OUTPUT_DEVICE_KEY = 'music-app-output-device';
export const LAYOUT_MODE_KEY = 'music-app-layout-mode';

export type ShortcutAction = 'playPause' | 'next' | 'prev' | 'volumeUp' | 'volumeDown';

export const DEFAULT_SHORTCUTS: Record<ShortcutAction, string> = {
    playPause: ' ',
    next: 'n',
    prev: 'p',
    volumeUp: 'ArrowRight',
    volumeDown: 'ArrowLeft',
};

export const DEFAULT_FORMATS = ['mp3', 'flac', 'ogg', 'wav', 'm4a', 'wma'];

export interface TauriCore {
    invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
    convertFileSrc: (path: string, protocol?: string) => string;
}

export interface SessionState {
    filePath: string;
    currentTime: number;
    timestamp: number;
}

let tauriMod: TauriCore | null = null;

export async function getTauri(): Promise<TauriCore> {
    if (tauriMod) return Promise.resolve(tauriMod);
    return import('@tauri-apps/api/core').then((mod) => {
        tauriMod = mod as unknown as TauriCore;
        return tauriMod;
    });
}

import { getStoredValue, setStoredValue } from './storage';

export function loadSavedFolder(): string | null {
    return getStoredValue('music_folder', null);
}

export function loadSessionState(): SessionState | null {
    const raw = getStoredValue('last_session', null);
    if (!raw || !raw.file_path || typeof raw.current_time !== 'number') {
        return null;
    }
    return {
        filePath: raw.file_path,
        currentTime: raw.current_time,
        timestamp: raw.timestamp,
    };
}

export function saveSessionState(state: SessionState | null): void {
    if (!state) {
        setStoredValue('last_session', null);
    } else {
        const payload = {
            file_path: state.filePath,
            current_time: state.currentTime,
            timestamp: state.timestamp || Date.now(),
        };
        setStoredValue('last_session', payload, { debounceMs: 1000 });
    }
}
