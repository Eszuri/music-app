import {useCallback, useEffect, useState} from "react";
import {getTauri, isBrowserTauri} from "../lib/homeState";

export interface TagEditorPluginStatus {
    installed: boolean;
    path: string | null;
    version: string | null;
    size: number | null;
}

export function useTagEditorPlugin() {
    const [status, setStatus] = useState<TagEditorPluginStatus | null>(null);
    const [downloading, setDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState<{downloaded: number; total: number} | null>(null);

    const setStatusGlobal = useCallback((newStatus: TagEditorPluginStatus | null) => {
        setStatus(newStatus);
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('tageditor-status-changed', { detail: newStatus }));
        }
    }, []);

    const refreshStatus = useCallback(async () => {
        if (!isBrowserTauri()) return;
        try {
            const mod = await getTauri();
            const s = await mod.invoke<TagEditorPluginStatus>("get_tag_editor_plugin_status");
            setStatusGlobal(s);
        } catch {
            // plugin commands unavailable — stay silent
        }
    }, [setStatusGlobal]);

    useEffect(() => {
        refreshStatus();

        if (typeof window !== 'undefined') {
            const onStatusChanged = (e: Event) => {
                const custom = e as CustomEvent<TagEditorPluginStatus | null>;
                if (custom.detail !== undefined) {
                    setStatus(custom.detail);
                }
            };
            window.addEventListener('tageditor-status-changed', onStatusChanged);
            return () => {
                window.removeEventListener('tageditor-status-changed', onStatusChanged);
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
                    "tag-editor-download-progress",
                    (event) => {
                        setDownloadProgress(event.payload);
                    }
                );
                unlistenCancel = await listen("tag-editor-download-cancelled", () => {
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
            const s = await mod.invoke<TagEditorPluginStatus>("download_tag_editor_plugin", {url: url || null});
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
            await mod.invoke("cancel_tag_editor_plugin_download");
        } catch {
            // ignore
        }
    }, []);

    const installFromFile = useCallback(async (filePath: string) => {
        if (!isBrowserTauri()) return;
        const mod = await getTauri();
        const s = await mod.invoke<TagEditorPluginStatus>("install_tag_editor_plugin_from_file", {path: filePath});
        setStatusGlobal(s);
        return s;
    }, [setStatusGlobal]);

    const uninstall = useCallback(async () => {
        if (!isBrowserTauri()) return;
        const mod = await getTauri();
        await mod.invoke("uninstall_tag_editor_plugin");
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
