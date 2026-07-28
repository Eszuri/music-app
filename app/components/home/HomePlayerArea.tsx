'use client';

import {AnimatePresence, motion} from 'framer-motion';
import type {ChangeEvent} from 'react';
import FolderExplorer, {FileEntry} from '../FolderExplorer';
import PlayerPanel, {SongMetadata} from '../PlayerPanel';
import SeekBar from '../SeekBar';
import PlaybackControls from '../PlaybackControls';
import VolumeControl from '../VolumeControl';
import MetadataPanel from '../MetadataPanel';
import {EmptyFolderState, InitSkeleton, NoFolderEmptyState} from './HomeEmptyStates';

interface HomePlayerAreaProps {
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
}

export default function HomePlayerArea({
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
}: HomePlayerAreaProps) {
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
                        <NoFolderEmptyState onPickFolder={handlePickFolder} accentColor={accentColor} />
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
                        <AnimatePresence>
                            {(showLeftSidebar || !isCompact) && (
                                <motion.aside
                                    initial={isCompact ? {width: 0, opacity: 0} : false}
                                    animate={{width: 'auto', opacity: 1}}
                                    exit={{width: 0, opacity: 0}}
                                    transition={{duration: 0.2}}
                                    className="flex shrink-0 overflow-hidden"
                                >
                                    <FolderExplorer
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
                                    />
                                </motion.aside>
                            )}
                        </AnimatePresence>

                        <main className="flex-1 flex items-center justify-center p-6 overflow-hidden">
                            {files.length === 0 ? (
                                <EmptyFolderState folder={displayPath} />
                            ) : (
                                <div className="flex flex-col items-center gap-4 w-full max-w-2xl">
                                    <PlayerPanel
                                        metadata={metadata}
                                        selectedSong={selectedSong}
                                        accentColor={accentColor}
                                    />
                                    <SeekBar
                                        currentTime={currentTime}
                                        duration={duration}
                                        handleSeek={handleSeek}
                                        accentColor={accentColor}
                                    />
                                    <PlaybackControls
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

                        <AnimatePresence>
                            {(showRightSidebar || !isCompact) && (
                                <motion.aside
                                    initial={isCompact ? {width: 0, opacity: 0} : false}
                                    animate={{width: 'auto', opacity: 1}}
                                    exit={{width: 0, opacity: 0}}
                                    transition={{duration: 0.2}}
                                    className="flex shrink-0 overflow-hidden"
                                >
                                    <MetadataPanel
                                        selectedSong={selectedSong}
                                        metadata={metadata}
                                        accentColor={accentColor}
                                        resetSidebarToken={resetSidebarToken}
                                    />
                                </motion.aside>
                            )}
                        </AnimatePresence>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
