'use client';

import {useCallback, useEffect, useRef, useState} from 'react';
import HomeAlerts from './components/home/HomeAlerts';
import HomeHeader from './components/home/HomeHeader';
import HomeModals from './components/home/HomeModals';
import HomePlayerArea from './components/home/HomePlayerArea';
import {t} from './lib/translations';
import {useAppLogging} from './hooks/useAppLogging';
import {useAppUpdater} from './hooks/useAppUpdater';
import {useAudioPlayer} from './hooks/useAudioPlayer';
import {useKeyboardShortcuts} from './hooks/useKeyboardShortcuts';
import {usePlayerSettings} from './hooks/usePlayerSettings';
import {getTauri, isBrowserTauri} from './lib/homeState';

export default function Home() {
    const {
        debugError,
        setDebugError,
        logs,
        toastVisible,
        setToastVisible,
        addLog,
        showError,
    } = useAppLogging();

    const [windowWidth, setWindowWidth] = useState<number>(typeof window !== 'undefined' ? window.innerWidth : 1200);
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

    const SIDEBAR_BREAKPOINT = 900;
    const isCompact = windowWidth < SIDEBAR_BREAKPOINT;

    const settings = usePlayerSettings();
    const lang = settings.language;

    const player = useAudioPlayer({
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
        autoUpdateShown,
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
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const doPickFolder = useCallback(async () => {
        try {
            const mod = await getTauri();
            const result = await mod.invoke<string | null>('pick_folder');
            if (result) {
                settings.setMusicFolder(result);
                player.setCurrentPath(result);
                player.setSelectedSong(null);
                player.setMetadata(null);
            }
        } catch (e) {
            const msg = String(e);
            console.error('pick_folder error:', e);
            setDebugError(`${t(lang, 'alert.error')}: ${msg}`);
            showError(`${t(lang, 'alert.error')}: ${msg}`);
        }
    }, [lang, settings, player, setDebugError, showError]);

    const handlePickFolder = useCallback(async () => {
        if (!isBrowserTauri) {
            setDebugError(t(lang, 'alert.error'));
            showError(t(lang, 'alert.error'));
            return;
        }
        if (player.isPlaying) {
            setPendingFolderChange(true);
            return;
        }
        await doPickFolder();
    }, [lang, player.isPlaying, doPickFolder, setDebugError, showError]);

    const handlePickWallpaper = useCallback(async () => {
        if (!isBrowserTauri) {
            setDebugError(t(lang, 'alert.error'));
            showError(t(lang, 'alert.error'));
            return;
        }
        try {
            const mod = await getTauri();
            const result = await mod.invoke<string | null>('pick_wallpaper');
            if (result) {
                settings.setDefaultWallpaper(result);
            }
        } catch (e) {
            const msg = String(e);
            console.error('pick_wallpaper error:', e);
            setDebugError(`${t(lang, 'alert.error')}: ${msg}`);
            showError(`${t(lang, 'alert.error')}: ${msg}`);
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

    const displayPath = player.currentPath || '';

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
                onToggleLeftSidebar={() => setShowLeftSidebar(v => !v)}
                onToggleRightSidebar={() => setShowRightSidebar(v => !v)}
            />

            <HomePlayerArea
                lang={lang}
                initialized={settings.initialized}
                musicFolder={settings.musicFolder}
                isCompact={isCompact}
                showLeftSidebar={showLeftSidebar}
                showRightSidebar={showRightSidebar}
                files={player.files}
                loadingFiles={player.loadingFiles}
                selectedSong={player.selectedSong}
                metadata={player.metadata}
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
                setVolumeMode={(v: string) => settings.setVolumeModeState(v as 'app' | 'system')}
                volumeLimit={settings.volumeLimit}
                setVolumeLimit={settings.handleVolumeLimitSetting}
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
                volumeLimitExceeded={settings.volumeLimitExceeded}
                volumeLimit={settings.volumeLimit}
                onCloseToast={() => setToastVisible(false)}
                onCloseVolumeAlert={() => settings.setVolumeLimitExceeded(false)}
                updateAlertInfo={autoUpdateInfo}
                updateAlertDownloading={autoUpdateDownloading}
                updateAlertProgress={autoUpdateProgress}
                updateAlertTotal={autoUpdateTotal}
                onUpdate={startAutoUpdateDownload}
                onRemindLater={dismissAutoUpdate}
                onStayCurrent={skipAutoUpdateVersion}
            />
        </div>
    );
}
