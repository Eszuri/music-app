import { useCallback, useEffect, useRef, useState } from "react";
import type { FileEntry } from "../components/FolderExplorer";
import type { SongMetadata } from "../components/PlayerPanel";
import {
  getTauri,
  isBrowserTauri,
  loadSessionState,
  saveSessionState,
  type SessionState,
} from "../lib/homeState";

interface UseAudioPlayerOptions {
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
  const [filesLoadedOnce, setFilesLoadedOnce] = useState(false);
  const [sessionRestored, setSessionRestored] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [selectedSong, setSelectedSong] = useState<FileEntry | null>(null);
  const [metadata, setMetadata] = useState<SongMetadata | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Stable cover art data URL — recomputed only when cover changes, not every render
  const coverDataUrl = metadata?.cover_b64 && metadata?.cover_mime
    ? `data:${metadata.cover_mime};base64,${metadata.cover_b64}`
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
  // Tracks whether the currently loaded (but not yet played) track came from session restore.
  // When true, wallpaper is deferred until the user actually hits play.
  const restoredPendingPlayRef = useRef(false);
  // Ensures session restore only fires once per mount, not on every re-sort
  const sessionRestoreAttemptedRef = useRef(false);

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

  const activeVolume = volumeMode === "system" ? systemVolume : appVolume;

  // ─── helpers ───────────────────────────────────────────────────────────────

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
      await mod.invoke("set_system_volume", { value: targetPct });
      await mod.invoke("set_system_mute", { mute: false });
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

