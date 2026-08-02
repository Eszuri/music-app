"use client";

import {
    type ChangeEvent,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";
import {HoverInfoProvider, useHoverInfo} from "./contexts/HoverInfoContext";
import HomeAlerts from "./components/home/HomeAlerts";
import HomeHeader from "./components/home/HomeHeader";
import HomeModals from "./components/home/HomeModals";
import HomePlayerArea from "./components/home/HomePlayerArea";
import ContextMenu, {type ContextMenuItem} from "./components/ContextMenu";
import {FullInitSkeleton} from "./components/Skeleton";
import {t} from "./lib/translations";
import {useAppLogging} from "./hooks/useAppLogging";
import {useAppUpdater} from "./hooks/useAppUpdater";
import {useAudioPlayer} from "./hooks/useAudioPlayer";
import {useKeyboardShortcuts} from "./hooks/useKeyboardShortcuts";
import {usePlayerSettings} from "./hooks/usePlayerSettings";
import {getTauri, isBrowserTauri} from "./lib/homeState";

async function openDevTools() {
    try {
        const mod = await getTauri();
        await mod.invoke("open_devtools");
    } catch {
        // not in Tauri
    }
}

function appendDevTools(
    items: ContextMenuItem[],
    lang: string,
): ContextMenuItem[] {
    return [
        ...(items.length > 0 ? [{separator: true} as ContextMenuItem] : []),
        {
            label: t(lang as "en" | "id", "contextMenu.openDevTools"),
            icon: (
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <polyline points="16 18 22 12 16 6" />
                    <polyline points="8 6 2 12 8 18" />
                </svg>
            ),
            onClick: openDevTools,
        },
    ];
}

export default function Home() {
    return (
        <HoverInfoProvider>
            <HomeContent />
        </HoverInfoProvider>
    );
}

function StatusBarText({text}: {text: string}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLSpanElement>(null);
    const [scrollDist, setScrollDist] = useState<number | null>(null); // null = no scroll
    const [duration, setDuration] = useState(8);

    useEffect(() => {
        const container = containerRef.current;
        const inner = textRef.current;
        if (!container || !inner) return;

        const measure = () => {
            const cw = container.offsetWidth;
            const tw = inner.scrollWidth;
            if (tw > cw) {
                setScrollDist(tw + 60);
                setDuration(Math.max(5, tw / 55));
            } else {
                setScrollDist(null);
            }
        };

        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(container);
        return () => ro.disconnect();
    }, [text]);

    const isScrolling = scrollDist !== null;

    return (
        <div
            ref={containerRef}
            className="overflow-hidden w-full whitespace-nowrap"
        >
            <span
                style={
                    isScrolling
                        ? {
                            display: "inline-flex",
                            gap: "3.75rem",
                            animation: `status-scroll ${duration}s linear infinite`,
                            ["--scroll-dist" as string]: `-${scrollDist}px`,
                        }
                        : {
                            display: "inline-block",
                            maxWidth: "100%",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            verticalAlign: "middle",
                        }
                }
            >
                <span ref={textRef}>{text}</span>
                {isScrolling && <span aria-hidden>{text}</span>}
            </span>
        </div>
    );
}

function HomeContent() {
    const {hoverInfo} = useHoverInfo();
    const {
        debugError,
        setDebugError,
        logs,
        toastVisible,
        setToastVisible,
        addLog,
        showError,
    } = useAppLogging();

    const [windowWidth, setWindowWidth] = useState<number>(
        typeof window !== "undefined" ? window.innerWidth : 1200,
    );
    const [showLeftSidebar, setShowLeftSidebar] = useState(true);
    const [showRightSidebar, setShowRightSidebar] = useState(true);
    const [resetSidebarToken, setResetSidebarToken] = useState(0);

    const [pendingFolderChange, setPendingFolderChange] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [streamingOpen, setStreamingOpen] = useState(false);

    const settingsOpenRef = useRef(false);
    const streamingOpenRef = useRef(false);
    const pendingFolderChangeRef = useRef(false);

    settingsOpenRef.current = settingsOpen;
    streamingOpenRef.current = streamingOpen;
    pendingFolderChangeRef.current = pendingFolderChange;

    // Global context menu state
    const [globalContextMenu, setGlobalContextMenu] = useState<{
        x: number;
        y: number;
        items: ContextMenuItem[];
    } | null>(null);
    const hideGlobalContextMenu = useCallback(
        () => setGlobalContextMenu(null),
        [],
    );

    const SIDEBAR_BREAKPOINT = 900;
    const isCompact = windowWidth < SIDEBAR_BREAKPOINT;

    const settings = usePlayerSettings();
    const lang = settings.language;

    // ── Status bar notification ──────────────────────────────────────────────
    const [statusNotif, setStatusNotif] = useState<{
        type: 'cover-saved' | 'volume-limit';
        msgKey: string;
        vars?: Record<string, string | number>;
    } | null>(null);
    const notifTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const showStatusNotif = useCallback(
        (type: 'cover-saved' | 'volume-limit', vars?: Record<string, string | number>) => {
            if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
            setStatusNotif({
                type,
                msgKey: type === 'cover-saved' ? 'notification.coverSaved' : 'notification.volumeLimit',
                vars,
            });
            if (type === 'cover-saved') {
                notifTimerRef.current = setTimeout(() => {
                    setStatusNotif((prev) => prev?.type === 'cover-saved' ? null : prev);
                }, 3000);
            }
        },
        [],
    );

    // Show/clear volume-limit notification reactively
    const prevVolumeLimitExceeded = useRef(false);
    useEffect(() => {
        const exceeded = settings.volumeLimitExceeded;
        if (exceeded && !prevVolumeLimitExceeded.current) {
            showStatusNotif('volume-limit', {limit: settings.volumeLimit});
        } else if (!exceeded && prevVolumeLimitExceeded.current) {
            setStatusNotif((prev) => prev?.type === 'volume-limit' ? null : prev);
        }
        prevVolumeLimitExceeded.current = exceeded;
    }, [settings.volumeLimitExceeded, settings.volumeLimit, showStatusNotif]);

    const player = useAudioPlayer({
        lang,
        musicFolder: settings.musicFolder,
        autoWallpaper: settings.autoWallpaper,
        folderSort: settings.folderSort,
        fileSort: settings.fileSort,
        sortDir: settings.sortDir,
        nameSource: settings.nameSource,
        formats: settings.formats,
        shuffle: settings.shuffle,
        repeat: settings.repeat,
        volumeMode: settings.volumeMode,
        appVolume: settings.appVolume,
        systemVolume: settings.systemVolume,
        setAppVolume: settings.setAppVolume,
        setSystemVolume: settings.setSystemVolume,
        volumeLimit: settings.volumeLimit,
        showError,
        addLog,
        setSystemMuted: settings.setSystemMuted,
        lastLocalVolumeSetRef: settings.lastLocalVolumeSetRef,
        pauseIfMuted: settings.pauseIfMuted,
        systemMuted: settings.systemMuted,
    });

    useKeyboardShortcuts({
        shortcutsRef: settings.shortcutsRef,
        settingsOpenRef,
        streamingOpenRef,
        pendingFolderChangeRef,
        togglePlayPauseRef: player.togglePlayPauseRef,
        playNextRef: player.playNextRef,
        playPrevRef: player.playPrevRef,
        appVolumeRef: settings.appVolumeRef,
        systemVolumeRef: settings.systemVolumeRef,
        volumeStepRef: settings.volumeStepRef,
        setAppVolume: settings.setAppVolume,
        setSystemVolume: settings.setSystemVolume,
        setSystemMuted: settings.setSystemMuted,
        volumeModeRef: settings.volumeModeRef,
        volumeLimitRef: settings.volumeLimitRef,
        audioRef: player.audioRef,
        lastLocalVolumeSetRef: settings.lastLocalVolumeSetRef,
    });

    const {
        updateChecking,
        updateStatus,
        updateDownloaded,
        updateTotal,
        handleCheckUpdate,
        autoUpdateInfo,
        autoUpdateDownloading,
        autoUpdateProgress,
        autoUpdateTotal,
        dismissAutoUpdate,
        skipAutoUpdateVersion,
        startAutoUpdateDownload,
    } = useAppUpdater({addLog, lang});

    useEffect(() => {
        if (!isCompact) {
            setShowLeftSidebar(true);
            setShowRightSidebar(true);
        } else {
            setShowLeftSidebar(false);
            setShowRightSidebar(false);
        }
    }, [isCompact]);

    useEffect(() => {
        let raf = 0;
        const handleResize = () => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => setWindowWidth(window.innerWidth));
        };
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    useEffect(() => {
        const preventNative = (e: MouseEvent) => e.preventDefault();
        document.addEventListener("contextmenu", preventNative, true);
        return () =>
            document.removeEventListener("contextmenu", preventNative, true);
    }, []);

    useEffect(() => {
        const blockReload = (e: KeyboardEvent) => {
            if (
                ((e.ctrlKey || e.metaKey) && e.key == "r") ||
                ((e.ctrlKey || e.metaKey) && e.key == "R")
            ) {
                e.preventDefault();
            }
        };
        document.addEventListener("keydown", blockReload, true);
        return () => document.removeEventListener("keydown", blockReload, true);
    }, []);

    const showGlobalContextMenu = useCallback(
        (e: React.MouseEvent) => {
            if (settingsOpenRef.current || streamingOpenRef.current) return;

            e.preventDefault();
            e.stopPropagation();

            const hasSong = !!player.selectedSong;
            const items: ContextMenuItem[] = [
                {
                    label: t(lang, "contextMenu.reloadPage"),
                    icon: (
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                            <path d="M21 3v5h-5" />
                            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                            <path d="M8 16H3v5" />
                        </svg>
                    ),
                    onClick: () => window.location.reload(),
                },
                {separator: true} as ContextMenuItem,
                {
                    label: t(lang, "contextMenu.playPause"),
                    icon: player.isPlaying ? (
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <rect x="6" y="4" width="4" height="16" />
                            <rect x="14" y="4" width="4" height="16" />
                        </svg>
                    ) : (
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                    ),
                    onClick: player.togglePlayPause,
                    disabled: !hasSong,
                },
                {
                    label: t(lang, "contextMenu.next"),
                    icon: (
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <polygon points="5 4 15 12 5 20 5 4" />
                            <line x1="19" y1="5" x2="19" y2="19" />
                        </svg>
                    ),
                    onClick: player.playNext,
                    disabled: !hasSong,
                },
                {
                    label: t(lang, "contextMenu.prev"),
                    icon: (
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <polygon points="19 20 9 12 19 4 19 20" />
                            <line x1="5" y1="19" x2="5" y2="5" />
                        </svg>
                    ),
                    onClick: player.playPrev,
                    disabled: !hasSong,
                },
                {separator: true} as ContextMenuItem,
                {
                    label: t(lang, "contextMenu.increaseVolume"),
                    icon: (
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                        </svg>
                    ),
                    onClick: () => {
                        const step = settings.volumeStep / 100;
                        const newVol = Math.min(1, player.activeVolume + step);
                        player.handleVolumeChange({
                            target: {value: String(newVol)},
                        } as ChangeEvent<HTMLInputElement>);
                    },
                },
                {
                    label: t(lang, "contextMenu.decreaseVolume"),
                    icon: (
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                            <line x1="23" y1="9" x2="17" y2="15" />
                            <line x1="17" y1="9" x2="23" y2="15" />
                        </svg>
                    ),
                    onClick: () => {
                        const step = settings.volumeStep / 100;
                        const newVol = Math.max(0, player.activeVolume - step);
                        player.handleVolumeChange({
                            target: {value: String(newVol)},
                        } as ChangeEvent<HTMLInputElement>);
                    },
                },
                {separator: true} as ContextMenuItem,
                {
                    label: t(lang, "contextMenu.shuffle"),
                    icon: (
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <polyline points="16 3 21 3 21 8" />
                            <line x1="4" y1="20" x2="21" y2="3" />
                            <polyline points="21 16 21 21 16 21" />
                            <line x1="15" y1="15" x2="21" y2="21" />
                            <line x1="4" y1="4" x2="9" y2="9" />
                        </svg>
                    ),
                    onClick: () => settings.setShuffleState(!settings.shuffle),
                    disabled: !hasSong,
                    active: settings.shuffle,
                    badge: settings.shuffle
                        ? (t(lang, "playback.shuffleOn").split(":")[1]?.trim() ?? "ON")
                        : undefined,
                },
                {
                    label:
                        settings.repeat === "off"
                            ? t(lang, "playback.repeatOff")
                            : settings.repeat === "all"
                                ? t(lang, "playback.repeatAll")
                                : t(lang, "playback.repeatOne"),
                    icon: (
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <polyline points="17 1 21 5 17 9" />
                            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                            <polyline points="7 23 3 19 7 15" />
                            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                        </svg>
                    ),
                    onClick: () => {
                        const next =
                            settings.repeat === "off"
                                ? "all"
                                : settings.repeat === "all"
                                    ? "one"
                                    : "off";
                        settings.setRepeatState(next);
                    },
                    disabled: !hasSong,
                    active: settings.repeat !== "off",
                    badge: settings.repeat === "one" ? "×1" : undefined,
                },
                {separator: true} as ContextMenuItem,
                {
                    label: t(lang, "contextMenu.openSettings"),
                    icon: (
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                            <circle cx="12" cy="12" r="3" />
                        </svg>
                    ),
                    onClick: () => setSettingsOpen(true),
                },
                {
                    label: t(lang, "contextMenu.openStreaming"),
                    icon: (
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M4 11a9 9 0 0 1 9 9" />
                            <path d="M4 4a16 16 0 0 1 16 16" />
                            <circle cx="5" cy="19" r="1" />
                        </svg>
                    ),
                    onClick: () => setStreamingOpen(true),
                },
            ];
            setGlobalContextMenu({
                x: e.clientX,
                y: e.clientY,
                items: [...items, ...appendDevTools(items, lang)],
            });
        },
        [
            lang,
            player.selectedSong,
            player.isPlaying,
            player.togglePlayPause,
            player.playNext,
            player.playPrev,
            player.activeVolume,
            player.handleVolumeChange,
            settings.volumeStep,
            settings.shuffle,
            settings.setShuffleState,
            settings.repeat,
            settings.setRepeatState,
        ],
    );

    const doPickFolder = useCallback(async () => {
        try {
            const mod = await getTauri();
            const result = await mod.invoke<string | null>("pick_folder");
            if (result) {
                settings.setMusicFolder(result);
                player.setCurrentPath(result);
                player.setSelectedSong(null);
                player.setMetadata(null);
            }
        } catch (e) {
            const msg = String(e);
            setDebugError(`${t(lang, "alert.error")}: ${msg}`);
            showError(`${t(lang, "alert.error")}: ${msg}`);
        }
    }, [lang, settings, player, setDebugError, showError]);

    const handlePickFolder = useCallback(async () => {
        if (!isBrowserTauri) {
            setDebugError(t(lang, "alert.error"));
            showError(t(lang, "alert.error"));
            return;
        }
        if (player.isPlaying) {
            setPendingFolderChange(true);
            return;
        }
        await doPickFolder();
    }, [lang, player.isPlaying, doPickFolder, setDebugError, showError]);

    const handleResetAllSettings = useCallback(() => {
        (window as any).__symvoniaResetInProgress = true;
        localStorage.clear();
        window.location.reload();
    }, []);

    const handlePickWallpaper = useCallback(async () => {
        if (!isBrowserTauri) {
            setDebugError(t(lang, "alert.error"));
            showError(t(lang, "alert.error"));
            return;
        }
        try {
            const mod = await getTauri();
            const result = await mod.invoke<string | null>("pick_wallpaper");
            if (result) {
                settings.setDefaultWallpaper(result);
            }
        } catch (e) {
            const msg = String(e);
            setDebugError(`${t(lang, "alert.error")}: ${msg}`);
            showError(`${t(lang, "alert.error")}: ${msg}`);
        }
    }, [lang, settings, setDebugError, showError]);

    const confirmFolderChange = useCallback(() => {
        setPendingFolderChange(false);
        if (player.audioRef.current) {
            player.audioRef.current.pause();
            player.audioRef.current.currentTime = 0;
        }
        player.setIsPlaying(false);
        player.setCurrentTime(0);
        doPickFolder();
    }, [doPickFolder, player]);

    const displayPath = player.currentPath || "";

    const showSkeleton =
        !settings.initialized ||
        (settings.musicFolder !== null &&
            (!player.filesLoadedOnce || !player.sessionRestored));

    if (showSkeleton) {
        return (
            <div className="h-full flex flex-col overflow-hidden bg-linear-to-b from-zinc-950 to-black text-zinc-100 select-none font-sans">
                <FullInitSkeleton />
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col overflow-hidden bg-linear-to-b from-zinc-950 to-black text-zinc-100 select-none font-sans">
            <HomeHeader
                lang={lang}
                isCompact={isCompact}
                musicFolder={settings.musicFolder}
                selectedSong={player.selectedSong}
                metadata={player.metadata}
                isPlaying={player.isPlaying}
                showLeftSidebar={showLeftSidebar}
                showRightSidebar={showRightSidebar}
                accentColor={settings.accentColor}
                onOpenStreaming={() => setStreamingOpen(true)}
                onOpenSettings={() => setSettingsOpen(true)}
                onToggleLeftSidebar={() => setShowLeftSidebar((v) => !v)}
                onToggleRightSidebar={() => setShowRightSidebar((v) => !v)}
                onGlobalContextMenu={showGlobalContextMenu}
            />

            <HomePlayerArea
                lang={lang}
                musicFolder={settings.musicFolder}
                isCompact={isCompact}
                showLeftSidebar={showLeftSidebar}
                showRightSidebar={showRightSidebar}
                files={player.files}
                loadingFiles={player.loadingFiles}
                selectedSong={player.selectedSong}
                metadata={player.metadata}
                coverDataUrl={player.coverDataUrl}
                displayPath={displayPath}
                debugError={debugError}
                currentTime={player.currentTime}
                duration={player.duration}
                isPlaying={player.isPlaying}
                shuffle={settings.shuffle}
                repeat={settings.repeat}
                volume={player.activeVolume}
                volumeStep={settings.volumeStep}
                volumeMode={settings.volumeMode}
                systemVolumeSynced={settings.systemVolumeSynced}
                systemMuted={settings.systemMuted}
                volumeLimit={settings.volumeLimit}
                gainBoost={player.gainBoost}
                minGainBoost={player.minGainBoost}
                maxGainBoost={player.maxGainBoost}
                setGainBoost={player.setGainBoost}
                gainBoostSupported={player.gainBoostSupported}
                resetSidebarToken={resetSidebarToken}
                accentColor={settings.accentColor}
                handlePickFolder={handlePickFolder}
                goUp={player.goUp}
                setCurrentPath={player.setCurrentPath}
                playSong={player.playSong}
                handleSeek={player.handleSeek}
                playPrev={player.playPrev}
                togglePlayPause={player.togglePlayPause}
                playNext={player.playNext}
                setShuffle={settings.setShuffleState}
                setRepeat={settings.setRepeatState}
                handleVolumeChange={player.handleVolumeChange}
                toggleSystemMute={player.toggleSystemMute}
                onGlobalContextMenu={showGlobalContextMenu}
                onCoverSaved={() => showStatusNotif('cover-saved')}
            />

            <HomeModals
                lang={lang}
                setLang={settings.setLanguage}
                pendingFolderChange={pendingFolderChange}
                onConfirmFolderChange={confirmFolderChange}
                onCancelFolderChange={() => setPendingFolderChange(false)}
                settingsOpen={settingsOpen}
                onCloseSettings={() => setSettingsOpen(false)}
                musicFolder={settings.musicFolder}
                onChangeFolder={handlePickFolder}
                autoWallpaper={settings.autoWallpaper}
                setAutoWallpaper={settings.setAutoWallpaperState}
                resetOnClose={settings.resetOnClose}
                setResetOnClose={settings.setResetOnCloseState}
                volumeStep={settings.volumeStep}
                setVolumeStep={settings.setVolumeStep}
                volumeMode={settings.volumeMode}
                setVolumeMode={(v: string) =>
                    settings.setVolumeModeState(v as "app" | "system")
                }
                volumeLimit={settings.volumeLimit}
                setVolumeLimit={settings.handleVolumeLimitSetting}
                pauseIfMuted={settings.pauseIfMuted}
                setPauseIfMuted={settings.setPauseIfMuted}
                volume={player.activeVolume}
                defaultWallpaper={settings.defaultWallpaper}
                onPickWallpaper={handlePickWallpaper}
                onClearWallpaper={() => settings.setDefaultWallpaper(null)}
                folderSort={settings.folderSort}
                setFolderSort={settings.setFolderSortState}
                fileSort={settings.fileSort}
                setFileSort={settings.setFileSortState}
                sortDir={settings.sortDir}
                setSortDir={settings.setSortDirState}
                nameSource={settings.nameSource}
                setNameSource={settings.setNameSourceState}
                formats={settings.formats}
                setFormats={settings.setFormatsState}
                shortcuts={settings.shortcuts}
                updateShortcut={settings.updateShortcut}
                resetShortcuts={settings.resetShortcuts}
                accentColor={settings.accentColor}
                setAccentColor={settings.setAccentColorState}
                customAccentHex={settings.customAccentHex}
                setCustomAccentHex={settings.setCustomAccentHexState}
                onResetSidebarWidth={() => setResetSidebarToken((t) => t + 1)}
                onResetAllSettings={handleResetAllSettings}
                logs={logs}
                onCheckUpdate={handleCheckUpdate}
                updateStatus={updateStatus}
                updateChecking={updateChecking}
                updateDownloaded={updateDownloaded}
                updateTotal={updateTotal}
                streamingOpen={streamingOpen}
                onCloseStreaming={() => setStreamingOpen(false)}
            />

            <HomeAlerts
                lang={lang}
                toastVisible={toastVisible}
                onCloseToast={() => setToastVisible(false)}
                updateAlertInfo={autoUpdateInfo}
                updateAlertDownloading={autoUpdateDownloading}
                updateAlertProgress={autoUpdateProgress}
                updateAlertTotal={autoUpdateTotal}
                onUpdate={startAutoUpdateDownload}
                onRemindLater={dismissAutoUpdate}
                onStayCurrent={skipAutoUpdateVersion}
            />

            {globalContextMenu && (
                <ContextMenu
                    x={globalContextMenu.x}
                    y={globalContextMenu.y}
                    items={globalContextMenu.items}
                    onClose={hideGlobalContextMenu}
                />
            )}

            {/* Status Bar */}
            <div className="w-full h-6 bg-zinc-950/85 backdrop-blur-md border-t border-white/5 px-3 text-[11px] text-zinc-400 font-medium select-none flex items-center justify-between z-50 shrink-0 relative overflow-hidden">
                <div className="flex-1 min-w-0 overflow-hidden relative">
                    {hoverInfo && <StatusBarText text={hoverInfo} />}
                </div>
                {statusNotif && (
                    <div
                        className={`shrink-0 flex items-center gap-1.5 px-2 mx-2 rounded text-[10px] font-semibold whitespace-nowrap ${statusNotif.type === 'volume-limit'
                                ? 'text-amber-300'
                                : 'text-emerald-400'
                            }`}
                    >
                        {statusNotif.type === 'volume-limit' ? (
                            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                        )}
                        <span>{t(lang, statusNotif.msgKey, statusNotif.vars)}</span>
                    </div>
                )}
                <div className="flex items-center gap-3 shrink-0 text-zinc-600 text-[10px] uppercase tracking-wider font-semibold ml-3">
                    <span>v1.0.0</span>
                    <span className="h-2.5 w-px bg-zinc-800" />
                    <span>Symvonia</span>
                </div>
            </div>
        </div>
    );
}
