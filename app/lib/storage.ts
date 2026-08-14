'use client';

import { getTauri } from './homeState';

export interface EqualizerConfig {
    enabled: boolean;
    preset: string;
    bands: number[];
    pre_amp: number;
}

export interface SessionConfig {
    file_path: string;
    current_time: number;
    timestamp: number;
}

export interface StreamEntryConfig {
    id: string;
    title: string;
    url: string;
    timestamp: number;
}

export interface StorageUsage {
    config_bytes: number;
    plugins_bytes: number;
    models_bytes: number;
    total_bytes: number;
    config_path: string;
    app_data_dir: string;
}

export interface SymvoniaConfig {
    music_folder: string | null;
    language: 'id' | 'en';
    accent_color: string;
    custom_accent_hex: string;
    layout_mode: 'default' | 'spotify';
    auto_wallpaper: boolean;
    reset_on_close: boolean;
    default_wallpaper: string | null;
    volume_mode: 'app' | 'system';
    app_volume: number;
    volume_step: number;
    volume_limit: number;
    pause_if_muted: boolean;
    fade_audio: boolean;
    fade_duration: number;
    folder_sort: string;
    file_sort: string;
    sort_dir: 'asc' | 'desc';
    name_source: 'filename' | 'title';
    formats: string[];
    shuffle: boolean;
    repeat: 'off' | 'all' | 'one';
    shortcuts: Record<string, string>;
    sidebar_width: number;
    meta_width: number;
    autohide_delay_ms: number;
    output_mode: 'default' | 'bitperfect';
    output_device: string | null;
    equalizer: EqualizerConfig;
    gain_boost: number;
    ai_lyrics_model: string;
    ai_isolate_vocals: boolean;
    active_metadata_tab: string;
    last_session: SessionConfig | null;
    stream_history: StreamEntryConfig[];
    fullscreen: boolean;
    skipped_update_version: string | null;
}

export const DEFAULT_CONFIG: SymvoniaConfig = {
    music_folder: null,
    language: 'en',
    accent_color: 'sky',
    custom_accent_hex: '#0284c7',
    layout_mode: 'default',
    auto_wallpaper: true,
    reset_on_close: true,
    default_wallpaper: null,
    volume_mode: 'app',
    app_volume: 1.0,
    volume_step: 2,
    volume_limit: 0,
    pause_if_muted: true,
    fade_audio: true,
    fade_duration: 500,
    folder_sort: 'name',
    file_sort: 'name',
    sort_dir: 'asc',
    name_source: 'filename',
    formats: ['mp3', 'flac', 'ogg', 'wav', 'm4a', 'wma'],
    shuffle: false,
    repeat: 'off',
    shortcuts: {
        playPause: ' ',
        next: 'n',
        prev: 'p',
        volumeUp: 'ArrowRight',
        volumeDown: 'ArrowLeft',
    },
    sidebar_width: 360,
    meta_width: 360,
    autohide_delay_ms: 3000,
    output_mode: 'default',
    output_device: null,
    equalizer: {
        enabled: false,
        preset: 'flat',
        bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        pre_amp: 0,
    },
    gain_boost: 0,
    ai_lyrics_model: 'base',
    ai_isolate_vocals: false,
    active_metadata_tab: 'info',
    last_session: null,
    stream_history: [],
    fullscreen: false,
    skipped_update_version: null,
};

// Global in-memory configuration cache
let inMemoryConfig: SymvoniaConfig | null = null;

// Debounce timer map for saving settings to disk
const saveTimers: Record<string, ReturnType<typeof setTimeout>> = {};

/**
 * Get synchronous initial configuration from native pre-runtime injection or memory cache
 */
export function getInitialConfig(): SymvoniaConfig {
    if (typeof window !== 'undefined') {
        const injected = (window as unknown as { __SYMVONIA_INITIAL_CONFIG__?: SymvoniaConfig }).__SYMVONIA_INITIAL_CONFIG__;
        if (injected && typeof injected === 'object' && injected.language) {
            const conf: SymvoniaConfig = { ...DEFAULT_CONFIG, ...injected };
            inMemoryConfig = conf;
            return conf;
        }
    }

    if (!inMemoryConfig) {
        inMemoryConfig = { ...DEFAULT_CONFIG };
    }
    return inMemoryConfig;
}

/**
 * Synchronize in-memory cache when full config is received from Rust backend
 */
export function syncConfigFromBackend(backendConfig: Partial<SymvoniaConfig>): SymvoniaConfig {
    const current = getInitialConfig();
    const updated: SymvoniaConfig = {
        ...current,
        ...backendConfig,
    };
    inMemoryConfig = updated;

    if (typeof window !== 'undefined') {
        const win = window as unknown as { __SYMVONIA_INITIAL_CONFIG__?: SymvoniaConfig };
        win.__SYMVONIA_INITIAL_CONFIG__ = updated;
    }

    return updated;
}

