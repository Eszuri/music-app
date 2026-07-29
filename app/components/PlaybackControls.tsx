'use client';

import { motion } from 'framer-motion';
import { FileEntry } from './FolderExplorer';
import { getAccent } from '../lib/colors';
import {t, type Lang} from '../lib/translations';
import {useHoverDescription} from '../hooks/useHoverDescription';

interface PlaybackControlsProps {
    lang: Lang;
    selectedSong: FileEntry | null;
    isPlaying: boolean;
    shuffle: boolean;
    repeat: 'off' | 'all' | 'one';
    playPrev: () => void;
    togglePlayPause: () => void;
    playNext: () => void;
    setShuffle: (v: boolean) => void;
    setRepeat: (v: 'off' | 'all' | 'one') => void;
    accentColor: string;
}

function ShuffleIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 3 21 3 21 8" />
            <line x1="4" y1="20" x2="21" y2="3" />
            <polyline points="21 16 21 21 16 21" />
            <line x1="15" y1="15" x2="21" y2="21" />
            <line x1="4" y1="4" x2="9" y2="9" />
        </svg>
    );
}

function RepeatIcon({ mode }: { mode: 'off' | 'all' | 'one' }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m17 2 4 4-4 4" />
            <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
            <path d="m7 22-4-4 4-4" />
            <path d="M21 13v1a4 4 0 0 1-4 4H3" />
            {mode === 'one' && (
                <text x="12" y="14.5" textAnchor="middle" fontSize="7.5" fill="currentColor" stroke="none" fontWeight="bold">1</text>
            )}
        </svg>
    );
}

export default function PlaybackControls({
    lang,
    selectedSong,
    isPlaying,
    shuffle,
    repeat,
    playPrev,
    togglePlayPause,
    playNext,
    setShuffle,
    setRepeat,
    accentColor,
}: PlaybackControlsProps) {
    const accent = getAccent(accentColor);
    const hasSong = !!selectedSong;

    const cycleRepeat = () => {
        if (repeat === 'off') setRepeat('all');
        else if (repeat === 'all') setRepeat('one');
        else setRepeat('off');
    };

    // ─── Shuffle button styles ────────────────────────────────────────────────
    // OFF: muted zinc, no background
    // ON:  accent color text + tinted background + bottom dot indicator
    const shuffleClass = shuffle
        ? `${accent.text400} ${accent.bg15} border ${accent.border500_20}`
        : 'text-white/70 hover:text-white border border-transparent hover:border-white/20 hover:bg-white/10';

    // ─── Repeat button styles ─────────────────────────────────────────────────
    // OFF:  muted zinc, no background
    // ALL:  accent color text + tinted background + border
    // ONE:  stronger accent background (bg30) + accent border — visually more intense
    const repeatClass =
        repeat === 'off'
            ? 'text-white/70 hover:text-white border border-transparent hover:border-white/20 hover:bg-white/10'
            : repeat === 'all'
                ? `${accent.text400} ${accent.bg15} border ${accent.border500_20}`
                : `${accent.text400} ${accent.bg30} border ${accent.border500_20}`;

    const repeatTitle =
        repeat === 'off'
            ? t(lang, 'playback.repeatOff')
            : repeat === 'all'
                ? t(lang, 'playback.repeatAll')
                : t(lang, 'playback.repeatOne');

    const shuffleHover = useHoverDescription(hasSong ? t(lang, shuffle ? 'status.shuffleOff' : 'status.shuffleOn') : null);
    const prevHover = useHoverDescription(hasSong ? t(lang, 'status.prev') : null);
    const playPauseHover = useHoverDescription(hasSong ? t(lang, isPlaying ? 'status.pause' : 'status.play') : null);
    const nextHover = useHoverDescription(hasSong ? t(lang, 'status.next') : null);
    const repeatHover = useHoverDescription(hasSong ? t(lang, repeat === 'off' ? 'status.repeatAll' : repeat === 'all' ? 'status.repeatOne' : 'status.repeatOff') : null);

    return (
        <div className="flex items-center gap-2 sm:gap-3 md:gap-4">

            {/* ── Shuffle ─────────────────────────────────────────── */}
            <motion.button
                {...shuffleHover}
                onClick={() => setShuffle(!shuffle)}
                disabled={!hasSong}
                whileHover={hasSong ? { scale: 1.08 } : {}}
                whileTap={hasSong ? { scale: 0.92 } : {}}
                transition={{ duration: 0.12 }}
                className={`relative w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-150
                    ${shuffleClass}
                    disabled:opacity-30 disabled:cursor-default`}
                title={shuffle ? t(lang, 'playback.shuffleOn') : t(lang, 'playback.shuffleOff')}
            >
                <ShuffleIcon />
                {/* Active dot indicator */}
                {shuffle && (
                    <span
                        className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${accent.bg400}`}
                    />
                )}
            </motion.button>

            {/* ── Previous ────────────────────────────────────────── */}
            <motion.button
                {...prevHover}
                onClick={playPrev}
                disabled={!hasSong}
                whileHover={hasSong ? { scale: 1.1 } : {}}
                whileTap={hasSong ? { scale: 0.9 } : {}}
                transition={{ duration: 0.12 }}
                className="w-10 h-10 rounded-full flex items-center justify-center text-white/80 hover:text-white disabled:opacity-30 cursor-pointer transition-colors"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
                </svg>
            </motion.button>

            {/* ── Play / Pause ─────────────────────────────────────── */}
            <motion.button
                {...playPauseHover}
                onClick={togglePlayPause}
                disabled={!hasSong}
                whileHover={hasSong ? { scale: 1.06 } : {}}
                whileTap={hasSong ? { scale: 0.94 } : {}}
                transition={{ duration: 0.12 }}
                className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center cursor-pointer
                    ${hasSong ? `${accent.bg500} shadow-lg text-white ${accent.shadow25}` : 'bg-white/10 text-white/50'}`}
                style={hasSong ? { boxShadow: `0 4px 20px ${accent.hex500}30` } : {}}
            >
                {isPlaying ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
                    </svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                    </svg>
                )}
            </motion.button>

            {/* ── Next ────────────────────────────────────────────── */}
            <motion.button
                {...nextHover}
                onClick={playNext}
                disabled={!hasSong}
                whileHover={hasSong ? { scale: 1.1 } : {}}
                whileTap={hasSong ? { scale: 0.9 } : {}}
                transition={{ duration: 0.12 }}
                className="w-10 h-10 rounded-full flex items-center justify-center text-white/80 hover:text-white disabled:opacity-30 cursor-pointer transition-colors"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                </svg>
            </motion.button>

            {/* ── Repeat ──────────────────────────────────────────── */}
            <motion.button
                {...repeatHover}
                onClick={cycleRepeat}
                disabled={!hasSong}
                whileHover={hasSong ? { scale: 1.08 } : {}}
                whileTap={hasSong ? { scale: 0.92 } : {}}
                transition={{ duration: 0.12 }}
                className={`relative w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-150
                    ${repeatClass}
                    disabled:opacity-30 disabled:cursor-default`}
                title={repeatTitle}
            >
                <RepeatIcon mode={repeat} />
                {/* Mode dot indicators */}
                {repeat !== 'off' && (
                    <span
                        className={`absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full ${accent.bg400}
                            ${repeat === 'one' ? 'w-1.5 h-1.5' : 'w-1 h-1'}`}
                    />
                )}
            </motion.button>

        </div>
    );
}
