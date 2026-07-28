import {useEffect} from 'react';
import {getTauri, isBrowserTauri, type ShortcutAction} from '../lib/homeState';

interface UseKeyboardShortcutsOptions {
    shortcutsRef: React.MutableRefObject<Record<ShortcutAction, string>>;
    settingsOpenRef: React.MutableRefObject<boolean>;
    streamingOpenRef: React.MutableRefObject<boolean>;
    pendingFolderChangeRef: React.MutableRefObject<boolean>;
    togglePlayPauseRef: React.MutableRefObject<() => void>;
    playNextRef: React.MutableRefObject<() => void>;
    playPrevRef: React.MutableRefObject<() => void>;
    appVolumeRef: React.MutableRefObject<number>;
    systemVolumeRef: React.MutableRefObject<number>;
    volumeStepRef: React.MutableRefObject<number>;
    setAppVolume: (v: number) => void;
    setSystemVolume: (v: number) => void;
    volumeModeRef: React.MutableRefObject<'app' | 'system'>;
    volumeLimitRef: React.MutableRefObject<number>;
    audioRef: React.MutableRefObject<HTMLAudioElement | null>;
    lastLocalVolumeSetRef: React.MutableRefObject<number>;
}

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions) {
    const {
        shortcutsRef,
        settingsOpenRef,
        streamingOpenRef,
        pendingFolderChangeRef,
        togglePlayPauseRef,
        playNextRef,
        playPrevRef,
        appVolumeRef,
        systemVolumeRef,
        volumeStepRef,
        setAppVolume,
        setSystemVolume,
        volumeModeRef,
        volumeLimitRef,
        audioRef,
        lastLocalVolumeSetRef,
    } = options;

    useEffect(() => {
        const isInputFocused = () => {
            const el = document.activeElement;
            if (!el) return false;
            const tag = el.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
            if ((el as HTMLElement).isContentEditable) return true;
            return false;
        };

        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'F12') {
                import('@tauri-apps/api/webview').then(m =>
                    (m as any).getCurrentWebview().openDevTools()
                ).catch(() => {});
                return;
            }

            if (isInputFocused()) return;
            if (settingsOpenRef.current || streamingOpenRef.current || pendingFolderChangeRef.current) return;

            const key = e.key;
            const keyLower = key.length === 1 ? key.toLowerCase() : key;
            const map = shortcutsRef.current;
            let action: ShortcutAction | null = null;
            for (const a of Object.keys(map) as ShortcutAction[]) {
                const bound = map[a];
                if (bound === key || bound === keyLower) {
                    action = a;
                    break;
                }
            }
            if (!action) return;

            e.preventDefault();
            switch (action) {
                case 'playPause':
                    togglePlayPauseRef.current();
                    break;
                case 'next':
                    playNextRef.current();
                    break;
                case 'prev':
                    playPrevRef.current();
                    break;
                case 'volumeUp': {
                    const step = volumeStepRef.current / 100;
                    if (volumeModeRef.current === 'app') {
                        const cur = appVolumeRef.current;
                        const raw = Math.min(1, Math.round((cur + step) / step) * step);
                        setAppVolume(raw);
                        if (audioRef.current) audioRef.current.volume = raw;
                    } else {
                        const cur = systemVolumeRef.current;
                        const pct = Math.round(cur * 100);
                        const limit = volumeLimitRef.current;

                        if (limit > 0) {
                            if (pct > limit) break;
                            if (pct === limit) break;
                        }

                        let raw = Math.min(1, Math.round((cur + step) / step) * step);
                        if (limit > 0 && Math.round(raw * 100) > limit) {
                            raw = limit / 100;
                        }
                        setSystemVolume(raw);
                        if (isBrowserTauri) {
                            lastLocalVolumeSetRef.current = Date.now();
                            getTauri().then(m => m.invoke('set_system_volume', {value: Math.round(raw * 100)})).catch(() => {});
                        }
                    }
                    break;
                }
                case 'volumeDown': {
                    const step = volumeStepRef.current / 100;
                    if (volumeModeRef.current === 'app') {
                        const cur = appVolumeRef.current;
                        const raw = Math.max(0, Math.round((cur - step) / step) * step);
                        setAppVolume(raw);
                        if (audioRef.current) audioRef.current.volume = raw;
                    } else {
                        const cur = systemVolumeRef.current;
                        const pct = Math.round(cur * 100);
                        const limit = volumeLimitRef.current;

                        if (limit > 0) {
                            if (pct > limit) break;
                        }

                        const raw = Math.max(0, Math.round((cur - step) / step) * step);
                        setSystemVolume(raw);
                        if (isBrowserTauri) {
                            lastLocalVolumeSetRef.current = Date.now();
                            getTauri().then(m => m.invoke('set_system_volume', {value: Math.round(raw * 100)})).catch(() => {});
                        }
                    }
                    break;
                }
            }
        };

        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [
        shortcutsRef,
        settingsOpenRef,
        streamingOpenRef,
        pendingFolderChangeRef,
        togglePlayPauseRef,
        playNextRef,
        playPrevRef,
        appVolumeRef,
        systemVolumeRef,
        volumeStepRef,
        setAppVolume,
        setSystemVolume,
        volumeModeRef,
        volumeLimitRef,
        audioRef,
        lastLocalVolumeSetRef,
    ]);
}
