'use client';

import {AnimatePresence, motion} from 'framer-motion';
import {useCallback, useState, type ChangeEvent} from 'react';
import FolderExplorer, {FileEntry} from '../FolderExplorer';
import PlayerPanel, {SongMetadata} from '../PlayerPanel';
import SeekBar from '../SeekBar';
import PlaybackControls from '../PlaybackControls';
import VolumeControl from '../VolumeControl';
import MetadataPanel from '../MetadataPanel';
import {EmptyFolderState, InitSkeleton, NoFolderEmptyState} from './HomeEmptyStates';
import ContextMenu, {type ContextMenuItem} from '../ContextMenu';
import {getTauri} from '../../lib/homeState';
import {t, type Lang} from '../../lib/translations';

interface HomePlayerAreaProps {
    lang: Lang;
    initialized: boolean;
    musicFolder: string | null;
    isCompact: boolean;
    showLeftSidebar: boolean;
    showRightSidebar: boolean;
    files: FileEntry[];
    loadingFiles: boolean;
    selectedSong: FileEntry | null;
    metadata: SongMetadata | null;
    displayPath: string;
    debugError: string;
    currentTime: number;
    duration: number;
    isPlaying: boolean;
    shuffle: boolean;
    repeat: 'off' | 'all' | 'one';
    volume: number;
    volumeStep: number;
    volumeMode: 'app' | 'system';
    systemVolumeSynced: boolean;
    systemMuted: boolean;
    volumeLimit: number;
    resetSidebarToken: number;
    accentColor: string;
    handlePickFolder: () => void;
    goUp: () => void;
    setCurrentPath: (path: string) => void;
    playSong: (file: FileEntry) => void;
    handleSeek: (e: ChangeEvent<HTMLInputElement>) => void;
    playPrev: () => void;
    togglePlayPause: () => void;
    playNext: () => void;
    setShuffle: (v: boolean) => void;
    setRepeat: (v: 'off' | 'all' | 'one') => void;
    handleVolumeChange: (e: ChangeEvent<HTMLInputElement>) => void;
    onGlobalContextMenu: (e: React.MouseEvent) => void;
}

async function openDevTools() {
    try {
        const mod = await getTauri();
        await mod.invoke('open_devtools');
    } catch {
        // not in Tauri
    }
}

function appendDevTools(items: ContextMenuItem[], lang: Lang): ContextMenuItem[] {
    return [
        ...(items.length > 0 ? [{separator: true} as ContextMenuItem] : []),
        {
            label: t(lang, 'contextMenu.openDevTools'),
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="16 18 22 12 16 6" />
                    <polyline points="8 6 2 12 8 18" />
                </svg>
            ),
            onClick: openDevTools,
        },
    ];
}

