export function isBrowserTauri(): boolean {
    return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

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

// M2: Import from dedicated module to break circular dependency with storage.ts
import { getTauri } from './tauri';
export { getTauri };
export type { TauriCore } from './tauri';

export interface SessionState {
    filePath: string;
    currentTime: number;
    timestamp: number;
}

import { getStoredValue, setStoredValue, syncConfigFromBackend, type SymvoniaConfig } from './storage';

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

export async function fetchSessionState(): Promise<SessionState | null> {
    const fromMemory = loadSessionState();
    if (fromMemory) return fromMemory;
    if (isBrowserTauri()) {
        try {
            const mod = await getTauri();
            const cfg = await mod.invoke<SymvoniaConfig>('get_app_config');
            if (cfg) {
                syncConfigFromBackend(cfg);
                if (cfg.last_session && cfg.last_session.file_path && typeof cfg.last_session.current_time === 'number') {
                    return {
                        filePath: cfg.last_session.file_path,
                        currentTime: cfg.last_session.current_time,
                        timestamp: cfg.last_session.timestamp,
                    };
                }
            }
        } catch {
            // ignore
        }
    }
    return null;
}

export function saveSessionState(state: SessionState | null, immediate?: boolean): void {
    if (!state) {
        setStoredValue('last_session', null);
    } else {
        const payload = {
            file_path: state.filePath,
            current_time: state.currentTime,
            timestamp: state.timestamp || Date.now(),
        };
        setStoredValue('last_session', payload, immediate ? undefined : { debounceMs: 1000 });
    }
}
