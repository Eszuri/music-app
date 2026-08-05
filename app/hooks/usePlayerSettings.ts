import {useCallback, useEffect, useRef, useState} from 'react';
import {removeCustomAccentVars, setCustomAccentVars} from '../lib/colors';
import {
    ACCENT_KEY,
    AUTO_WALLPAPER_KEY,
    CUSTOM_ACCENT_KEY,
    DEFAULT_FORMATS,
    DEFAULT_LANGUAGE,
    DEFAULT_SHORTCUTS,
    DEFAULT_VOLUME_STEP,
    FILE_SORT_KEY,
    FOLDER_SORT_KEY,
    FOLDER_STORAGE_KEY,
    FORMATS_KEY,
    getTauri,
    isBrowserTauri,
    LANGUAGE_KEY,
    loadSavedFolder,
    NAME_SOURCE_KEY,
    RESET_ON_CLOSE_KEY,
    safeSetLocalStorage,
    SHORTCUTS_KEY,
    SORT_DIR_KEY,
    OUTPUT_MODE_KEY,
    OUTPUT_DEVICE_KEY,
    LAYOUT_MODE_KEY,
    VOLUME_LIMIT_KEY,
    VOLUME_MODE_KEY,
    VOLUME_STEP_KEY,
    WALLPAPER_KEY,
    type ShortcutAction,
} from '../lib/homeState';

export const PAUSE_IF_MUTED_KEY = 'music-app-pause-if-muted';
import type {Lang} from '../lib/translations';
import {t} from '../lib/translations';

export const APP_VOLUME_KEY = 'music-app-app-volume';

