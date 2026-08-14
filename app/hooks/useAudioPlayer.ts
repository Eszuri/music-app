import {useCallback, useEffect, useRef, useState} from "react";
import type {FileEntry} from "../components/FolderExplorer";
import type {SongMetadata} from "../components/PlayerPanel";
import {
    getTauri,
    isBrowserTauri,
    loadSessionState,
    saveSessionState,
    type SessionState,
} from "../lib/homeState";
import {t, type Lang} from "../lib/translations";
import {useGainBoost} from "./useGainBoost";
import {useEqualizer} from "./useEqualizer";
import {useBitPerfectEngine} from "./useBitPerfectEngine";
import {useVolumeFade} from "./audio/useVolumeFade";
import {useAudioSrc} from "./audio/useAudioSrc";

interface UseAudioPlayerOptions {
    lang: Lang;
    musicFolder: string | null;
    autoWallpaper: boolean;
    folderSort: string;
    fileSort: string;
    sortDir: string;
    nameSource: string;
    formats: string[];
    shuffle: boolean;
    repeat: "off" | "all" | "one";
    volumeMode: "app" | "system";
    appVolume: number;
    systemVolume: number;
    setAppVolume: (v: number) => void;
    setSystemVolume: (v: number) => void;
    volumeLimit: number;
    showError: (msg: string) => void;
    addLog: (level: string, message: string) => void;
    setSystemMuted: React.Dispatch<React.SetStateAction<boolean>>;
    lastLocalVolumeSetRef: React.RefObject<number>;
    pauseIfMuted: boolean;
    systemMuted: boolean;
    fadeAudio?: boolean;
    fadeDuration?: number;
    outputMode?: "default" | "bitperfect";
    outputDevice?: string | null;
}

const MIN_RESUME_VOLUME = 0.01;

