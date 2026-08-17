import {useCallback, useEffect, useState} from "react";
import {getTauri, isBrowserTauri} from "../lib/homeState";

export interface EqualizerPluginStatus {
    installed: boolean;
    path: string | null;
    version: string | null;
    size: number | null;
}

export function useEqualizerPlugin() {
    const [status, setStatus] = useState<EqualizerPluginStatus | null>(null);
    const [downloading, setDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState<{downloaded: number; total: number} | null>(null);

    const setStatusGlobal = useCallback((newStatus: EqualizerPluginStatus | null) => {
        setStatus(newStatus);
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('equalizer-status-changed', { detail: newStatus }));
        }
    }, []);

    const refreshStatus = useCallback(async () => {
        if (!isBrowserTauri()) return;
        try {
            const mod = await getTauri();
            const s = await mod.invoke<EqualizerPluginStatus>("get_equalizer_plugin_status");
            setStatusGlobal(s);
        } catch {
            // plugin commands unavailable — stay silent
        }
    }, [setStatusGlobal]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void refreshStatus();
        }, 0);

        if (typeof window !== 'undefined') {
            const onStatusChanged = (e: Event) => {
                const custom = e as CustomEvent<EqualizerPluginStatus | null>;
                if (custom.detail !== undefined) {
                    setStatus(custom.detail);
                }
            };
            window.addEventListener('equalizer-status-changed', onStatusChanged);
            window.addEventListener('bitperfect-status-changed', onStatusChanged);
            return () => {
                window.clearTimeout(timer);
                window.removeEventListener('equalizer-status-changed', onStatusChanged);
                window.removeEventListener('bitperfect-status-changed', onStatusChanged);
            };
        }
    }, [refreshStatus]);

    useEffect(() => {
        if (!isBrowserTauri()) return;
        let unlistenProgress: (() => void) | undefined;
        let unlistenCancel: (() => void) | undefined;

        (async () => {
            try {
                const {listen} = await import("@tauri-apps/api/event");
                unlistenProgress = await listen<{downloaded: number; total: number}>(
                    "equalizer-download-progress",
                    (event) => {
                        setDownloadProgress(event.payload);
                    }
                );
                unlistenCancel = await listen("equalizer-download-cancelled", () => {
                    setDownloading(false);
                    setDownloadProgress(null);
                });
            } catch {
                // ignore
            }
        })();

        return () => {
            unlistenProgress?.();
            unlistenCancel?.();
        };
    }, []);

    const downloadPlugin = useCallback(async (url?: string) => {
        if (!isBrowserTauri()) return;
        setDownloading(true);
        setDownloadProgress(null);
        try {
            const mod = await getTauri();
            const s = await mod.invoke<EqualizerPluginStatus>("download_equalizer_plugin", {url: url || null});
            setStatusGlobal(s);
        } finally {
            setDownloading(false);
            setDownloadProgress(null);
        }
    }, [setStatusGlobal]);

    const cancelDownload = useCallback(async () => {
        if (!isBrowserTauri()) return;
        try {
            const mod = await getTauri();
            await mod.invoke("cancel_equalizer_plugin_download");
        } catch {
            // ignore
        }
    }, []);

    const installFromFile = useCallback(async (filePath: string) => {
        if (!isBrowserTauri()) return;
        const mod = await getTauri();
        const s = await mod.invoke<EqualizerPluginStatus>("install_equalizer_plugin_from_file", {path: filePath});
        setStatusGlobal(s);
        return s;
    }, [setStatusGlobal]);

    const uninstall = useCallback(async () => {
        if (!isBrowserTauri()) return;
        const mod = await getTauri();
        await mod.invoke("uninstall_equalizer_plugin");
        setStatusGlobal({installed: false, path: null, version: null, size: null});
    }, [setStatusGlobal]);

    return {
        status,
        installed: status?.installed ?? false,
        downloading,
        downloadProgress,
        refreshStatus,
        downloadPlugin,
        cancelDownload,
        installFromFile,
        uninstall,
    };
}