export function usePlayerSettings() {
    const [musicFolder, setMusicFolderState] = useState<string | null>(null);
    const [initialized, setInitialized] = useState(false);
    const [autoWallpaper, setAutoWallpaperState] = useState(true);
    const [resetOnClose, setResetOnCloseState] = useState(true);
    const [folderSort, setFolderSortState] = useState('name');
    const [fileSort, setFileSortState] = useState('name');
    const [sortDir, setSortDirState] = useState('asc');
    const [nameSource, setNameSourceState] = useState('filename');
    const [volumeMode, setVolumeModeState] = useState<'app' | 'system'>('app');
    const [appVolume, setAppVolumeState] = useState<number>(1); // 0.0 to 1.0 (100% normal sound)
    const [systemVolume, setSystemVolumeState] = useState<number>(1); // 0.0 to 1.0 (Windows master volume)
    const [systemVolumeSynced, setSystemVolumeSynced] = useState(false);
    const [systemMuted, setSystemMuted] = useState(false);
    const [volumeLimit, setVolumeLimitState] = useState(0); // 0 = no limit
    const [volumeLimitExceeded, setVolumeLimitExceeded] = useState(false);
    const [volumeStep, setVolumeStepState] = useState(DEFAULT_VOLUME_STEP);
    const [language, setLanguageState] = useState<Lang>(DEFAULT_LANGUAGE as Lang);
    const [formats, setFormatsState] = useState<string[]>(DEFAULT_FORMATS);
    const [shuffle, setShuffleState] = useState(false);
    const [repeat, setRepeatState] = useState<'off' | 'all' | 'one'>('off');
    const [accentColor, setAccentColorState] = useState('green');
    const [customAccentHex, setCustomAccentHexState] = useState('#22c55e');
    const [defaultWallpaper, setDefaultWallpaperState] = useState<string | null>(null);
    const [outputDevice, setOutputDeviceStateInternal] = useState<string | null>(null);
    const [layoutMode, setLayoutModeStateInternal] = useState<'default' | 'compact' | 'immersive'>('default');
    const [shortcuts, setShortcutsState] = useState<Record<ShortcutAction, string>>(DEFAULT_SHORTCUTS);
    const [pauseIfMuted, setPauseIfMutedState] = useState(true);

    const shortcutsRef = useRef<Record<ShortcutAction, string>>(DEFAULT_SHORTCUTS);
    const volumeLimitRef = useRef<number>(0);
    const volumeStepRef = useRef<number>(DEFAULT_VOLUME_STEP);
    const volumeModeRef = useRef<'app' | 'system'>('app');
    const appVolumeRef = useRef<number>(1);
    const systemVolumeRef = useRef<number>(1);
    const lastLocalVolumeSetRef = useRef<number>(0);

    useEffect(() => {
        volumeModeRef.current = volumeMode;
        volumeLimitRef.current = volumeLimit;
        volumeStepRef.current = volumeStep;
        appVolumeRef.current = appVolume;
        systemVolumeRef.current = systemVolume;
    });

    const setAppVolume = useCallback((v: number) => {
        const clamped = Math.max(0, Math.min(1, v));
        setAppVolumeState(clamped);
        appVolumeRef.current = clamped;
        safeSetLocalStorage(APP_VOLUME_KEY, String(clamped));
    }, []);

    const setLanguage = useCallback((v: Lang) => {
        setLanguageState(v);
        safeSetLocalStorage(LANGUAGE_KEY, v);
    }, []);

    const setVolumeStep = useCallback((v: number) => {
        const clamped = Math.max(1, Math.min(10, v));
        setVolumeStepState(clamped);
        volumeStepRef.current = clamped;
        safeSetLocalStorage(VOLUME_STEP_KEY, String(clamped));
    }, []);

    const setSystemVolume = useCallback((v: number) => {
        const clamped = Math.max(0, Math.min(1, v));
        setSystemVolumeState(clamped);
        systemVolumeRef.current = clamped;
    }, []);

    const setMusicFolder = useCallback((folder: string | null) => {
        setMusicFolderState(folder);
        if (folder) {
            safeSetLocalStorage(FOLDER_STORAGE_KEY, folder);
        } else {
            window.localStorage.removeItem(FOLDER_STORAGE_KEY);
        }
    }, []);

    const setDefaultWallpaper = useCallback((path: string | null) => {
        setDefaultWallpaperState(path);
        if (path) {
            safeSetLocalStorage(WALLPAPER_KEY, path);
        } else {
            window.localStorage.removeItem(WALLPAPER_KEY);
        }
    }, []);

    useEffect(() => {
        const saved = loadSavedFolder();
        if (saved) {
            setMusicFolderState(saved);
        }
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const aw = window.localStorage.getItem(AUTO_WALLPAPER_KEY);
        if (aw !== null) setAutoWallpaperState(aw === 'true');
        const rc = window.localStorage.getItem(RESET_ON_CLOSE_KEY);
        if (rc !== null) setResetOnCloseState(rc === 'true');
        const fs = window.localStorage.getItem(FOLDER_SORT_KEY);
        if (fs) setFolderSortState(fs);
        const fls = window.localStorage.getItem(FILE_SORT_KEY);
        if (fls) setFileSortState(fls);
        const sd = window.localStorage.getItem(SORT_DIR_KEY);
        if (sd) setSortDirState(sd);
        const fm = window.localStorage.getItem(FORMATS_KEY);
        if (fm) {
            try {
                const parsed = JSON.parse(fm);
                if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string' && x.length > 0)) {
                    setFormatsState(parsed);
                }
            } catch { /* ignore */}
        }
        const ac = window.localStorage.getItem(ACCENT_KEY);
        if (ac) setAccentColorState(ac);
        const ca = window.localStorage.getItem(CUSTOM_ACCENT_KEY);
        if (ca) setCustomAccentHexState(ca);
        const wp = window.localStorage.getItem(WALLPAPER_KEY);
        if (wp) setDefaultWallpaperState(wp);

        const od = window.localStorage.getItem(OUTPUT_DEVICE_KEY);
        if (od) {
            setOutputDeviceStateInternal(od);
            if (isBrowserTauri) {
                getTauri().then(mod => {
                    mod.invoke('engine_set_output_device', { name: od }).catch(() => {});
                });
            }
        }
        const sh = window.localStorage.getItem('music-app-shuffle');
        if (sh !== null) setShuffleState(sh === 'true');
        const rp = window.localStorage.getItem('music-app-repeat');
        if (rp === 'all' || rp === 'one') setRepeatState(rp);
        const ns = window.localStorage.getItem(NAME_SOURCE_KEY);
        if (ns === 'filename' || ns === 'title') setNameSourceState(ns);
        const vm = window.localStorage.getItem(VOLUME_MODE_KEY);
        if (vm === 'system') setVolumeModeState('system');
        const av = window.localStorage.getItem(APP_VOLUME_KEY);
        if (av !== null) {
            const parsedAv = parseFloat(av);
            if (!isNaN(parsedAv) && parsedAv >= 0 && parsedAv <= 1) {
                setAppVolumeState(parsedAv);
                appVolumeRef.current = parsedAv;
            }
        }
        const vl = window.localStorage.getItem(VOLUME_LIMIT_KEY);
        if (vl) {
            const n = parseInt(vl, 10);
            if (!isNaN(n) && n >= 0 && n <= 100) setVolumeLimitState(n);
        }
        const vs = window.localStorage.getItem(VOLUME_STEP_KEY);
        if (vs) {
            const n = parseInt(vs, 10);
            if (!isNaN(n) && n >= 1 && n <= 10) {
                setVolumeStepState(n);
                volumeStepRef.current = n;
            }
        }
        const ln = window.localStorage.getItem(LANGUAGE_KEY);
        if (ln === 'en' || ln === 'id') {
            setLanguageState(ln);
        }
        const sc = window.localStorage.getItem(SHORTCUTS_KEY);
        if (sc) {
            try {
                const parsed = JSON.parse(sc);
                if (parsed && typeof parsed === 'object') {
                    setShortcutsState({...DEFAULT_SHORTCUTS, ...parsed});
                    shortcutsRef.current = {...DEFAULT_SHORTCUTS, ...parsed};
                }
            } catch { /* ignore */}
        }
        const pim = window.localStorage.getItem(PAUSE_IF_MUTED_KEY);
        if (pim !== null) setPauseIfMutedState(pim !== 'false');
        setInitialized(true);
    }, []);

    useEffect(() => {
        if (!isBrowserTauri) return;
        safeSetLocalStorage(AUTO_WALLPAPER_KEY, String(autoWallpaper));
    }, [autoWallpaper]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        safeSetLocalStorage(RESET_ON_CLOSE_KEY, String(resetOnClose));
        if (isBrowserTauri) {
            getTauri().then(mod => mod.invoke('set_reset_on_close', {enabled: resetOnClose})).catch(() => {});
        }
    }, [resetOnClose]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        safeSetLocalStorage(FOLDER_SORT_KEY, folderSort);
    }, [folderSort]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        safeSetLocalStorage(FILE_SORT_KEY, fileSort);
    }, [fileSort]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        safeSetLocalStorage(SORT_DIR_KEY, sortDir);
    }, [sortDir]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        safeSetLocalStorage(NAME_SOURCE_KEY, nameSource);
    }, [nameSource]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        safeSetLocalStorage(VOLUME_MODE_KEY, volumeMode);
    }, [volumeMode]);

    useEffect(() => {
        if (!isBrowserTauri || volumeMode !== 'system') {
            setSystemVolumeSynced(false);
            return;
        }

        let cancelled = false;
        let volumeUnlisten: (() => void) | null = null;
        let focusUnlisten: (() => void) | null = null;
        let registered = false;

        const setupVolumeCallback = async () => {
            try {
                const m = await getTauri();
                const {getCurrentWindow} = await import('@tauri-apps/api/window');
                const {listen} = await import('@tauri-apps/api/event');

                const registerVolumeCallback = async () => {
                    if (registered || cancelled) return;
                    try {
                        await m.invoke('register_volume_callback');
                        registered = true;
                    } catch {
                        // register failed silently — will retry on focus
                    }
                };

                // Initial sync
                const initialVolume = await m.invoke<number>('get_system_volume');
                const initialMuted = await m.invoke<boolean>('get_system_mute').catch(() => false);

                if (!cancelled) {
                    setSystemVolumeState(initialVolume / 100);
                    systemVolumeRef.current = initialVolume / 100;
                    setSystemMuted(initialMuted);
                    setSystemVolumeSynced(true);

                    const limit = volumeLimitRef.current;
                    if (limit > 0 && initialVolume > 0) {
                        setVolumeLimitExceeded(initialVolume > limit);
                    }
                }

                // Listen to volume change events from Rust callback
                volumeUnlisten = await listen<{volume: number; muted: boolean}>(
                    'system-volume-changed',
                    (event) => {
                        if (cancelled) return;

                        const {volume: osPct, muted} = event.payload;
                        const v = osPct / 100;

                        setSystemMuted(muted);
                        setSystemVolumeSynced(true);

                        const limit = volumeLimitRef.current;
                        if (limit > 0 && v > 0) {
                            setVolumeLimitExceeded(v > limit / 100);
                        } else if (limit === 0) {
                            setVolumeLimitExceeded(false);
                        }

                        if (Date.now() - lastLocalVolumeSetRef.current < 300) return;

                        if (Math.abs(v - systemVolumeRef.current) > 0.001) {
                            setSystemVolumeState(v);
                            systemVolumeRef.current = v;
                        }
                    }
                );

                const currentWindow = getCurrentWindow();

                focusUnlisten = await currentWindow.onFocusChanged(async ({payload: focused}) => {
                    if (!focused || cancelled) return;
                    await registerVolumeCallback();
                });

                if (await currentWindow.isFocused()) {
                    await registerVolumeCallback();
                }

            } catch {
                if (!cancelled) setSystemVolumeSynced(true);
            }
        };

        setupVolumeCallback();

        return () => {
            cancelled = true;
            volumeUnlisten?.();
            focusUnlisten?.();
        };
    }, [language, volumeMode]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        safeSetLocalStorage(FORMATS_KEY, JSON.stringify(formats));
    }, [formats]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        safeSetLocalStorage('music-app-shuffle', String(shuffle));
    }, [shuffle]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        safeSetLocalStorage(ACCENT_KEY, accentColor);
        if (accentColor === 'custom') {
            setCustomAccentVars(customAccentHex);
        } else {
            removeCustomAccentVars();
        }
    }, [accentColor, customAccentHex]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        safeSetLocalStorage(CUSTOM_ACCENT_KEY, customAccentHex);
    }, [customAccentHex]);

    useEffect(() => {
        if (!isBrowserTauri) return;
        getTauri().then(mod => {
            mod.invoke('set_default_wallpaper_path', {path: defaultWallpaper});
        }).catch(() => {});
    }, [defaultWallpaper]);

    useEffect(() => {
        if (!isBrowserTauri) return;
        let cancelled = false;
        let unlisten: (() => void) | null = null;
        import('@tauri-apps/api/event').then(({listen}) => {
            listen<string>('stream-url-changed', (event) => {
                try {
                    const url = event.payload;
                    const domain = new URL(url).hostname.replace(/^www\./, '');
                    const raw = localStorage.getItem('music-app-stream-history');
                    const entries: Array<{url: string; timestamp: number; domain: string}> = raw ? JSON.parse(raw) : [];
                    entries.unshift({url, timestamp: Date.now(), domain});
                    const unique = entries.filter((e, i, a) => a.findIndex(x => x.url === e.url) === i).slice(0, 200);
                    try {
                        localStorage.setItem('music-app-stream-history', JSON.stringify(unique));
                    } catch {}
                } catch {}
            }).then((fn) => {
                if (cancelled) {
                    fn();
                } else {
                    unlisten = fn;
                }
            });
        });
        return () => {
            cancelled = true;
            unlisten?.();
        };
    }, []);

    const updateShortcut = useCallback((action: string, newKey: string) => {
        setShortcutsState(prev => {
            const next = {...prev, [action]: newKey};
            shortcutsRef.current = next as Record<ShortcutAction, string>;
            safeSetLocalStorage(SHORTCUTS_KEY, JSON.stringify(next));
            return next as Record<ShortcutAction, string>;
        });
    }, []);

    const resetShortcuts = useCallback(() => {
        setShortcutsState(DEFAULT_SHORTCUTS);
        shortcutsRef.current = DEFAULT_SHORTCUTS;
        safeSetLocalStorage(SHORTCUTS_KEY, JSON.stringify(DEFAULT_SHORTCUTS));
    }, []);

    const handleVolumeLimitSetting = (v: number) => {
        setVolumeLimitState(v);
        safeSetLocalStorage(VOLUME_LIMIT_KEY, String(v));
        if (v > 0 && volumeModeRef.current === 'system' && systemVolumeRef.current * 100 > v) {
            const newVol = v / 100;
            setSystemVolume(newVol);
            if (isBrowserTauri) {
                getTauri().then(m => m.invoke('set_system_volume', {value: v})).catch(() => {});
            }
        }
    };

    const setOutputDeviceState = useCallback((name: string | null) => {
        setOutputDeviceStateInternal(name);
        if (name) {
            safeSetLocalStorage(OUTPUT_DEVICE_KEY, name);
        } else {
            window.localStorage.removeItem(OUTPUT_DEVICE_KEY);
        }
        if (isBrowserTauri) {
            getTauri().then(mod => {
                mod.invoke('engine_set_output_device', { name }).catch(() => {});
            });
        }
    }, []);

    const setLayoutModeState = useCallback((mode: 'default' | 'compact' | 'immersive') => {
        setLayoutModeStateInternal(mode);
        safeSetLocalStorage(LAYOUT_MODE_KEY, mode);
    }, []);

    const setPauseIfMuted = useCallback((v: boolean) => {
        setPauseIfMutedState(v);
        safeSetLocalStorage(PAUSE_IF_MUTED_KEY, String(v));
    }, []);

    return {
        musicFolder,
        setMusicFolder,
        initialized,
        autoWallpaper,
        setAutoWallpaperState,
        resetOnClose,
        setResetOnCloseState,
        folderSort,
        setFolderSortState,
        fileSort,
        setFileSortState,
        sortDir,
        setSortDirState,
        nameSource,
        setNameSourceState,
        volumeMode,
        setVolumeModeState,
        appVolume,
        setAppVolume,
        systemVolume,
        setSystemVolume,
        systemVolumeSynced,
        systemMuted,
        setSystemMuted,
        language,
        setLanguage,
        volumeStep,
        volumeStepRef,
        setVolumeStep,
        volumeLimit,
        volumeLimitExceeded,
        setVolumeLimitExceeded,
        formats,
        setFormatsState,
        shuffle,
        setShuffleState,
        repeat,
        setRepeatState,
        accentColor,
        setAccentColorState,
        customAccentHex,
        setCustomAccentHexState,
        defaultWallpaper,
        setDefaultWallpaper,
        outputDevice,
        setOutputDeviceState,
        layoutMode,
        setLayoutModeState,
        shortcuts,
        shortcutsRef,
        updateShortcut,
        resetShortcuts,
        handleVolumeLimitSetting,
        volumeModeRef,
        volumeLimitRef,
        appVolumeRef,
        systemVolumeRef,
        lastLocalVolumeSetRef,
        pauseIfMuted,
        setPauseIfMuted,
    };
}