export function useAudioPlayer(options: UseAudioPlayerOptions) {
    const {
        lang,
        musicFolder,
        autoWallpaper,
        folderSort,
        fileSort,
        sortDir,
        nameSource,
        formats,
        shuffle,
        repeat,
        volumeMode,
        appVolume,
        systemVolume,
        setAppVolume,
        setSystemVolume,
        volumeLimit,
        showError,
        addLog,
        setSystemMuted,
        lastLocalVolumeSetRef,
        pauseIfMuted,
        systemMuted,
        fadeAudio = true,
        fadeDuration = 500,
        outputMode = "default",
        outputDevice = null,
    } = options;

    const [files, setFiles] = useState<FileEntry[]>([]);
    const [filesLoadedOnce, setFilesLoadedOnce] = useState(false);
    const [sessionRestored, setSessionRestored] = useState(false);
    const [loadingFiles, setLoadingFiles] = useState(false);
    const [currentPath, setCurrentPath] = useState<string | null>(() => options.musicFolder || null);
    const [selectedSong, setSelectedSong] = useState<FileEntry | null>(null);
    const [metadata, setMetadata] = useState<SongMetadata | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTimeState] = useState(0);
    const currentTimeRef = useRef(0);
    const setCurrentTime = useCallback((t: number) => {
        currentTimeRef.current = t;
        setCurrentTimeState(t);
    }, []);
    const [duration, setDuration] = useState(0);
    const coverDataUrl = metadata?.cover_b64
        ? `data:${metadata.cover_mime || 'image/jpeg'};base64,${metadata.cover_b64}`
        : null;

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const filesRef = useRef<FileEntry[]>([]);
    const selectedSongRef = useRef<FileEntry | null>(null);
    const metadataRef = useRef<SongMetadata | null>(null);
    const playlistRef = useRef<FileEntry[]>([]);
    const volumeModeRef = useRef<"app" | "system">("app");
    const volumeLimitRef = useRef<number>(0);
    const autoWallpaperRef = useRef<boolean>(autoWallpaper);
    const folderSortRef = useRef<string>("name");
    const fileSortRef = useRef<string>("name");
    const sortDirRef = useRef<string>("asc");
    const nameSourceRef = useRef<string>("filename");
    const formatsRef = useRef<string[]>(formats);
    const shuffleRef = useRef(false);
    const repeatRef = useRef<"off" | "all" | "one">("off");
    const isMountedRef = useRef(true);
    const playTokenRef = useRef(0);
    const loadFilesTokenRef = useRef(0);
    const autoPausedBySilenceRef = useRef(false);
    const lastSessionSaveRef = useRef(0);
    const restoredPendingPlayRef = useRef(false);
    const sessionRestoreAttemptedRef = useRef(false);
    const playlistFolderRef = useRef<string | null>(null);
    const skipPlaylistRebuildRef = useRef(false);
    const outputDeviceRef = useRef<string | null>(outputDevice);
    const bpActiveRef = useRef(false);
    const prevBpActiveRef = useRef<boolean | null>(null);
    const bpSendCommandRef = useRef<(cmd: Record<string, unknown>) => Promise<void>>(async () => {});
    const enginePlayRef = useRef<(file: FileEntry, seekPosition?: number) => Promise<void>>(async () => {});

    const { fadeVolumeTo, cancelFade, fadeTokenRef, fadeAudioRef, fadeDurationRef } = useVolumeFade(audioRef, fadeAudio, fadeDuration);
    const { getAudioSrc } = useAudioSrc();

    const currentPathRef = useRef<string | null>(currentPath);
    useEffect(() => {
        currentPathRef.current = currentPath;
    }, [currentPath]);

    const makeTempFileEntry = (filePath: string): FileEntry => {
        const name = filePath.split(/[/\\]/).pop() || filePath;
        const ext = name.includes('.') ? name.split('.').pop() || '' : '';
        return {
            name,
            path: filePath,
            is_dir: false,
            ext,
            mtime: Date.now(),
            size: 0,
            ctime: Date.now(),
            display_name: name,
            sort_key: name,
        };
    };





    useEffect(() => {
        filesRef.current = files;
        selectedSongRef.current = selectedSong;
        metadataRef.current = metadata;
        autoWallpaperRef.current = autoWallpaper;
        formatsRef.current = formats;
        volumeModeRef.current = volumeMode;
        volumeLimitRef.current = volumeLimit;
        folderSortRef.current = folderSort;
        fileSortRef.current = fileSort;
        sortDirRef.current = sortDir;
        nameSourceRef.current = nameSource;
        shuffleRef.current = shuffle;
        repeatRef.current = repeat;
        outputDeviceRef.current = outputDevice;
    });

    const activeVolume = volumeMode === "system" ? systemVolume : appVolume;

    const isVolumeSilent = useCallback(() => {
        return volumeMode === "app"
            ? appVolume <= 0
            : systemMuted || systemVolume <= 0;
    }, [appVolume, systemMuted, systemVolume, volumeMode]);

    const setMinimumResumeVolume = useCallback(async () => {
        if (volumeMode === "app") {
            setAppVolume(MIN_RESUME_VOLUME);
            if (audioRef.current) audioRef.current.volume = MIN_RESUME_VOLUME;
            return MIN_RESUME_VOLUME;
        }

        const targetPct = 1;
        const targetVolume = targetPct / 100;
        setSystemVolume(targetVolume);
        setSystemMuted(false);
        lastLocalVolumeSetRef.current = Date.now();

        if (!isBrowserTauri) return targetVolume;

        try {
            const mod = await getTauri();
            await mod.invoke("set_system_volume", {value: targetPct});
            await mod.invoke("set_system_mute", {mute: false});
        } catch {
            // Keep local playback responsive even if the OS volume call fails.
        }
        return targetVolume;
    }, [
        lastLocalVolumeSetRef,
        setAppVolume,
        setSystemMuted,
        setSystemVolume,
        volumeMode,
    ]);

    /** Apply wallpaper from current metadata*/
    const applyWallpaper = useCallback(
        async (meta: SongMetadata, token?: number) => {
            if (!isBrowserTauri || !autoWallpaperRef.current) return;
            try {
                const mod = await getTauri();
                if (token !== undefined && token !== playTokenRef.current) return;
                if (meta.cover_b64) {
                    await mod.invoke("set_wallpaper", {coverB64: meta.cover_b64});
                } else {
                    await mod.invoke("clear_wallpaper");
                }
            } catch (e) {
                showError(t(lang, 'log.wallpaperError', {msg: String(e)}));
            }
        },
        [showError],
    );

    // ─── file listing ──────────────────────────────────────────────────────────

    const loadFiles = useCallback(
        async (dirPath: string) => {
            const token = ++loadFilesTokenRef.current;
            setLoadingFiles(true);
            try {
                const mod = await getTauri();
                const result = await mod.invoke<FileEntry[]>("list_files", {
                    path: dirPath,
                    folderSort: folderSortRef.current || "name",
                    fileSort: fileSortRef.current || "name",
                    sortDir: sortDirRef.current || "asc",
                    nameSource: nameSourceRef.current || "filename",
                    formats: formatsRef.current && formatsRef.current.length > 0 ? formatsRef.current : ['mp3', 'flac', 'ogg', 'wav', 'm4a', 'wma'],
                });
                if (token !== loadFilesTokenRef.current)
                    return;
                setFiles(result || []);
                setSelectedSong((prev) => {
                    if (!prev) return null;
                    const updated = (result || []).find((f) => f.path === prev.path);
                    return updated || prev;
                });
            } catch (e) {
                if (token !== loadFilesTokenRef.current)
                    return;
                console.error("[Symvonia] Failed to list files in:", dirPath, e);
                showError(String(e));
                setFiles([]);
            } finally {
                if (token === loadFilesTokenRef.current) {
                    setLoadingFiles(false);
                    setFilesLoadedOnce(true);
                }
            }
        },
        [showError],
    );

    const refreshFiles = useCallback(() => {
        if (currentPath) {
            loadFiles(currentPath);
        }
    }, [currentPath, loadFiles]);

    // ─── metadata ──────────────────────────────────────────────────────────────

    const loadMetadata = useCallback(
        async (filePath: string, skipWallpaper = false) => {
            const token = ++playTokenRef.current;
            try {
                const mod = await getTauri();
                const result = await mod.invoke<SongMetadata>("get_metadata", {
                    filePath,
                });
                if (token !== playTokenRef.current || !isMountedRef.current) return;
                setMetadata(result);
                if (result.duration) setDuration(result.duration);
                // Fire-and-forget — wallpaper update must never block metadata state update
                if (!skipWallpaper) applyWallpaper(result, token).catch(() => {});
            } catch {
                if (token !== playTokenRef.current || !isMountedRef.current) return;
                setMetadata(null);
            }
        },
        [applyWallpaper],
    );

    const syncSongPlaylist = useCallback(async (filePath: string) => {
        const songParent = filePath.replace(/[/\\][^/\\]+$/, "");
        try {
            let fileList = filesRef.current;
            if (currentPathRef.current !== songParent || fileList.length === 0) {
                if (isBrowserTauri) {
                    const mod = await getTauri();
                    fileList = await mod.invoke<FileEntry[]>("list_files", {
                        path: songParent,
                        folderSort: folderSortRef.current,
                        fileSort: fileSortRef.current,
                        sortDir: sortDirRef.current,
                        nameSource: nameSourceRef.current,
                        formats: formatsRef.current,
                    });
                    if (isMountedRef.current) {
                        setFiles(fileList);
                        setCurrentPath(songParent);
                    }
                }
            }
            const songFile = fileList.find((f) => !f.is_dir && f.path === filePath);
            const targetSong = songFile || makeTempFileEntry(filePath);
            if (isMountedRef.current) {
                setSelectedSong(targetSong);
                loadMetadata(filePath, true);
            }
            playlistRef.current = fileList.filter((f) => !f.is_dir);
            playlistFolderRef.current = songParent;
        } catch {
            const tempFile = makeTempFileEntry(filePath);
            if (isMountedRef.current) {
                setSelectedSong(tempFile);
                loadMetadata(filePath, true);
            }
        }
    }, [loadMetadata]);

    // ─── path / folder effects ─────────────────────────────────────────────────

    useEffect(() => {
        if (musicFolder) {
            setCurrentPath((prev) => {
                if (!prev || !prev.startsWith(musicFolder)) {
                    return musicFolder;
                }
                return prev;
            });
        } else {
            setCurrentPath(null);
        }
    }, [musicFolder]);

    useEffect(() => {
        if (currentPath) {
            loadFiles(currentPath);
        } else {
            setFiles([]);
        }
    }, [currentPath, loadFiles]);

    useEffect(() => {
        if (currentPath) loadFiles(currentPath);
    }, [folderSort, fileSort, sortDir, nameSource, formats]);

    useEffect(() => {
        skipPlaylistRebuildRef.current = true;
    }, [folderSort, nameSource]);

    useEffect(() => {
        if (skipPlaylistRebuildRef.current) {
            skipPlaylistRebuildRef.current = false;
            return;
        }
        if (!playlistFolderRef.current) return;
        if (currentPath !== playlistFolderRef.current) return;
        const freshFiles = files.filter((f) => !f.is_dir);
        if (freshFiles.length === 0) return;
        playlistRef.current = freshFiles;
    }, [files]);

    // ─── session restore ───────────────────────────────────────────────────────

    useEffect(() => {
        if (!filesLoadedOnce) return;
        if (sessionRestoreAttemptedRef.current) {
            if (!sessionRestored) setSessionRestored(true);
            return;
        }

        const done = () => {
            if (isMountedRef.current) setSessionRestored(true);
        };

        const session = loadSessionState();
        if (!session) {
            sessionRestoreAttemptedRef.current = true;
            done();
            return;
        }

        const savedParent = session.filePath.replace(/[/\\][^/\\]+$/, "");

        if (savedParent !== currentPath) {
            sessionRestoreAttemptedRef.current = true;
            const doNavAndRestore = async () => {
                try {
                    const token = ++loadFilesTokenRef.current;
                    const mod = await getTauri();
                    const result = await mod.invoke<FileEntry[]>("list_files", {
                        path: savedParent,
                        folderSort: folderSortRef.current,
                        fileSort: fileSortRef.current,
                        sortDir: sortDirRef.current,
                        nameSource: nameSourceRef.current,
                        formats: formatsRef.current,
                    });
                    if (token !== loadFilesTokenRef.current || !isMountedRef.current)
                        return;
                    setFiles(result);
                    setCurrentPath(savedParent);
                    await restoreFromFileList(result, session);
                } catch {
                    saveSessionState(null);
                } finally {
                    done();
                }
            };
            doNavAndRestore();
            return;
        }

        if (!files.length && loadingFiles) {
            return;
        }

        sessionRestoreAttemptedRef.current = true;
        restoreFromFileList(files, session).finally(done);

        async function restoreFromFileList(
            fileList: FileEntry[],
            sess: NonNullable<ReturnType<typeof loadSessionState>>,
        ) {
            const savedFile = fileList.find(
                (f) => !f.is_dir && f.path === sess.filePath,
            );
            if (!savedFile) return;

            const audio = audioRef.current;
            if (!audio) return;

            try {
                if (bpActiveRef.current) {
                    audio.pause();
                    audio.removeAttribute("src");
                    audio.load();
                } else {
                    const src = getAudioSrc(savedFile.path);

                    audio.src = src;
                    audio.volume = volumeModeRef.current === "app" ? appVolume : 1;
                    audio.loop = repeatRef.current === "one";

                    const onCanPlay = () => {
                        audio.removeEventListener("canplay", onCanPlay);
                        if (selectedSongRef.current?.path === savedFile.path) {
                            audio.currentTime = sess.currentTime;
                        }
                    };
                    audio.addEventListener("canplay", onCanPlay);
                    audio.load();
                }

                setSelectedSong(savedFile);
                setCurrentTime(sess.currentTime);
                playlistRef.current = fileList.filter((f) => !f.is_dir);
                playlistFolderRef.current = savedFile.path.replace(/[/\\][^/\\]+$/, "");
                restoredPendingPlayRef.current = true;
                await loadMetadata(savedFile.path, true);

                const mins = Math.floor(sess.currentTime / 60);
                const secs = Math.floor(sess.currentTime % 60)
                    .toString()
                    .padStart(2, "0");
                addLog(
                    "info",
                    t(lang, 'log.sessionRestored', {name: savedFile.name, time: `${mins}:${secs}`}),
                );
            } catch {
                saveSessionState(null);
            }
        }
    }, [files, filesLoadedOnce, getAudioSrc]);

    // ─── playback ──────────────────────────────────────────────────────────────

    const playSong = useCallback(
        async (file: FileEntry) => {
            if (file.is_dir) return;

            const audio = audioRef.current;
            if (!audio) return;

            const fileFolder = file.path.replace(/[/\\][^/\\]+$/, "");
            if (fileFolder !== playlistFolderRef.current) {
                playlistRef.current = filesRef.current.filter((f) => !f.is_dir);
                playlistFolderRef.current = fileFolder;
            }

            const token = ++playTokenRef.current;
            audio.pause();

            try {
                let resumeVolume: number | null = null;
                if (pauseIfMuted && isVolumeSilent()) {
                    resumeVolume = await setMinimumResumeVolume();
                }

                const targetVol = volumeModeRef.current === "app" ? (resumeVolume ?? appVolume) : 1;

                if (bpActiveRef.current) {
                    audio.pause();
                    audio.removeAttribute("src");
                    audio.load();
                    await enginePlayRef.current(file);
                } else {
                    const src = getAudioSrc(file.path);
                    audio.src = src;
                    audio.loop = repeatRef.current === "one";

                    if (fadeAudioRef.current && fadeDurationRef.current > 0) {
                        audio.volume = 0;
                        await audio.play();
                        fadeVolumeTo(targetVol, fadeDurationRef.current);
                    } else {
                        audio.volume = targetVol;
                        await audio.play();
                    }
                }

                autoPausedBySilenceRef.current = false;
                restoredPendingPlayRef.current = false;

                if (token !== playTokenRef.current || !isMountedRef.current) return;

                setSelectedSong(file);
                loadMetadata(file.path, false);
                addLog("info", t(lang, 'log.playing', {name: file.name}));
            } catch (e) {
                if (e instanceof DOMException && e.name === "AbortError") return;
                showError(t(lang, 'log.playbackFailed', {msg: (e as Error).message || String(e)}));
            }
        },
        [
            appVolume,
            pauseIfMuted,
            isVolumeSilent,
            setMinimumResumeVolume,
            loadMetadata,
            addLog,
            showError,
            getAudioSrc,
            fadeVolumeTo,
        ],
    );

    const togglePlayPause = useCallback(() => {
        if (bpActiveRef.current) {
            if (isPlaying) {
                bpSendCommandRef.current({command: "pause"}).catch(() => {});
            } else {
                if (restoredPendingPlayRef.current && selectedSongRef.current) {
                    restoredPendingPlayRef.current = false;
                    enginePlayRef.current(selectedSongRef.current, currentTimeRef.current).catch(() => {});
                } else {
                    bpSendCommandRef.current({command: "resume"}).catch(() => {});
                }
            }
            return;
        }

        const audio = audioRef.current;
        if (!audio || !audio.src) return;

        fadeTokenRef.current++;

        if (audio.paused || !isPlaying) {
            setIsPlaying(true);
            const resume = async () => {
                let resumeVolume: number | null = null;
                if (pauseIfMuted && isVolumeSilent()) {
                    resumeVolume = await setMinimumResumeVolume();
                }
                const targetVol = volumeModeRef.current === "app" ? (resumeVolume ?? appVolume) : 1;
                if (fadeAudioRef.current && fadeDurationRef.current > 0) {
                    audio.volume = 0;
                    await audio.play();
                    fadeVolumeTo(targetVol, fadeDurationRef.current);
                } else {
                    audio.volume = targetVol;
                    await audio.play();
                }
                autoPausedBySilenceRef.current = false;

                if (restoredPendingPlayRef.current) {
                    restoredPendingPlayRef.current = false;
                    const meta = metadataRef.current;
                    if (meta) applyWallpaper(meta).catch(() => {});
                }
            };
            resume().catch(() => {});
        } else {
            autoPausedBySilenceRef.current = false;
            setIsPlaying(false);
            const targetVol = volumeModeRef.current === "app" ? appVolume : 1;
            if (fadeAudioRef.current && fadeDurationRef.current > 0) {
                fadeVolumeTo(0, fadeDurationRef.current, () => {
                    audio.pause();
                    audio.volume = targetVol;
                });
            } else {
                audio.pause();
            }
        }
    }, [pauseIfMuted, isVolumeSilent, setMinimumResumeVolume, applyWallpaper, appVolume, fadeVolumeTo, isPlaying]);

    const resetPlayer = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current.removeAttribute("src");
            audioRef.current.load();
        }
        setSelectedSong(null);
        setMetadata(null);
        setCurrentTime(0);
        setDuration(0);
        setIsPlaying(false);
        playlistRef.current = [];
        autoPausedBySilenceRef.current = false;
        restoredPendingPlayRef.current = false;
        saveSessionState(null);
        if (isBrowserTauri) {
            getTauri()
                .then((mod) => {
                    mod.invoke("clear_wallpaper").catch(() => {});
                })
                .catch(() => {});
        }
    }, []);

    const playNext = useCallback(() => {
        const list = playlistRef.current;
        if (list.length === 0) return;

        let nextFile: FileEntry | undefined;
        if (shuffleRef.current) {
            const curPath = selectedSongRef.current?.path;
            const candidates = list.filter((f) => f.path !== curPath);
            nextFile =
                candidates.length > 0
                    ? candidates[Math.floor(Math.random() * candidates.length)]
                    : list[0];
        } else {
            const idx = selectedSongRef.current
                ? list.findIndex((f) => f.path === selectedSongRef.current!.path)
                : -1;
            nextFile = idx >= 0 ? list[idx + 1] : list[0];
            if (!nextFile && repeatRef.current === "all") nextFile = list[0];
        }

        if (nextFile) {
            playSong(nextFile);
        } else {
            resetPlayer();
        }
    }, [playSong, resetPlayer]);

    const playPrev = useCallback(() => {
        const list = playlistRef.current;
        if (list.length === 0) return;

        let prevFile: FileEntry | undefined;
        if (shuffleRef.current) {
            const curPath = selectedSongRef.current?.path;
            const candidates = list.filter((f) => f.path !== curPath);
            prevFile =
                candidates.length > 0
                    ? candidates[Math.floor(Math.random() * candidates.length)]
                    : list[0];
        } else {
            const idx = selectedSongRef.current
                ? list.findIndex((f) => f.path === selectedSongRef.current!.path)
                : -1;
            prevFile =
                idx > 0
                    ? list[idx - 1]
                    : repeatRef.current === "all"
                        ? list[list.length - 1]
                        : undefined;
        }

        if (prevFile) playSong(prevFile);
    }, [playSong]);

    const playNextRef = useRef(playNext);
    const playPrevRef = useRef(playPrev);
    const togglePlayPauseRef = useRef(togglePlayPause);
    useEffect(() => {
        playNextRef.current = playNext;
    }, [playNext]);
    useEffect(() => {
        playPrevRef.current = playPrev;
    }, [playPrev]);
    useEffect(() => {
        togglePlayPauseRef.current = togglePlayPause;
    }, [togglePlayPause]);

    // ─── bit-perfect engine (optional WASAPI Exclusive plugin) ────────────────

    const enginePlay = useCallback(
        async (file: FileEntry, seekPosition?: number) => {
            const cmd: Record<string, unknown> = {
                command: "play",
                path: file.path,
                exclusive: true,
                volume: volumeModeRef.current === "app" ? appVolume : 1,
            };
            if (outputDeviceRef.current) cmd.deviceId = outputDeviceRef.current;
            await bpSendCommandRef.current(cmd);
            if (seekPosition !== undefined && seekPosition > 0) {
                await bpSendCommandRef.current({command: "seek", position: seekPosition});
            }
        },
        [appVolume],
    );

    useEffect(() => {
        enginePlayRef.current = enginePlay;
    }, [enginePlay]);

    const bp = useBitPerfectEngine({
        onProgress: (e) => {
            if (!bpActiveRef.current) return;
            setCurrentTime(e.position);
            if (e.duration > 0) setDuration(e.duration);
            const song = selectedSongRef.current;
            if (song && e.position > 0) {
                const now = Date.now();
                if (now - lastSessionSaveRef.current >= 3000) {
                    lastSessionSaveRef.current = now;
                    saveSessionState({
                        filePath: song.path,
                        currentTime: e.position,
                        timestamp: now,
                    });
                }
            }
        },
        onState: (e) => {
            if (!bpActiveRef.current) return;
            switch (e.state) {
                case "playing":
                    setIsPlaying(true);
                    if (e.path) {
                        restoredPendingPlayRef.current = false;
                        const currentSong = selectedSongRef.current;
                        if (!currentSong || currentSong.path !== e.path || playlistRef.current.length === 0) {
                            syncSongPlaylist(e.path);
                        }
                    }
                    break;
                case "paused":
                    setIsPlaying(false);
                    if (e.path) {
                        const currentSong = selectedSongRef.current;
                        if (!currentSong || currentSong.path !== e.path || playlistRef.current.length === 0) {
                            syncSongPlaylist(e.path);
                        }
                    }
                    break;
                case "stopped":
                    setIsPlaying(false);
                    break;
                case "ended": {
                    setIsPlaying(false);
                    saveSessionState(null);
                    const song = selectedSongRef.current;
                    if (repeatRef.current === "one" && song) {
                        enginePlayRef.current(song).catch(() => {});
                    } else {
                        playNextRef.current();
                    }
                    break;
                }
            }
        },
        onError: (message) => {
            if (!bpActiveRef.current) return;
            setIsPlaying(false);
            showError(t(lang, 'log.playbackFailed', {msg: message}));
        },
    });

    useEffect(() => {
        bpSendCommandRef.current = bp.sendCommand;
    }, [bp.sendCommand]);

    const bpActive = outputMode === "bitperfect" && bp.status?.installed === true;
    useEffect(() => {
        bpActiveRef.current = bpActive;
        if (bpActive) {
            bp.sendCommand({command: "get_state"}).catch(() => {});
        }
    }, [bpActive, bp.sendCommand]);

    // Switching playback engine: silence whichever side is being left behind.
    useEffect(() => {
        if (prevBpActiveRef.current === null) {
            prevBpActiveRef.current = bpActive;
            return;
        }
        if (prevBpActiveRef.current === bpActive) return;
        prevBpActiveRef.current = bpActive;
        if (bpActive) {
            resetPlayer();
            addLog("info", t(lang, 'audio.bitperfect.log.enabled'));
        } else {
            bpSendCommandRef.current({command: "stop"}).catch(() => {});
            resetPlayer();
            addLog("info", t(lang, 'audio.bitperfect.log.disabled'));
        }
    }, [bpActive, addLog, lang, resetPlayer]);

    // Keep engine volume in sync with the app volume slider.
    useEffect(() => {
        if (!bpActiveRef.current) return;
        bpSendCommandRef.current({
            command: "set_volume",
            volume: volumeMode === "app" ? appVolume : 1,
        }).catch(() => {});
    }, [volumeMode, appVolume]);

    // ─── audio element lifecycle ───────────────────────────────────────────────

    useEffect(() => {
        isMountedRef.current = true;
        const audio = new Audio();
        audio.crossOrigin = "anonymous";
        audioRef.current = audio;
        audio.volume = volumeModeRef.current === "app" ? appVolume : 1;

        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);

        const handleTimeUpdate = () => {
            const t = audio.currentTime;
            setCurrentTime(t);
            const song = selectedSongRef.current;
            if (song && t > 0) {
                const now = Date.now();
                if (now - lastSessionSaveRef.current >= 3000) {
                    lastSessionSaveRef.current = now;
                    const session: SessionState = {
                        filePath: song.path,
                        currentTime: t,
                        timestamp: now,
                    };
                    saveSessionState(session);
                }
            }
        };

        const handleDurationChange = () => setDuration(audio.duration || 0);

        const handleEnded = () => {
            saveSessionState(null);
            playNextRef.current();
        };

        audio.addEventListener("play", handlePlay);
        audio.addEventListener("pause", handlePause);
        audio.addEventListener("timeupdate", handleTimeUpdate);
        audio.addEventListener("durationchange", handleDurationChange);
        audio.addEventListener("ended", handleEnded);

        return () => {
            isMountedRef.current = false;
            audio.removeEventListener("play", handlePlay);
            audio.removeEventListener("pause", handlePause);
            audio.removeEventListener("timeupdate", handleTimeUpdate);
            audio.removeEventListener("durationchange", handleDurationChange);
            audio.removeEventListener("ended", handleEnded);
            audio.src = "";
            audioRef.current = null;
        };
    }, []);

    useEffect(() => {
        const flush = () => {
            if ((window as unknown as { __symvoniaResetInProgress?: boolean }).__symvoniaResetInProgress) return;
            const song = selectedSongRef.current;
            const curTime = bpActiveRef.current ? currentTimeRef.current : audioRef.current?.currentTime;
            if (song && curTime && curTime > 0) {
                saveSessionState({
                    filePath: song.path,
                    currentTime: curTime,
                    timestamp: Date.now(),
                });
            }
        };
        window.addEventListener("beforeunload", flush);
        window.addEventListener("pagehide", flush);
        return () => {
            flush();
            window.removeEventListener("beforeunload", flush);
            window.removeEventListener("pagehide", flush);
        };
    }, []);

    // ─── equalizer & gain boost (Web Audio API) ────────────────────────────────
    const equalizer = useEqualizer();
    const gainBoost = useGainBoost(audioRef, equalizer);

    // ─── volume / mute sync ────────────────────────────────────────────────────

    useEffect(() => {
        if (!audioRef.current) return;
        if (volumeMode === "app") {
            audioRef.current.volume = Math.max(0, Math.min(1, appVolume));
        } else {
            audioRef.current.volume = 1;
        }
    }, [volumeMode, appVolume]);

    useEffect(() => {
        if (!pauseIfMuted || !isPlaying) return;
        const isZero =
            volumeMode === "app" ? appVolume <= 0 : systemMuted || systemVolume <= 0;
        if (isZero && audioRef.current) {
            autoPausedBySilenceRef.current = true;
            audioRef.current.pause();
            setIsPlaying(false);
        }
    }, [
        pauseIfMuted,
        volumeMode,
        appVolume,
        systemVolume,
        systemMuted,
        isPlaying,
    ]);

    useEffect(() => {
        if (!pauseIfMuted || !autoPausedBySilenceRef.current) return;
        const audio = audioRef.current;
        if (!audio || !audio.src || !audio.paused) return;
        const stillSilent =
            volumeMode === "app" ? appVolume <= 0 : systemMuted || systemVolume <= 0;
        if (stillSilent) return;
        autoPausedBySilenceRef.current = false;
        audio.play().catch(() => {
            autoPausedBySilenceRef.current = true;
        });
    }, [pauseIfMuted, volumeMode, appVolume, systemVolume, systemMuted]);

    useEffect(() => {
        if (!pauseIfMuted) autoPausedBySilenceRef.current = false;
    }, [pauseIfMuted]);

    useEffect(() => {
        if (audioRef.current) audioRef.current.loop = repeat === "one";
    }, [repeat]);

    // ─── controls ──────────────────────────────────────────────────────────────

    const handleVolumeChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const parsed = parseFloat(e.target.value);
            if (!Number.isFinite(parsed)) return;
            const v = Math.max(0, Math.min(1, parsed));
            if (volumeModeRef.current === "app") {
                setAppVolume(v);
                if (audioRef.current) audioRef.current.volume = v;
            } else {
                const targetPct = Math.round(v * 100);
                if (volumeLimit > 0 && targetPct > volumeLimit) return;
                setSystemVolume(v);
                setSystemMuted(targetPct === 0);
                lastLocalVolumeSetRef.current = Date.now();
                if (isBrowserTauri) {
                    getTauri()
                        .then(async (m) => {
                            await m.invoke("set_system_volume", {value: targetPct});
                            if (targetPct > 0) {
                                await m.invoke("set_system_mute", {mute: false});
                                setSystemMuted(false);
                            }
                        })
                        .catch(() => {});
                }
            }
        },
        [
            volumeLimit,
            setAppVolume,
            setSystemVolume,
            setSystemMuted,
            lastLocalVolumeSetRef,
        ],
    );

    const seekTo = useCallback((t: number) => {
        setCurrentTime(t);
        if (bpActiveRef.current) {
            bpSendCommandRef.current({command: "seek", position: t}).catch(() => {});
        } else if (audioRef.current) {
            audioRef.current.currentTime = t;
        }
    }, [setCurrentTime]);

    const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const t = parseFloat(e.target.value);
        seekTo(t);
    }, [seekTo]);

    const toggleSystemMute = useCallback(() => {
        if (!isBrowserTauri) return;
        const shouldMute = !systemMuted;
        setSystemMuted(shouldMute);
        lastLocalVolumeSetRef.current = Date.now();
        getTauri()
            .then((m) => m.invoke("set_system_mute", {mute: shouldMute}))
            .catch(() => {});
    }, [systemMuted, setSystemMuted, lastLocalVolumeSetRef]);

    const goUp = useCallback(() => {
        if (!currentPath || !musicFolder) return;
        const parent = currentPath
            .replace(/\\/g, "/")
            .split("/")
            .slice(0, -1)
            .join("\\");
        if (parent.length >= musicFolder.length) setCurrentPath(parent);
    }, [currentPath, musicFolder]);

    // ─── return ────────────────────────────────────────────────────────────────

    return {
        files,
        filesLoadedOnce,
        sessionRestored,
        loadingFiles,
        currentPath,
        setCurrentPath,
        selectedSong,
        setSelectedSong,
        metadata,
        setMetadata,
        coverDataUrl,
        isPlaying,
        setIsPlaying,
        currentTime,
        setCurrentTime,
        duration,
        activeVolume,
        audioRef,
        playSong,
        togglePlayPause,
        resetPlayer,
        playNext,
        playPrev,
        togglePlayPauseRef,
        playNextRef,
        playPrevRef,
        handleVolumeChange,
        handleSeek,
        seekTo,
        toggleSystemMute,
        goUp,
        gainBoost: gainBoost.gain,
        setGainBoost: gainBoost.setGain,
        gainBoostSupported: gainBoost.supported,
        minGainBoost: gainBoost.minGain,
        maxGainBoost: gainBoost.maxGain,
        equalizer,
        refreshFiles,
        bpEngineState: bp.engineState,
        bpActive,
    };
}
