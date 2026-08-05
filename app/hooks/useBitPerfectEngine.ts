import {useCallback, useEffect, useRef, useState} from "react";
import {getTauri, isBrowserTauri} from "../lib/homeState";

export interface BitPerfectPluginStatus {
    installed: boolean;
    path: string | null;
    size_bytes: number | null;
    sha256: string | null;
}

export interface EngineStateEvent {
    state: "playing" | "paused" | "stopped" | "ended";
    path: string | null;
    exclusive: boolean;
    sampleRate?: number | null;
    bitDepth?: number | null;
    deviceName?: string | null;
}

export interface EngineProgressEvent {
    position: number;
    duration: number;
}

export interface EngineDevice {
    id: string;
    name: string;
    isDefault: boolean;
}

interface EngineEventHandlers {
    onState?: (e: EngineStateEvent) => void;
    onProgress?: (e: EngineProgressEvent) => void;
    onError?: (message: string, context?: string) => void;
}

/**
 * Manages the optional C# Bit-Perfect audio engine plugin:
 * install status, download/uninstall, process lifecycle, and the
 * `audio-event` JSON stream coming from its stdout.
 */
export function useBitPerfectEngine(handlers: EngineEventHandlers = {}) {
    const [status, setStatus] = useState<BitPerfectPluginStatus | null>(null);
    const [downloading, setDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState<{downloaded: number; total: number} | null>(null);
    const [engineRunning, setEngineRunning] = useState(false);
    const [engineState, setEngineState] = useState<EngineStateEvent | null>(null);

    const handlersRef = useRef(handlers);
    useEffect(() => {
        handlersRef.current = handlers;
    });

    const refreshStatus = useCallback(async () => {
        if (!isBrowserTauri) return;
        try {
            const mod = await getTauri();
            const s = await mod.invoke<BitPerfectPluginStatus>("get_bit_perfect_plugin_status");
            setStatus(s);
        } catch {
            // plugin commands unavailable (older backend) — stay silent
        }
    }, []);

    useEffect(() => {
        refreshStatus();
    }, [refreshStatus]);

    // Subscribe to engine stdout events + download progress.
    useEffect(() => {
        if (!isBrowserTauri) return;
        let cancelled = false;
        const unlistens: Array<() => void> = [];

        import("@tauri-apps/api/event").then(({listen}) => {
            listen<string>("audio-event", (event) => {
                if (cancelled) return;
                let parsed: Record<string, unknown>;
                try {
                    parsed = JSON.parse(event.payload);
                } catch {
                    return;
                }
                switch (parsed.event) {
                    case "state":
                        setEngineState(parsed as unknown as EngineStateEvent);
                        handlersRef.current.onState?.(parsed as unknown as EngineStateEvent);
                        break;
                    case "progress":
                        handlersRef.current.onProgress?.(parsed as unknown as EngineProgressEvent);
                        break;
                    case "error":
                        handlersRef.current.onError?.(
                            String(parsed.message ?? "Unknown engine error"),
                            parsed.context ? String(parsed.context) : undefined,
                        );
                        break;
                    case "bye":
                        setEngineRunning(false);
                        break;
                }
            }).then((fn) => (cancelled ? fn() : unlistens.push(fn)));

            listen("audio-engine-exit", () => {
                if (cancelled) return;
                setEngineRunning(false);
                setEngineState(null);
            }).then((fn) => (cancelled ? fn() : unlistens.push(fn)));

            listen<{downloaded: number; total: number}>("bit-perfect-download-progress", (event) => {
                if (cancelled) return;
                setDownloadProgress(event.payload);
            }).then((fn) => (cancelled ? fn() : unlistens.push(fn)));
        });

        return () => {
            cancelled = true;
            unlistens.forEach((fn) => fn());
        };
    }, []);

    const sendCommand = useCallback(async (command: Record<string, unknown>) => {
        if (!isBrowserTauri) return;
        const mod = await getTauri();
        await mod.invoke("send_audio_command", {json: JSON.stringify(command)});
        setEngineRunning(true);
    }, []);

    const download = useCallback(async () => {
        if (!isBrowserTauri) return;
        setDownloading(true);
        setDownloadProgress(null);
        try {
            const mod = await getTauri();
            const s = await mod.invoke<BitPerfectPluginStatus>("download_bit_perfect_plugin", {});
            setStatus(s);
        } finally {
            setDownloading(false);
            setDownloadProgress(null);
        }
    }, []);

    const installFromFile = useCallback(async (path: string) => {
        if (!isBrowserTauri) return;
        const mod = await getTauri();
        const s = await mod.invoke<BitPerfectPluginStatus>("install_bit_perfect_plugin_from_file", {path});
        setStatus(s);
    }, []);

    const uninstall = useCallback(async () => {
        if (!isBrowserTauri) return;
        const mod = await getTauri();
        await mod.invoke("uninstall_bit_perfect_plugin");
        setStatus({installed: false, path: null, size_bytes: null, sha256: null});
        setEngineRunning(false);
        setEngineState(null);
    }, []);

    const stopEngine = useCallback(async () => {
        if (!isBrowserTauri) return;
        const mod = await getTauri();
        await mod.invoke("stop_audio_engine");
        setEngineRunning(false);
    }, []);

    const getDevices = useCallback(async (): Promise<EngineDevice[]> => {
        if (!isBrowserTauri) return [];
        const mod = await getTauri();
        return new Promise<EngineDevice[]>((resolve) => {
            let done = false;
            const finish = (devices: EngineDevice[]) => {
                if (!done) {
                    done = true;
                    resolve(devices);
                }
            };
            const timer = setTimeout(() => finish([]), 3000);
            import("@tauri-apps/api/event").then(({listen}) => {
                listen<string>("audio-event", (event) => {
                    try {
                        const parsed = JSON.parse(event.payload);
                        if (parsed.event === "devices" && Array.isArray(parsed.devices)) {
                            clearTimeout(timer);
                            finish(parsed.devices as EngineDevice[]);
                        }
                    } catch {
                        // ignore
                    }
                }).then((unlisten) => {
                    mod.invoke("send_audio_command", {json: JSON.stringify({command: "get_devices"})})
                        .then(() => setEngineRunning(true))
                        .catch(() => {
                            clearTimeout(timer);
                            unlisten();
                            finish([]);
                        });
                    // Safety: auto-unlisten after resolution
                    setTimeout(unlisten, 3500);
                });
            });
        });
    }, []);

    return {
        status,
        downloading,
        downloadProgress,
        engineRunning,
        engineState,
        refreshStatus,
        sendCommand,
        download,
        installFromFile,
        uninstall,
        stopEngine,
        getDevices,
    };
}
