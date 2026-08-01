'use client';

import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileEntry } from './FolderExplorer';
import { getAccent } from '../lib/colors';
import {t, type Lang} from '../lib/translations';
import { contentMotion } from '../lib/animations';
import { PlayerPanelSkeleton } from './Skeleton';

export interface SongMetadata {
    title: string | null;
    artist: string | null;
    album: string | null;
    duration: number | null;
    cover_b64: string | null;
    cover_mime: string | null;
    genre: string | null;
    year: number | null;
    track_number: number | null;
    total_tracks: number | null;
    disc_number: number | null;
    total_discs: number | null;
    comment: string | null;
    bitrate: number | null;
    sample_rate: number | null;
    channels: number | null;
}

interface PlayerPanelProps {
    lang: Lang;
    metadata: SongMetadata | null;
    selectedSong: FileEntry | null;
    accentColor: string;
    coverDataUrl: string | null;
    onContextMenu?: (e: React.MouseEvent) => void;
    hideCover?: boolean;
}

function PlayerPanel({ lang, metadata, selectedSong, accentColor, coverDataUrl, onContextMenu, hideCover }: PlayerPanelProps) {
    const accent = getAccent(accentColor);
    const songTitle = selectedSong
        ? (metadata?.title || selectedSong.name.replace(/\.[^/.]+$/, ''))
        : t(lang, 'player.noSongSelected');
    const songArtist = selectedSong ? (metadata?.artist || t(lang, 'player.unknownArtist')) : '';
    const songAlbum = selectedSong ? (metadata?.album || null) : null;

    return (
        <div className="w-full flex flex-col items-center gap-2 sm:gap-3.5">
            {!hideCover && (
                <motion.div
                    key={selectedSong?.path || 'no-song'}
                    {...contentMotion}
                onContextMenu={onContextMenu}
                className="w-full max-w-[360px] sm:max-w-[420px] md:max-w-[460px] max-h-[45vh] rounded-2xl overflow-hidden bg-zinc-900/80 flex items-center justify-center ring-1 ring-white/5 cursor-pointer relative shrink"
                style={{
                    boxShadow: selectedSong
                        ? `0 20px 60px -10px ${accent.hex500}15, 0 10px 30px -5px rgba(0,0,0,0.5)`
                        : '0 10px 30px -5px rgba(0,0,0,0.5)',
                }}
            >
                <AnimatePresence mode="wait">
                    {metadata?.cover_b64 ? (
                        <motion.img
                            key={selectedSong?.path}
                            {...contentMotion}
                            src={coverDataUrl ?? ''}
                            alt={t(lang, 'player.cover')}
                            className="max-h-[45vh] max-w-full w-auto h-auto object-contain rounded-2xl"
                        />
                    ) : (
                        <motion.div
                            key="placeholder"
                            {...contentMotion}
                            animate={{ opacity: 0.15, y: 0 }}
                            className="w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 max-h-[45vh] aspect-square flex items-center justify-center"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
                                <path d="M9 18V5l12-2v13" />
                                <circle cx="6" cy="18" r="3" />
                                <circle cx="18" cy="16" r="3" />
                            </svg>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
            )}

            <div className="text-center w-full px-3 sm:px-4">
                <h2 className="text-xl font-semibold text-zinc-100 truncate">{songTitle}</h2>
                {selectedSong && (
                    <>
                        <p className={`text-sm mt-1.5 truncate ${accent.text400} opacity-80`}>{songArtist}</p>
                        {songAlbum && (
                            <p className="text-xs text-white/70 mt-0.5 truncate">{songAlbum}</p>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
export default memo(PlayerPanel);
