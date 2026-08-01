export const isBrowserTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

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
export const SESSION_STATE_KEY = 'music-app-session-state';

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
    convertFileSrc: (path: string) => string;
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

export function loadSavedFolder(): string | null {
    if (typeof window === 'undefined') return null;
    try {
        return window.localStorage.getItem(FOLDER_STORAGE_KEY);
    } catch {
        return null;
    }
}

export function safeSetLocalStorage(key: string, value: string) {
    try {
        window.localStorage.setItem(key, value);
    } catch {
    }
}

export function loadSessionState(): SessionState | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = window.localStorage.getItem(SESSION_STATE_KEY);
        if (!raw) return null;
        const s: SessionState = JSON.parse(raw);
        if (!s.filePath || typeof s.currentTime !== 'number') return null;
        return s;
    } catch {
        return null;
    }
}

export function saveSessionState(state: SessionState | null): void {
    if (typeof window === 'undefined') return;
    try {
        if (!state) {
            window.localStorage.removeItem(SESSION_STATE_KEY);
        } else {
            safeSetLocalStorage(SESSION_STATE_KEY, JSON.stringify({...state, timestamp: Date.now()}));
        }
    } catch {
        // ignore
    }
}
