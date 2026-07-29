import {useCallback, useEffect, useRef, useState} from 'react';
import type {FileEntry} from '../components/FolderExplorer';
import type {SongMetadata} from '../components/PlayerPanel';
import {getTauri, isBrowserTauri} from '../lib/homeState';

interface UseAudioPlayerOptions {
    musicFolder: string | null;
    autoWallpaper: boolean;
    folderSort: string;
    fileSort: string;
    sortDir: string;
    nameSource: string;
    formats: string[];
    shuffle: boolean;
    repeat: 'off' | 'all' | 'one';
    volumeMode: 'app' | 'system';
    appVolume: number;
    systemVolume: number;
    setAppVolume: (v: number) => void;
    setSystemVolume: (v: number) => void;
    volumeLimit: number;
    showError: (msg: string) => void;
    addLog: (level: string, message: string) => void;
    setSystemMuted: React.Dispatch<React.SetStateAction<boolean>>;
    lastLocalVolumeSetRef: React.MutableRefObject<number>;
    pauseIfMuted: boolean;
    systemMuted: boolean;
}

const MIN_RESUME_VOLUME = 0.01;

export function useAudioPlayer(options: UseAudioPlayerOptions) {
    const {
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
    } = options;

    const [files, setFiles] = useState<FileEntry[]>([]);
    const [loadingFiles, setLoadingFiles] = useState(false);
    const [currentPath, setCurrentPath] = useState<string | null>(null);
    const [selectedSong, setSelectedSong] = useState<FileEntry | null>(null);
    const [metadata, setMetadata] = useState<SongMetadata | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const filesRef = useRef<FileEntry[]>([]);
    const selectedSongRef = useRef<FileEntry | null>(null);
    const playlistRef = useRef<FileEntry[]>([]);
    const volumeModeRef = useRef<'app' | 'system'>('app');
    const volumeLimitRef = useRef<number>(0);
    const autoWallpaperRef = useRef<boolean>(autoWallpaper);
    const folderSortRef = useRef<string>('name');
    const fileSortRef = useRef<string>('name');
    const sortDirRef = useRef<string>('asc');
    const nameSourceRef = useRef<string>('filename');
    const formatsRef = useRef<string[]>(formats);
    const shuffleRef = useRef(false);
    const repeatRef = useRef<'off' | 'all' | 'one'>('off');
    const isMountedRef = useRef(true);
    const playTokenRef = useRef(0);
    const loadFilesTokenRef = useRef(0);
    const autoPausedBySilenceRef = useRef(false);

    filesRef.current = files;
    selectedSongRef.current = selectedSong;
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

    const activeVolume = volumeMode === 'system' ? systemVolume : appVolume;

    const isVolumeSilent = useCallback(() => {
        return volumeMode === 'app'
            ? appVolume <= 0
            : systemMuted || systemVolume <= 0;
    }, [appVolume, systemMuted, systemVolume, volumeMode]);

    const setMinimumResumeVolume = useCallback(async () => {
        if (volumeMode === 'app') {
            setAppVolume(MIN_RESUME_VOLUME);
            if (audioRef.current) {
                audioRef.current.volume = MIN_RESUME_VOLUME;
            }
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
            await mod.invoke('set_system_volume', {value: targetPct});
            await mod.invoke('set_system_mute', {mute: false});
        } catch {
            // Keep local playback responsive even if the OS volume call fails.
        }
        return targetVolume;
    }, [lastLocalVolumeSetRef, setAppVolume, setSystemMuted, setSystemVolume, volumeMode]);

    const loadFiles = useCallback(async (dirPath: string) => {
        const token = ++loadFilesTokenRef.current;
        const needsMetadata = nameSourceRef.current === 'title';
        if (needsMetadata) setLoadingFiles(true);
        try {
            const mod = await getTauri();
            const result = await mod.invoke<FileEntry[]>('list_files', {
                path: dirPath,
                folderSort: folderSortRef.current,
                fileSort: fileSortRef.current,
                sortDir: sortDirRef.current,
                nameSource: nameSourceRef.current,
                formats: formatsRef.current,
            });
            if (token !== loadFilesTokenRef.current || !isMountedRef.current) return;
            setFiles(result);
        } catch (e) {
            if (token !== loadFilesTokenRef.current || !isMountedRef.current) return;
            const msg = String(e);
            showError(msg);
            setFiles([]);
        } finally {
            if (token === loadFilesTokenRef.current) setLoadingFiles(false);
        }
    }, [showError]);

    const loadMetadata = useCallback(async (filePath: string) => {
        const token = ++playTokenRef.current;
        try {
            const mod = await getTauri();
            const result = await mod.invoke<SongMetadata>('get_metadata', {filePath});
            if (token !== playTokenRef.current || !isMountedRef.current) return;
            setMetadata(result);
            if (result.duration) setDuration(result.duration);

            if (isBrowserTauri && autoWallpaperRef.current) {
                if (result.cover_b64) {
                    mod.invoke('set_wallpaper', {
                        coverB64: result.cover_b64,
                    }).catch((e: unknown) => {
                        const msg = String(e);
                        showError(`Wallpaper error: ${msg}`);
                    });
                } else {
                    mod.invoke('clear_wallpaper').catch(() => {});
                }
            }
        } catch {
            if (token !== playTokenRef.current || !isMountedRef.current) return;
            setMetadata(null);
        }
    }, [showError]);

    useEffect(() => {
        if (musicFolder && !currentPath) {
            setCurrentPath(musicFolder);
        } else if (!musicFolder && currentPath) {
            setCurrentPath(null);
        }
    }, [musicFolder, currentPath]);

    useEffect(() => {
        if (currentPath) {
            loadFiles(currentPath);
        } else {
            setFiles([]);
        }
    }, [currentPath, loadFiles]);

    useEffect(() => {
        if (currentPath) loadFiles(currentPath);
    }, [folderSort, fileSort, sortDir, nameSource, formats, currentPath, loadFiles]);

    const playSong = useCallback(async (file: FileEntry) => {
        if (file.is_dir) return;

        const audio = audioRef.current;
        if (!audio) return;

        playlistRef.current = filesRef.current.filter(f => !f.is_dir);

        const token = ++playTokenRef.current;
        audio.pause();

        try {
            let resumeVolume: number | null = null;
            if (pauseIfMuted && isVolumeSilent()) {
                resumeVolume = await setMinimumResumeVolume();
            }

            let src: string;
            if (isBrowserTauri) {
                const mod = await getTauri();
                src = mod.convertFileSrc(file.path);
            } else {
                src = file.path;
            }
            audio.src = src;
            audio.volume = volumeModeRef.current === 'app' ? (resumeVolume ?? appVolume) : 1;
            audio.loop = repeatRef.current === 'one';
            await audio.play();
            autoPausedBySilenceRef.current = false;

            if (token !== playTokenRef.current || !isMountedRef.current) return;

            setSelectedSong(file);
            loadMetadata(file.path);
            addLog('info', `Memutar: ${file.name}`);
        } catch (e) {
            if (e instanceof DOMException && e.name === 'AbortError') return;
            showError(`Gagal memutar: ${(e as Error).message || String(e)}`);
        }
    }, [appVolume, pauseIfMuted, isVolumeSilent, setMinimumResumeVolume, loadMetadata, addLog, showError]);

    const togglePlayPause = useCallback(() => {
        const audio = audioRef.current;
        if (!audio || !audio.src) return;

        if (audio.paused) {
            const resume = async () => {
                if (pauseIfMuted && isVolumeSilent()) {
                    await setMinimumResumeVolume();
                }
                await audio.play();
                autoPausedBySilenceRef.current = false;
            };
            resume().catch(e => console.error('Gagal play:', e));
        } else {
            autoPausedBySilenceRef.current = false;
            audio.pause();
        }
    }, [pauseIfMuted, isVolumeSilent, setMinimumResumeVolume]);

    const resetPlayer = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current.removeAttribute('src');
            audioRef.current.load();
        }
        setSelectedSong(null);
        setMetadata(null);
        setCurrentTime(0);
        setDuration(0);
        setIsPlaying(false);
        playlistRef.current = [];
        autoPausedBySilenceRef.current = false;
        if (isBrowserTauri) {
            getTauri().then(mod => mod.invoke('clear_wallpaper')).catch(() => {});
        }
    }, []);

    const playNext = useCallback(() => {
        const list = playlistRef.current;
        if (list.length === 0) return;

        let nextFile: FileEntry | undefined;
        if (shuffleRef.current) {
            const currentPath = selectedSongRef.current?.path;
            const candidates = list.filter(f => f.path !== currentPath);
            if (candidates.length > 0) {
                nextFile = candidates[Math.floor(Math.random() * candidates.length)];
            } else {
                nextFile = list[0];
            }
        } else {
            const current = selectedSongRef.current;
            const idx = current ? list.findIndex(f => f.path === current.path) : -1;
            nextFile = idx >= 0 ? list[idx + 1] : list[0];
            if (!nextFile && repeatRef.current === 'all') {
                nextFile = list[0];
            }
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
            const currentPath = selectedSongRef.current?.path;
            const candidates = list.filter(f => f.path !== currentPath);
            if (candidates.length > 0) {
                prevFile = candidates[Math.floor(Math.random() * candidates.length)];
            } else {
                prevFile = list[0];
            }
        } else {
            const current = selectedSongRef.current;
            const idx = current ? list.findIndex(f => f.path === current.path) : -1;
            prevFile = idx > 0 ? list[idx - 1] : (repeatRef.current === 'all' ? list[list.length - 1] : undefined);
        }
        if (prevFile) {
            playSong(prevFile);
        }
    }, [playSong]);

    const playNextRef = useRef(playNext);
    useEffect(() => {
        playNextRef.current = playNext;
    }, [playNext]);

    const playPrevRef = useRef(playPrev);
    useEffect(() => {
        playPrevRef.current = playPrev;
    }, [playPrev]);

    const togglePlayPauseRef = useRef(togglePlayPause);
    useEffect(() => {
        togglePlayPauseRef.current = togglePlayPause;
    }, [togglePlayPause]);

    useEffect(() => {
        const audio = new Audio();
        audioRef.current = audio;
        audio.volume = volumeModeRef.current === 'app' ? appVolume : 1;

        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);
        const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
        const handleDurationChange = () => setDuration(audio.duration || 0);
        const handleEnded = () => {
            playNextRef.current();
        };

        audio.addEventListener('play', handlePlay);
        audio.addEventListener('pause', handlePause);
        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('durationchange', handleDurationChange);
        audio.addEventListener('ended', handleEnded);

        return () => {
            isMountedRef.current = false;
            audio.removeEventListener('play', handlePlay);
            audio.removeEventListener('pause', handlePause);
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('durationchange', handleDurationChange);
            audio.removeEventListener('ended', handleEnded);
            audio.src = '';
            audioRef.current = null;
        };
    }, []);

    useEffect(() => {
        if (!audioRef.current) return;
        if (volumeMode === 'app') {
            audioRef.current.volume = Math.max(0, Math.min(1, appVolume));
        } else {
            audioRef.current.volume = 1;
        }
    }, [volumeMode, appVolume]);

    // Pause playback when volume reaches 0 or is muted (if enabled)
    useEffect(() => {
        if (!pauseIfMuted || !isPlaying) return;
        const isZero = volumeMode === 'app'
            ? appVolume <= 0
            : (systemMuted || systemVolume <= 0);
        if (isZero && audioRef.current) {
            autoPausedBySilenceRef.current = true;
            audioRef.current.pause();
            setIsPlaying(false);
        }
    }, [pauseIfMuted, volumeMode, appVolume, systemVolume, systemMuted, isPlaying]);

    // Resume only when the previous pause was caused by mute/volume 0.
    useEffect(() => {
        if (!pauseIfMuted || !autoPausedBySilenceRef.current) return;

        const audio = audioRef.current;
        if (!audio || !audio.src || !audio.paused) return;

        const stillSilent = volumeMode === 'app'
            ? appVolume <= 0
            : (systemMuted || systemVolume <= 0);
        if (stillSilent) return;

        autoPausedBySilenceRef.current = false;
        audio.play().catch((e) => {
            autoPausedBySilenceRef.current = true;
            console.error('Gagal auto resume:', e);
        });
    }, [pauseIfMuted, volumeMode, appVolume, systemVolume, systemMuted]);

    useEffect(() => {
        if (!pauseIfMuted) {
            autoPausedBySilenceRef.current = false;
        }
    }, [pauseIfMuted]);

    // Sinkronkan state repeat === 'one' langsung ke elemen audio agar realtime
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.loop = repeat === 'one';
        }
    }, [repeat]);

    const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const parsed = parseFloat(e.target.value);
        if (!Number.isFinite(parsed)) return;
        const v = Math.max(0, Math.min(1, parsed));
        if (volumeModeRef.current === 'app') {
            setAppVolume(v);
            if (audioRef.current) {
                audioRef.current.volume = Math.max(0, Math.min(1, v));
            }
        } else {
            const limit = volumeLimit;
            const targetPct = Math.round(v * 100);

            // Block setting volume higher than the allowed volume limit
            if (limit > 0 && targetPct > limit) {
                return;
            }

            setSystemVolume(v);
            setSystemMuted(targetPct === 0);
            lastLocalVolumeSetRef.current = Date.now();
            if (isBrowserTauri) {
                getTauri().then(async m => {
                    await m.invoke('set_system_volume', {value: targetPct});
                    if (targetPct > 0) {
                        await m.invoke('set_system_mute', {mute: false});
                        setSystemMuted(false);
                    }
                }).catch(() => {});
            }
        }
    }, [volumeLimit, setAppVolume, setSystemVolume, setSystemMuted, lastLocalVolumeSetRef]);

    const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const t = parseFloat(e.target.value);
        setCurrentTime(t);
        if (audioRef.current) {
            audioRef.current.currentTime = t;
        }
    }, []);

    const toggleSystemMute = useCallback(() => {
        if (!isBrowserTauri) return;
        const shouldMute = !systemMuted;
        setSystemMuted(shouldMute);
        lastLocalVolumeSetRef.current = Date.now();
        getTauri().then(m => {
            m.invoke('set_system_mute', {mute: shouldMute});
        }).catch(() => {});
    }, [systemMuted, setSystemMuted, lastLocalVolumeSetRef]);

    const goUp = useCallback(() => {
        if (!currentPath || !musicFolder) return;
        const parent = currentPath.replace(/\\/g, '/').split('/').slice(0, -1).join('\\');
        if (parent.length >= musicFolder.length) {
            setCurrentPath(parent);
        }
    }, [currentPath, musicFolder]);

    return {
        files,
        loadingFiles,
        currentPath,
        setCurrentPath,
        selectedSong,
        setSelectedSong,
        metadata,
        setMetadata,
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
        toggleSystemMute,
        goUp,
    };
}
