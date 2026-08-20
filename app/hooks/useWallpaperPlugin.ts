'use client';

import { useState, useEffect, useCallback } from 'react';
import { getTauri, isBrowserTauri } from '../lib/homeState';

export interface WallpaperPluginStatus {
    installed: boolean;
    path?: string | null;
    size_bytes?: number | null;
    sha256?: string | null;
}

export interface WallpaperDownloadProgress {
    downloaded: number;
    total: number;
}

export interface WallpaperEngineState {
    is_running: boolean;
    state: string;
    scene: string;
    texture_path?: string | null;
    fit_mode: string;
    fps: number;
    intensity: number;
    monitor_count: number;
    last_error?: string | null;
}

let globalPluginStatus: WallpaperPluginStatus = { installed: false };
let globalEngineState: WallpaperEngineState = {
    is_running: false,
    state: 'stopped',
    scene: 'cover-reactive',
    texture_path: null,
    fit_mode: 'fill',
    fps: 30,
    intensity: 0.8,
    monitor_count: 0,
    last_error: null,
};

export function useWallpaperPlugin() {
    const [pluginStatus, setPluginStatus] = useState<WallpaperPluginStatus>(globalPluginStatus);
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState<WallpaperDownloadProgress | null>(null);
    const [engineState, setEngineState] = useState<WallpaperEngineState>(globalEngineState);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const refreshStatus = useCallback(async () => {
        if (!isBrowserTauri()) return;
        try {
            const mod = await getTauri();
            const res = await mod.invoke<WallpaperPluginStatus>('get_wallpaper_plugin_status');
            globalPluginStatus = res;
            setPluginStatus(res);
        } catch {
            // Ignore error when checking status
        }
    }, []);

    const refreshEngineState = useCallback(async () => {
        if (!isBrowserTauri()) return;
        try {
            const mod = await getTauri();
            const res = await mod.invoke<WallpaperEngineState>('get_wallpaper_engine_state');
            globalEngineState = res;
            setEngineState(res);
        } catch {
            // Ignore error
        }
    }, []);

    useEffect(() => {
        refreshStatus();
        refreshEngineState();
    }, [refreshStatus, refreshEngineState]);

    useEffect(() => {
        if (!isBrowserTauri()) return;

        let unlistenProgress: (() => void) | undefined;
        let unlistenEvent: (() => void) | undefined;
        let unlistenStopped: (() => void) | undefined;
        let isCleanedUp = false;

        import('@tauri-apps/api/event').then(({ listen }) => {
            if (isCleanedUp) return;

            listen<WallpaperDownloadProgress>('wallpaper-download-progress', (event) => {
                const payload = event.payload;
                if (payload.total > 0 && payload.downloaded < payload.total) {
                    setIsDownloading(true);
                    setDownloadProgress(payload);
                } else if (payload.total > 0 && payload.downloaded >= payload.total) {
                    setIsDownloading(false);
                    setDownloadProgress(null);
                    refreshStatus();
                } else if (payload.total === 0 && payload.downloaded === 0) {
                    setIsDownloading(false);
                    setDownloadProgress(null);
                }
            }).then((unlisten) => {
                if (isCleanedUp) unlisten();
                else unlistenProgress = unlisten;
            });

            listen<string>('wallpaper-engine-event', (event) => {
                try {
                    const parsed = typeof event.payload === 'string' ? JSON.parse(event.payload) : event.payload;
                    if (parsed && parsed.event === 'state') {
                        setEngineState((prev) => {
                            const next: WallpaperEngineState = {
                                ...prev,
                                is_running: parsed.state === 'playing' || parsed.state === 'paused',
                                state: parsed.state || prev.state,
                                scene: parsed.scene || prev.scene,
                                texture_path: parsed.texturePath !== undefined ? parsed.texturePath : prev.texture_path,
                                fit_mode: parsed.fitMode || prev.fit_mode || 'fill',
                                fps: typeof parsed.fps === 'number' ? parsed.fps : prev.fps,
                                monitor_count: typeof parsed.monitorCount === 'number' ? parsed.monitorCount : prev.monitor_count,
                                last_error: parsed.error || null,
                            };
                            globalEngineState = next;
                            return next;
                        });
                    }
                } catch {
                    // ignore parse error
                }
            }).then((unlisten) => {
                if (isCleanedUp) unlisten();
                else unlistenEvent = unlisten;
            });

            listen<void>('wallpaper-engine-stopped', () => {
                setEngineState((prev) => {
                    const next: WallpaperEngineState = {
                        ...prev,
                        is_running: false,
                        state: 'stopped',
                    };
                    globalEngineState = next;
                    return next;
                });
            }).then((unlisten) => {
                if (isCleanedUp) unlisten();
                else unlistenStopped = unlisten;
            });
        });

        return () => {
            isCleanedUp = true;
            unlistenProgress?.();
            unlistenEvent?.();
            unlistenStopped?.();
        };
    }, [refreshStatus]);

    const downloadPlugin = useCallback(async (customUrl?: string) => {
        if (!isBrowserTauri()) return;
        setIsDownloading(true);
        setErrorMsg(null);
        try {
            const mod = await getTauri();
            const res = await mod.invoke<WallpaperPluginStatus>('download_wallpaper_plugin', {
                url: customUrl || null,
            });
            globalPluginStatus = res;
            setPluginStatus(res);
            setIsDownloading(false);
            setDownloadProgress(null);
            return res;
        } catch (err: unknown) {
            setIsDownloading(false);
            setDownloadProgress(null);
            const msg = err instanceof Error ? err.message : String(err);
            setErrorMsg(msg);
            throw err;
        }
    }, []);

    const cancelDownloadPlugin = useCallback(async () => {
        if (!isBrowserTauri()) return;
        try {
            const mod = await getTauri();
            await mod.invoke('cancel_wallpaper_plugin_download');
            setIsDownloading(false);
            setDownloadProgress(null);
        } catch {
            // Ignore error
        }
    }, []);

    const installFromFile = useCallback(async (filePath: string) => {
        if (!isBrowserTauri()) return;
        setErrorMsg(null);
        try {
            const mod = await getTauri();
            const res = await mod.invoke<WallpaperPluginStatus>('install_wallpaper_plugin_from_file', {
                path: filePath,
            });
            globalPluginStatus = res;
            setPluginStatus(res);
            return res;
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            setErrorMsg(msg);
            throw err;
        }
    }, []);

    const uninstallPlugin = useCallback(async () => {
        if (!isBrowserTauri()) return;
        setErrorMsg(null);
        try {
            const mod = await getTauri();
            await mod.invoke('uninstall_wallpaper_plugin');
            globalPluginStatus = { installed: false };
            setPluginStatus(globalPluginStatus);
            globalEngineState = {
                is_running: false,
                state: 'stopped',
                scene: 'cover-reactive',
                texture_path: null,
                fit_mode: 'fill',
                fps: 30,
                intensity: 0.8,
                monitor_count: 0,
                last_error: null,
            };
            setEngineState(globalEngineState);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            setErrorMsg(msg);
            throw err;
        }
    }, []);

    const startEngine = useCallback(async (options?: { fps?: number; intensity?: number; texturePath?: string; fitMode?: string }) => {
        if (!isBrowserTauri()) return;
        setErrorMsg(null);
        try {
            const mod = await getTauri();
            const res = await mod.invoke<WallpaperEngineState>('start_wallpaper_engine', {
                fps: options?.fps ?? null,
                intensity: options?.intensity ?? null,
                texturePath: options?.texturePath ?? null,
                fitMode: options?.fitMode ?? null,
            });
            globalEngineState = res;
            setEngineState(res);
            return res;
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            setErrorMsg(msg);
            throw err;
        }
    }, []);

    const stopEngine = useCallback(async () => {
        if (!isBrowserTauri()) return;
        try {
            const mod = await getTauri();
            await mod.invoke('stop_wallpaper_engine');
            setEngineState((prev) => {
                const next = { ...prev, is_running: false, state: 'stopped' };
                globalEngineState = next;
                return next;
            });
        } catch {
            // Ignore error
        }
    }, []);

    const pauseEngine = useCallback(async () => {
        if (!isBrowserTauri()) return;
        try {
            const mod = await getTauri();
            await mod.invoke('pause_wallpaper_engine');
        } catch {
            // Ignore
        }
    }, []);

    const resumeEngine = useCallback(async () => {
        if (!isBrowserTauri()) return;
        try {
            const mod = await getTauri();
            await mod.invoke('resume_wallpaper_engine');
        } catch {
            // Ignore
        }
    }, []);

    const setTexture = useCallback(async (path: string) => {
        if (!isBrowserTauri()) return;
        try {
            const mod = await getTauri();
            await mod.invoke('set_wallpaper_engine_texture', { path });
        } catch {
            // Ignore
        }
    }, []);

    const setFitMode = useCallback(async (mode: string) => {
        if (!isBrowserTauri()) return;
        try {
            const mod = await getTauri();
            await mod.invoke('set_wallpaper_engine_fit_mode', { mode });
            setEngineState((prev) => ({ ...prev, fit_mode: mode }));
        } catch {
            // Ignore
        }
    }, []);

    const setFps = useCallback(async (fps: number) => {
        if (!isBrowserTauri()) return;
        try {
            const mod = await getTauri();
            await mod.invoke('set_wallpaper_engine_fps', { fps });
            setEngineState((prev) => ({ ...prev, fps }));
        } catch {
            // Ignore
        }
    }, []);

    const setIntensity = useCallback(async (intensity: number) => {
        if (!isBrowserTauri()) return;
        try {
            const mod = await getTauri();
            await mod.invoke('set_wallpaper_engine_intensity', { intensity });
            setEngineState((prev) => ({ ...prev, intensity }));
        } catch {
            // Ignore
        }
    }, []);

    return {
        pluginStatus,
        isDownloading,
        downloadProgress,
        engineState,
        isEngineRunning: engineState.is_running,
        errorMsg,
        refreshStatus,
        refreshEngineState,
        downloadPlugin,
        cancelDownloadPlugin,
        installFromFile,
        uninstallPlugin,
        startEngine,
        stopEngine,
        pauseEngine,
        resumeEngine,
        setTexture,
        setFitMode,
        setFps,
        setIntensity,
    };
}
