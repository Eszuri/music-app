'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getTauri, isBrowserTauri } from '../lib/homeState';

export interface AiPluginStatus {
    installed: boolean;
    path?: string;
    size_bytes?: number;
    sha256?: string;
}

export interface AiDownloadProgress {
    downloaded: number;
    total: number;
}

export interface AiGenerateProgress {
    percent: number;
    segmentText: string;
    timestamp: string;
}

export function useAiLyricsPlugin() {
    const [pluginStatus, setPluginStatus] = useState<AiPluginStatus>({ installed: false });
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState<AiDownloadProgress | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generateProgress, setGenerateProgress] = useState<AiGenerateProgress | null>(null);
    const [modelDownloadProgress, setModelDownloadProgress] = useState<{ modelName: string; percent: number } | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const generateResolverRef = useRef<{
        resolve: (lrcContent: string) => void;
        reject: (reason: Error) => void;
    } | null>(null);

    // Refresh plugin status
    const refreshStatus = useCallback(async () => {
        if (!isBrowserTauri) return;
        try {
            const mod = await getTauri();
            const status = await mod.invoke<AiPluginStatus>('get_ai_lyrics_plugin_status');
            setPluginStatus(status);
        } catch (err) {
            console.error('Failed to get AI lyrics plugin status:', err);
        }
    }, []);

    useEffect(() => {
        refreshStatus();
    }, [refreshStatus]);

    // Listen to backend events (ai-lyrics-event, ai-lyrics-download-progress)
    useEffect(() => {
        if (!isBrowserTauri) return;

        let cancelled = false;
        const unlistens: (() => void)[] = [];

        import('@tauri-apps/api/event').then(({ listen }) => {
            if (cancelled) return;

            listen<string>('ai-lyrics-event', (event) => {
                if (cancelled) return;
                try {
                    const parsed = JSON.parse(event.payload);
                    switch (parsed.event) {
                        case 'progress':
                            setGenerateProgress({
                                percent: parsed.percent ?? 0,
                                segmentText: parsed.segmentText ?? '',
                                timestamp: parsed.timestamp ?? '',
                            });
                            break;
                        case 'vocal_extraction_progress':
                            setGenerateProgress({
                                percent: parsed.percent ?? 0,
                                segmentText: `Memisahkan Vokal AI (${parsed.percent}%)...`,
                                timestamp: '',
                            });
                            break;
                        case 'vocal_model_download_progress':
                            setModelDownloadProgress({
                                modelName: 'Model Vokal ONNX',
                                percent: parsed.percent ?? 0,
                            });
                            break;
                        case 'vocal_model_download_complete':
                            setModelDownloadProgress(null);
                            break;
                        case 'model_download_progress':
                            setModelDownloadProgress({
                                modelName: parsed.modelName ?? '',
                                percent: parsed.percent ?? 0,
                            });
                            break;
                        case 'model_download_complete':
                            setModelDownloadProgress(null);
                            break;
                        case 'transcription_result':
                            setIsGenerating(false);
                            setGenerateProgress(null);
                            if (generateResolverRef.current) {
                                generateResolverRef.current.resolve(parsed.lrcContent ?? '');
                                generateResolverRef.current = null;
                            }
                            break;
                        case 'error':
                            setIsGenerating(false);
                            setErrorMsg(parsed.message ?? 'Unknown AI Lyrics Error');
                            if (generateResolverRef.current) {
                                generateResolverRef.current.reject(new Error(parsed.message ?? 'Transcription failed'));
                                generateResolverRef.current = null;
                            }
                            break;
                        case 'transcribe_cancelled':
                            setIsGenerating(false);
                            setGenerateProgress(null);
                            if (generateResolverRef.current) {
                                generateResolverRef.current.reject(new Error('Transcription cancelled'));
                                generateResolverRef.current = null;
                            }
                            break;
                    }
                } catch {
                    // JSON parse ignore
                }
            }).then((fn) => (cancelled ? fn() : unlistens.push(fn)));

            listen<AiDownloadProgress>('ai-lyrics-download-progress', (event) => {
                if (cancelled) return;
                setDownloadProgress(event.payload);
            }).then((fn) => (cancelled ? fn() : unlistens.push(fn)));
        });

        return () => {
            cancelled = true;
            unlistens.forEach((fn) => fn());
        };
    }, []);

    const downloadPlugin = useCallback(async (url?: string) => {
        if (!isBrowserTauri) return;
        setIsDownloading(true);
        setErrorMsg(null);
        try {
            const mod = await getTauri();
            const status = await mod.invoke<AiPluginStatus>('download_ai_lyrics_plugin', { url });
            setPluginStatus(status);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            setErrorMsg(msg);
        } finally {
            setIsDownloading(false);
            setDownloadProgress(null);
            await refreshStatus();
        }
    }, []);

    const cancelDownloadPlugin = useCallback(async () => {
        if (!isBrowserTauri) return;
        try {
            const mod = await getTauri();
            await mod.invoke('cancel_ai_lyrics_plugin_download');
        } catch (err) {
            console.error('Failed to cancel plugin download:', err);
        }
    }, []);

    const installFromFile = useCallback(async () => {
        if (!isBrowserTauri) return;
        try {
            const mod = await getTauri();
            const path = await mod.invoke<string | null>('pick_single_file', {
                title: 'Pilih File Plugin AI Lyrics (symvonia-ai-lyrics.exe)',
                filters: [{ name: 'Executable', extensions: ['exe'] }],
            });

            if (path) {
                setIsDownloading(true);
                setErrorMsg(null);
                const status = await mod.invoke<AiPluginStatus>('install_ai_lyrics_plugin_from_file', { path });
                setPluginStatus(status);
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            setErrorMsg(msg);
        } finally {
            setIsDownloading(false);
        }
    }, []);

    const uninstallPlugin = useCallback(async () => {
        if (!isBrowserTauri) return;
        try {
            const mod = await getTauri();
            await mod.invoke('uninstall_ai_lyrics_plugin');
            await refreshStatus();
        } catch (err) {
            console.error('Failed to uninstall AI lyrics plugin:', err);
        }
    }, [refreshStatus]);

    const generateLyrics = useCallback(
        (filePath: string, modelName = 'base', language = 'auto', isolateVocals = false): Promise<string> => {
            return new Promise<string>(async (resolve, reject) => {
                if (!isBrowserTauri) {
                    reject(new Error('Only supported in Desktop app'));
                    return;
                }

                setIsGenerating(true);
                setGenerateProgress({ percent: 0, segmentText: 'Inisialisasi AI...', timestamp: '' });
                setErrorMsg(null);
                generateResolverRef.current = { resolve, reject };

                try {
                    const mod = await getTauri();
                    await mod.invoke('generate_ai_lyrics', { filePath, modelName, language, isolateVocals });
                } catch (err: unknown) {
                    setIsGenerating(false);
                    const msg = err instanceof Error ? err.message : String(err);
                    setErrorMsg(msg);
                    reject(err);
                    generateResolverRef.current = null;
                }
            });
        },
        []
    );

    const extractVocal = useCallback(
        (filePath: string, outputPath?: string): Promise<void> => {
            return new Promise<void>(async (resolve, reject) => {
                if (!isBrowserTauri) {
                    reject(new Error('Only supported in Desktop app'));
                    return;
                }
                try {
                    const mod = await getTauri();
                    await mod.invoke('extract_vocal_ai', { filePath, outputPath });
                    resolve();
                } catch (err) {
                    reject(err);
                }
            });
        },
        []
    );

    const cancelGeneration = useCallback(async () => {
        if (!isBrowserTauri) return;
        try {
            const mod = await getTauri();
            await mod.invoke('cancel_ai_lyrics');
            setIsGenerating(false);
            setGenerateProgress(null);
            if (generateResolverRef.current) {
                generateResolverRef.current.resolve('');
                generateResolverRef.current = null;
            }
        } catch (err) {
            console.error('Failed to cancel AI lyrics generation:', err);
        }
    }, []);


    return {
        pluginStatus,
        isDownloading,
        downloadProgress,
        isGenerating,
        generateProgress,
        modelDownloadProgress,
        errorMsg,
        refreshStatus,
        downloadPlugin,
        cancelDownloadPlugin,
        installFromFile,
        uninstallPlugin,
        generateLyrics,
        extractVocal,
        cancelGeneration,
    };
}