/**
 * Fetch full configuration from Rust backend and update storage
 */
export async function loadConfigFromBackend(): Promise<SymvoniaConfig | null> {
    if (typeof window === 'undefined') return null;
    try {
        const tauri = await getTauri();
        const cfg = await tauri.invoke<SymvoniaConfig>('get_app_config');
        if (cfg) {
            return syncConfigFromBackend(cfg);
        }
    } catch (err) {
        console.error('[Symvonia Storage] Failed to load config from backend:', err);
    }
    return null;
}

/**
 * Read a stored configuration value synchronously from in-memory / injected cache
 */
export function getStoredValue<K extends keyof SymvoniaConfig>(
    key: K,
    defaultValue?: SymvoniaConfig[K]
): SymvoniaConfig[K] {
    const config = getInitialConfig();
    const val = config[key];
    if (val !== undefined && val !== null) {
        return val;
    }
    return defaultValue !== undefined ? defaultValue : DEFAULT_CONFIG[key];
}

/**
 * Update a configuration value with instant memory update + persistent storage write to Rust backend
 */
export function setStoredValue<K extends keyof SymvoniaConfig>(
    key: K,
    value: SymvoniaConfig[K],
    options?: { debounceMs?: number }
): void {
    const config = getInitialConfig();
    config[key] = value;
    inMemoryConfig = config;

    if (typeof window !== 'undefined') {
        const win = window as unknown as { __SYMVONIA_INITIAL_CONFIG__?: SymvoniaConfig };
        win.__SYMVONIA_INITIAL_CONFIG__ = config;
    }

    const performSave = async () => {
        try {
            const tauri = await getTauri();
            await tauri.invoke('set_app_config_key', {
                key: String(key),
                value,
            });
        } catch (err) {
            console.error(`[Symvonia Storage] Failed to persist key "${String(key)}":`, err);
        }
    };

    const debounceMs = options?.debounceMs ?? 0;
    if (debounceMs > 0) {
        if (saveTimers[key as string]) {
            clearTimeout(saveTimers[key as string]);
        }
        saveTimers[key as string] = setTimeout(() => {
            performSave();
            delete saveTimers[key as string];
        }, debounceMs);
    } else {
        performSave();
    }
}

/**
 * Fetch detailed storage usage statistics from Rust backend
 */
export async function getStorageUsage(): Promise<StorageUsage | null> {
    if (typeof window === 'undefined') return null;
    try {
        const tauri = await getTauri();
        return await tauri.invoke<StorageUsage>('get_storage_usage');
    } catch (err) {
        console.error('[Symvonia Storage] Failed to get storage usage:', err);
        return null;
    }
}

/**
 * Open the configuration folder in Windows Explorer
 */
export async function openConfigFolder(): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
        const tauri = await getTauri();
        await tauri.invoke('open_config_folder');
    } catch (err) {
        console.error('[Symvonia Storage] Failed to open config folder:', err);
    }
}

/**
 * Clean and delete all downloaded AI models to free disk space
 */
export async function cleanAiModelsData(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    try {
        const tauri = await getTauri();
        await tauri.invoke('clean_ai_models_data');
        return true;
    } catch (err) {
        console.error('[Symvonia Storage] Failed to clean AI models:', err);
        return false;
    }
}

/**
 * Reset all configuration settings to factory defaults
 */
export async function resetAppConfig(): Promise<SymvoniaConfig> {
    inMemoryConfig = { ...DEFAULT_CONFIG };
    if (typeof window !== 'undefined') {
        const win = window as unknown as { __SYMVONIA_INITIAL_CONFIG__?: SymvoniaConfig };
        win.__SYMVONIA_INITIAL_CONFIG__ = inMemoryConfig;
    }
    try {
        const tauri = await getTauri();
        const res = await tauri.invoke<SymvoniaConfig>('reset_app_config');
        inMemoryConfig = res;
        return res;
    } catch (err) {
        console.error('[Symvonia Storage] Failed to reset config:', err);
    }
    return DEFAULT_CONFIG;
}

/**
 * Wipe all application data (config, plugins, and AI models)
 */
export async function cleanAllAppData(): Promise<boolean> {
    inMemoryConfig = { ...DEFAULT_CONFIG };
    if (typeof window !== 'undefined') {
        const win = window as unknown as { __SYMVONIA_INITIAL_CONFIG__?: SymvoniaConfig };
        win.__SYMVONIA_INITIAL_CONFIG__ = inMemoryConfig;
    }
    try {
        const tauri = await getTauri();
        await tauri.invoke('clean_all_app_data');
        return true;
    } catch (err) {
        console.error('[Symvonia Storage] Failed to clean all app data:', err);
        return false;
    }
}