  /** Apply wallpaper from current metadata. No-op if autoWallpaper is off. */
  const applyWallpaper = useCallback(
    async (meta: SongMetadata) => {
      if (!isBrowserTauri || !autoWallpaperRef.current) return;
      try {
        const mod = await getTauri();
        if (meta.cover_b64) {
          await mod.invoke("set_wallpaper", { coverB64: meta.cover_b64 });
        } else {
          await mod.invoke("clear_wallpaper");
        }
      } catch (e) {
        showError(`Wallpaper error: ${String(e)}`);
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
          folderSort: folderSortRef.current,
          fileSort: fileSortRef.current,
          sortDir: sortDirRef.current,
          nameSource: nameSourceRef.current,
          formats: formatsRef.current,
        });
        if (token !== loadFilesTokenRef.current || !isMountedRef.current)
          return;
        setFiles(result);
      } catch (e) {
        if (token !== loadFilesTokenRef.current || !isMountedRef.current)
          return;
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

  // ─── metadata ──────────────────────────────────────────────────────────────

  /**
   * Fetch metadata for a file and update state.
   * skipWallpaper=true is used during session restore so wallpaper is only
   * applied when the user actually starts playback.
   */
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
        if (!skipWallpaper) await applyWallpaper(result);
      } catch {
        if (token !== playTokenRef.current || !isMountedRef.current) return;
        setMetadata(null);
      }
    },
    [applyWallpaper],
  );

  // ─── path / folder effects ─────────────────────────────────────────────────

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

  // Re-sort whenever sort settings change (does NOT reset the restore-once guard)
  useEffect(() => {
    if (currentPath) loadFiles(currentPath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderSort, fileSort, sortDir, nameSource, formats]);

  // ─── session restore ───────────────────────────────────────────────────────

  /**
   * Called once after the file list is first populated.
   * If the saved file is in a sub-folder, we navigate there first then restore.
   * Loads audio src + seeks but does NOT play and does NOT set the wallpaper.
   */
  useEffect(() => {
    // Only attempt restore once per mount and only when files have loaded
    if (!filesLoadedOnce) return;
    if (sessionRestoreAttemptedRef.current) return;
    sessionRestoreAttemptedRef.current = true;

    const done = () => {
      if (isMountedRef.current) setSessionRestored(true);
    };

    const session = loadSessionState();
    if (!session || !files.length) {
      done();
      return;
    }

    // Derive the parent folder of the saved file (handles both / and \)
    const savedParent = session.filePath.replace(/[/\\][^/\\]+$/, "");

    // If the saved file lives in a different folder than what's loaded,
    // navigate to that folder. The next files update will trigger restore again —
    // but the guard is already set, so we explicitly do it in the navigation branch.
    if (savedParent !== currentPath) {
      // Navigate to the file's folder; when loadFiles completes, we do the restore inline
      const doNavAndRestore = async () => {
        try {
          // Update path — this will trigger loadFiles via the currentPath effect
          // We need to wait for files, so we do it manually here instead
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
          // Now restore using this fresh list
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

    // The saved file is already in the current folder listing
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
        let src: string;
        if (isBrowserTauri) {
          const mod = await getTauri();
          src = mod.convertFileSrc(savedFile.path);
        } else {
          src = savedFile.path;
        }

        audio.src = src;
        audio.volume = volumeModeRef.current === "app" ? appVolume : 1;
        audio.loop = repeatRef.current === "one";

        // Seek once enough data is buffered
        const onCanPlay = () => {
          audio.currentTime = sess.currentTime;
          audio.removeEventListener("canplay", onCanPlay);
        };
        audio.addEventListener("canplay", onCanPlay);
        audio.load();

        setSelectedSong(savedFile);
        setCurrentTime(sess.currentTime);
        playlistRef.current = fileList.filter((f) => !f.is_dir);
        restoredPendingPlayRef.current = true;

        // Fetch fresh metadata — skip wallpaper until user hits play
        await loadMetadata(savedFile.path, true);

        const mins = Math.floor(sess.currentTime / 60);
        const secs = Math.floor(sess.currentTime % 60)
          .toString()
          .padStart(2, "0");
        addLog(
          "info",
          `Sesi dipulihkan: ${savedFile.name} pada ${mins}:${secs}`,
        );
      } catch {
        saveSessionState(null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, filesLoadedOnce]);

  // ─── playback ──────────────────────────────────────────────────────────────

  const playSong = useCallback(
    async (file: FileEntry) => {
      if (file.is_dir) return;

      const audio = audioRef.current;
      if (!audio) return;

      playlistRef.current = filesRef.current.filter((f) => !f.is_dir);

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
        audio.volume =
          volumeModeRef.current === "app" ? (resumeVolume ?? appVolume) : 1;
        audio.loop = repeatRef.current === "one";
        await audio.play();
        autoPausedBySilenceRef.current = false;
        restoredPendingPlayRef.current = false;

        if (token !== playTokenRef.current || !isMountedRef.current) return;

        setSelectedSong(file);
        // Full metadata load including wallpaper
        loadMetadata(file.path, false);
        addLog("info", `Memutar: ${file.name}`);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        showError(`Gagal memutar: ${(e as Error).message || String(e)}`);
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
    ],
  );

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

        // If this is the first play after a session restore, apply wallpaper now
        if (restoredPendingPlayRef.current) {
          restoredPendingPlayRef.current = false;
          const meta = metadataRef.current;
          if (meta) await applyWallpaper(meta);
        }
      };
      resume().catch((e) => console.error("Gagal play:", e));
    } else {
      autoPausedBySilenceRef.current = false;
      audio.pause();
    }
  }, [pauseIfMuted, isVolumeSilent, setMinimumResumeVolume, applyWallpaper]);

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
        .then((mod) => mod.invoke("clear_wallpaper"))
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

  // Stable refs so keyboard shortcuts always call the latest version
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

  // ─── audio element lifecycle ───────────────────────────────────────────────

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;
    audio.volume = volumeModeRef.current === "app" ? appVolume : 1;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    // Event-driven session save: fires on every timeupdate (no interval)
    const handleTimeUpdate = () => {
      const t = audio.currentTime;
      setCurrentTime(t);
      const song = selectedSongRef.current;
      if (song && t > 0) {
        const now = Date.now();
        if (now - lastSessionSaveRef.current >= 1000) {
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
      // Song finished naturally — clear session so next startup starts fresh
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save session on window close / page hide (belt-and-suspenders for Tauri)
  useEffect(() => {
    const flush = () => {
      if ((window as any).__symvoniaResetInProgress) return;
      const song = selectedSongRef.current;
      const audio = audioRef.current;
      if (song && audio && audio.currentTime > 0) {
        saveSessionState({
          filePath: song.path,
          currentTime: audio.currentTime,
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

  // ─── volume / mute sync ────────────────────────────────────────────────────

  useEffect(() => {
    if (!audioRef.current) return;
    if (volumeMode === "app") {
      audioRef.current.volume = Math.max(0, Math.min(1, appVolume));
    } else {
      audioRef.current.volume = 1;
    }
  }, [volumeMode, appVolume]);

  // Auto-pause when volume hits 0 / muted
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

  // Auto-resume when volume comes back after silence pause
  useEffect(() => {
    if (!pauseIfMuted || !autoPausedBySilenceRef.current) return;
    const audio = audioRef.current;
    if (!audio || !audio.src || !audio.paused) return;
    const stillSilent =
      volumeMode === "app" ? appVolume <= 0 : systemMuted || systemVolume <= 0;
    if (stillSilent) return;
    autoPausedBySilenceRef.current = false;
    audio.play().catch((e) => {
      autoPausedBySilenceRef.current = true;
      console.error("Gagal auto resume:", e);
    });
  }, [pauseIfMuted, volumeMode, appVolume, systemVolume, systemMuted]);

  useEffect(() => {
    if (!pauseIfMuted) autoPausedBySilenceRef.current = false;
  }, [pauseIfMuted]);

  // Sync repeat='one' directly to the audio element
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
              await m.invoke("set_system_volume", { value: targetPct });
              if (targetPct > 0) {
                await m.invoke("set_system_mute", { mute: false });
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

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const t = parseFloat(e.target.value);
    setCurrentTime(t);
    if (audioRef.current) audioRef.current.currentTime = t;
  }, []);

  const toggleSystemMute = useCallback(() => {
    if (!isBrowserTauri) return;
    const shouldMute = !systemMuted;
    setSystemMuted(shouldMute);
    lastLocalVolumeSetRef.current = Date.now();
    getTauri()
      .then((m) => m.invoke("set_system_mute", { mute: shouldMute }))
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
    toggleSystemMute,
    goUp,
  };
}