export default function HomePlayerArea({
    lang,
    initialized,
    musicFolder,
    isCompact,
    showLeftSidebar,
    showRightSidebar,
    files,
    loadingFiles,
    selectedSong,
    metadata,
    displayPath,
    debugError,
    currentTime,
    duration,
    isPlaying,
    shuffle,
    repeat,
    volume,
    volumeStep,
    volumeMode,
    systemVolumeSynced,
    systemMuted,
    volumeLimit,
    resetSidebarToken,
    accentColor,
    handlePickFolder,
    goUp,
    setCurrentPath,
    playSong,
    handleSeek,
    playPrev,
    togglePlayPause,
    playNext,
    setShuffle,
    setRepeat,
    handleVolumeChange,
    onGlobalContextMenu,
}: HomePlayerAreaProps) {
    const leftVisible = showLeftSidebar || !isCompact;
    const rightVisible = showRightSidebar || !isCompact;

    const mainWidthClass = !leftVisible && !rightVisible
        ? 'max-lg:flex-1'
        : leftVisible !== rightVisible
            ? 'max-lg:w-1/2 max-lg:flex-none max-lg:min-w-0'
            : 'max-lg:w-[320px] max-lg:flex-none max-lg:min-w-0';

    const [contextMenu, setContextMenu] = useState<{x: number; y: number; items: ContextMenuItem[]} | null>(null);
    const hideContextMenu = useCallback(() => setContextMenu(null), []);

    // Album/cover art context menu
    const showAlbumMenu = useCallback((e: React.MouseEvent) => {
        if (!metadata?.cover_b64) return;
        e.preventDefault();
        e.stopPropagation();
        const items: ContextMenuItem[] = [
            {
                label: t(lang, 'contextMenu.saveImage'),
                icon: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
                onClick: async () => {
                    try {
                        const mod = await getTauri();
                        await mod.invoke('save_cover_image', {coverB64: metadata.cover_b64, mime: metadata.cover_mime});
                    } catch {
                        // not in Tauri
                    }
                },
            },
        ];
        setContextMenu({x: e.clientX, y: e.clientY, items: [...items, ...appendDevTools(items, lang)]});
    }, [lang, metadata]);

    // Folder context menu
    const showFolderMenu = useCallback((e: React.MouseEvent, file: FileEntry) => {
        if (!file.is_dir) return;
        e.preventDefault();
        e.stopPropagation();
        const items: ContextMenuItem[] = [
            {
                label: t(lang, 'contextMenu.openFolder'),
                icon: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>,
                onClick: () => setCurrentPath(file.path),
            },
        ];
        setContextMenu({x: e.clientX, y: e.clientY, items: [...items, ...appendDevTools(items, lang)]});
    }, [lang, setCurrentPath]);

    // Audio file context menu
    const showFileMenu = useCallback((e: React.MouseEvent, file: FileEntry) => {
        if (file.is_dir) return;
        e.preventDefault();
        e.stopPropagation();
        const isCurrentSong = selectedSong?.path === file.path;
        const items: ContextMenuItem[] = [
            {
                label: t(lang, 'contextMenu.playSong'),
                icon: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>,
                onClick: () => playSong(file),
                disabled: isCurrentSong && isPlaying,
            },
            {
                label: t(lang, 'contextMenu.copyPath'),
                icon: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
                onClick: () => {
                    try {
                        navigator.clipboard.writeText(file.path);
                    } catch {
                        // clipboard not available
                    }
                },
            },
        ];
        setContextMenu({x: e.clientX, y: e.clientY, items: [...items, ...appendDevTools(items, lang)]});
    }, [lang, selectedSong, isPlaying, playSong]);

    return (
        <div className="flex flex-1 overflow-hidden">
            <AnimatePresence mode="wait">
                {!initialized ? (
                    <motion.div
                        key="init-skeleton"
                        initial={{opacity: 0}}
                        animate={{opacity: 1}}
                        exit={{opacity: 0}}
                        transition={{duration: 0.15}}
                        className="flex-1"
                    >
                        <InitSkeleton />
                    </motion.div>
                ) : !musicFolder ? (
                    <motion.div
                        key="no-folder"
                        initial={{opacity: 0, y: 8}}
                        animate={{opacity: 1, y: 0}}
                        exit={{opacity: 0, y: -8}}
                        transition={{duration: 0.25}}
                        className="flex-1"
                    >
                        <NoFolderEmptyState lang={lang} onPickFolder={handlePickFolder} accentColor={accentColor} />
                    </motion.div>
                ) : (
                    <motion.div
                        key="player-area"
                        initial={{opacity: 0, y: 8}}
                        animate={{opacity: 1, y: 0}}
                        exit={{opacity: 0, y: -8}}
                        transition={{duration: 0.25}}
                        className="flex flex-1 overflow-hidden"
                    >
                        {/* Left sidebar — global context menu on empty areas */}
                        <AnimatePresence>
                            {(showLeftSidebar || !isCompact) && (
                                <motion.aside
                                    initial={isCompact ? {width: 0, opacity: 0} : false}
                                    animate={{width: 'auto', opacity: 1}}
                                    exit={{width: 0, opacity: 0}}
                                    transition={{duration: 0.2}}
                                    className="flex shrink-0 overflow-hidden max-lg:flex-1 max-lg:min-w-0"
                                >
                                    <FolderExplorer
                                        lang={lang}
                                        files={files}
                                        loading={loadingFiles}
                                        selectedSong={selectedSong}
                                        playingAncestorPrefix={selectedSong?.path ?? null}
                                        displayPath={displayPath}
                                        debugError={debugError}
                                        goUp={goUp}
                                        setCurrentPath={setCurrentPath}
                                        playSong={playSong}
                                        onChangeFolder={handlePickFolder}
                                        musicFolder={musicFolder}
                                        resetSidebarToken={resetSidebarToken}
                                        accentColor={accentColor}
                                        onContextDir={showFolderMenu}
                                        onContextFile={showFileMenu}
                                        onGlobalContextMenu={onGlobalContextMenu}
                                    />
                                </motion.aside>
                            )}
                        </AnimatePresence>

                        {/* Main player area — global context menu */}
                        <main
                            onContextMenu={onGlobalContextMenu}
                            className={`flex flex-col items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto overflow-x-hidden ${mainWidthClass} flex-1 min-w-0 h-full`}
                        >
                            {files.length === 0 ? (
                                <EmptyFolderState lang={lang} folder={displayPath} />
                            ) : (
                                <div className="flex flex-col items-center justify-center gap-2.5 sm:gap-4 w-full max-w-2xl min-w-0 my-auto py-1">
                                    <PlayerPanel
                                        lang={lang}
                                        metadata={metadata}
                                        selectedSong={selectedSong}
                                        accentColor={accentColor}
                                        onContextMenu={showAlbumMenu}
                                    />
                                    <SeekBar
                                        lang={lang}
                                        currentTime={currentTime}
                                        duration={duration}
                                        handleSeek={handleSeek}
                                        accentColor={accentColor}
                                    />
                                    <PlaybackControls
                                        lang={lang}
                                        selectedSong={selectedSong}
                                        isPlaying={isPlaying}
                                        shuffle={shuffle}
                                        repeat={repeat}
                                        playPrev={playPrev}
                                        togglePlayPause={togglePlayPause}
                                        playNext={playNext}
                                        setShuffle={setShuffle}
                                        setRepeat={setRepeat}
                                        accentColor={accentColor}
                                    />
                                    <VolumeControl
                                        lang={lang}
                                        volume={volume}
                                        volumeStep={volumeStep}
                                        volumeMode={volumeMode}
                                        systemVolumeSynced={systemVolumeSynced}
                                        systemMuted={systemMuted}
                                        volumeLimit={volumeLimit}
                                        handleVolumeChange={handleVolumeChange}
                                        accentColor={accentColor}
                                    />
                                </div>
                            )}
                        </main>

                        {/* Right sidebar — global context menu on empty areas */}
                        <AnimatePresence>
                            {(showRightSidebar || !isCompact) && (
                                <motion.aside
                                    onContextMenu={onGlobalContextMenu}
                                    initial={isCompact ? {width: 0, opacity: 0} : false}
                                    animate={{width: 'auto', opacity: 1}}
                                    exit={{width: 0, opacity: 0}}
                                    transition={{duration: 0.2}}
                                    className="flex shrink-0 overflow-hidden max-lg:flex-1 max-lg:min-w-0"
                                >
                                    <MetadataPanel
                                        lang={lang}
                                        selectedSong={selectedSong}
                                        metadata={metadata}
                                        accentColor={accentColor}
                                        resetSidebarToken={resetSidebarToken}
                                        onContextMenu={showAlbumMenu}
                                    />
                                </motion.aside>
                            )}
                        </AnimatePresence>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Local context menus for specific elements (album, folder, file) */}
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    items={contextMenu.items}
                    onClose={hideContextMenu}
                />
            )}
        </div>
    );
}
