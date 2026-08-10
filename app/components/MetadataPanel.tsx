'use client';

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileEntry } from './FolderExplorer';
import { SongMetadata } from './PlayerPanel';
import { getAccent } from '../lib/colors';
import { t, type Lang } from '../lib/translations';
import { contentMotion } from '../lib/animations';
import ContextMenu, { ContextMenuItem } from './ContextMenu';
import { useHoverDescription } from '../hooks/useHoverDescription';
import { useHoverInfo } from '../contexts/HoverInfoContext';
import { MetadataPanelSkeleton } from './Skeleton';
import { InfoIcon, CopyIcon, MusicNoteIcon, EditIcon, LyricsIcon, DetailsIcon } from './icons';
import { useLyrics } from '../hooks/useLyrics';
import { LyricsSearchModal } from './LyricsSearchModal';

interface MetadataPanelProps {
    lang: Lang;
    selectedSong: FileEntry | null;
    metadata: SongMetadata | null;
    accentColor: string;
    coverDataUrl: string | null;
    resetSidebarToken: number;
    currentTime?: number;
    onSeek?: (timeSec: number) => void;
    onContextMenu?: (e: React.MouseEvent) => void;
    onOpenEditMetadata?: () => void;
}

const MIN_WIDTH = 200;
const MAX_WIDTH = 640;
const DEFAULT_WIDTH = 320;
const STORAGE_KEY = 'music-app-meta-width';
const TAB_STORAGE_KEY = 'music-app-meta-tab';

function loadSavedWidth(): number {
    if (typeof window === 'undefined') return DEFAULT_WIDTH;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_WIDTH;
    const n = Number(raw);
    if (!Number.isFinite(n)) return DEFAULT_WIDTH;
    return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, n));
}

function loadSavedTab(): 'metadata' | 'lyrics' {
    if (typeof window === 'undefined') return 'metadata';
    const raw = window.localStorage.getItem(TAB_STORAGE_KEY);
    return raw === 'lyrics' ? 'lyrics' : 'metadata';
}

function formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const v = bytes / Math.pow(1024, i);
    return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDate(ts: number): string {
    const d = new Date(ts * 1000);
    return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function formatDuration(seconds: number | null): string {
    if (!seconds) return '—';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function MetaRow({ label, value, hoverProps }: { label: string; value: string; hoverProps?: Record<string, unknown> }) {
    return (
        <div className="flex flex-col gap-0.5 min-w-0" {...(hoverProps ?? {})}>
            <span className="text-[10px] font-medium tracking-wider text-zinc-500 uppercase truncate">{label}</span>
            <span className={`text-sm ${value === '—' ? 'text-zinc-600' : 'text-zinc-200'} break-all`} title={value}>
                {value}
            </span>
        </div>
    );
}

function SectionTitle({ title }: { title: string }) {
    return <h4 className="text-[11px] font-semibold tracking-wider text-zinc-400 uppercase mt-5 first:mt-0 mb-2.5">{title}</h4>;
}

function channelsLabel(lang: Lang, ch: number | null): string {
    if (ch === null) return '—';
    if (ch === 1) return t(lang, 'metadata.mono');
    if (ch === 2) return t(lang, 'metadata.stereo');
    return `${ch}${t(lang, 'metadata.ch')}`;
}

function checkIsHiRes(selectedSong: FileEntry | null, metadata: SongMetadata | null): boolean {
    if (!selectedSong || !metadata) return false;

    // 1. Lossy formats (mp3, aac, ogg, wma) are NEVER Hi-Res Audio
    const ext = selectedSong.ext.toLowerCase();
    const isLossless = ['flac', 'wav', 'alac', 'aiff', 'aif', 'dsf', 'dff'].includes(ext);
    if (!isLossless) return false;

    const sr = metadata.sample_rate ?? 0;
    const bd = metadata.bit_depth ?? null;

    // 2. Official Hi-Res Audio criteria:
    // - Bit Depth > 16 (24-bit, 32-bit) with Sample Rate >= 44100 Hz
    // - OR Sample Rate >= 88200 Hz (88.2kHz, 96kHz, 192kHz, DSD)
    if (bd != null) {
        return bd > 16 && sr >= 44100;
    }

    return sr >= 88200;
}

function LyricsSection({
    lang,
    selectedSong,
    metadata,
    currentTime,
    onSeek,
    accentColor,
}: {
    lang: Lang;
    selectedSong: FileEntry | null;
    metadata: SongMetadata | null;
    currentTime?: number;
    onSeek?: (timeSec: number) => void;
    accentColor: string;
}) {
    const songPath = selectedSong?.path ?? null;
    const songTitle = metadata?.title || selectedSong?.name.replace(/\.[^/.]+$/, '') || undefined;
    const artistName = metadata?.artist || undefined;
    const albumName = metadata?.album || undefined;
    const duration = metadata?.duration || undefined;

    const {
        lines,
        isSynced,
        source,
        loading,
        isFetchingOnline,
        activeIndex,
        importLyricsFile,
        fetchOnlineLyrics,
        searchOnlineLyrics,
        applyLyrics,
        saveAsLrcFile,
    } = useLyrics(songPath, currentTime ?? 0, songTitle, artistName, albumName, duration);

    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const activeLineRef = useRef<HTMLDivElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const accent = getAccent(accentColor);

    // Auto-scroll active lyric line to center of container
    useEffect(() => {
        if (activeIndex < 0 || !activeLineRef.current) return;
        activeLineRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
        });
    }, [activeIndex]);

    const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            if (content) {
                importLyricsFile(content, file.name);
            }
        };
        reader.readAsText(file);
    };

    const handleManualSearchClick = async () => {
        if (!songTitle) {
            setIsSearchOpen(true);
            return;
        }

        const found = await fetchOnlineLyrics(songTitle, artistName, albumName, duration);
        if (!found) {
            // Tampilkan modal pencarian manual jika tidak ditemukan otomatis
            setIsSearchOpen(true);
        }
    };

    const handleSaveLrc = async () => {
        setIsSaving(true);
        const ok = await saveAsLrcFile();
        setIsSaving(false);
        if (ok) {
            setToastMessage({ type: 'success', text: t(lang, 'lyrics.saveSuccess') });
        } else {
            setToastMessage({ type: 'error', text: t(lang, 'lyrics.saveError') });
        }
        setTimeout(() => setToastMessage(null), 3500);
    };

    const getSourceLabel = (src: string | null) => {
        if (!src) return '';
        if (src === 'lrc_file') return `📁 ${t(lang, 'lyrics.source.lrc_file')}`;
        if (src === 'embedded') return `🏷️ ${t(lang, 'lyrics.source.embedded')}`;
        if (src === 'lrclib') return `🌐 ${t(lang, 'lyrics.source.lrclib')}`;
        if (src === 'custom') return `📄 ${t(lang, 'lyrics.source.custom')}`;
        return src;
    };

    // Hover descriptions for status bar (bottom-left)
    const hSource = useHoverDescription(source ? t(lang, 'status.lyrics.source') : null);
    const hType = useHoverDescription(isSynced ? t(lang, 'status.lyrics.typeSynced') : t(lang, 'status.lyrics.typePlain'));
    const hSaveLrc = useHoverDescription(t(lang, 'status.lyrics.saveLrc'));
    const hSearchOnline = useHoverDescription(t(lang, 'status.lyrics.searchOnline'));
    const hImportFile = useHoverDescription(t(lang, 'status.lyrics.importFile'));

    return (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Hidden File Input */}
            <input
                ref={fileInputRef}
                type="file"
                accept=".lrc,.txt"
                onChange={handleFileImport}
                className="hidden"
            />

            {/* Toast Notification Banner */}
            {toastMessage && (
                <div
                    className={`mx-3 my-1.5 px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between border shadow-lg transition-all animate-fade-in shrink-0 ${
                        toastMessage.type === 'success'
                            ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/40'
                            : 'bg-rose-950/90 text-rose-300 border-rose-500/40'
                    }`}
                >
                    <div className="flex items-center space-x-2 truncate">
                        <span>{toastMessage.type === 'success' ? '✓' : '⚠️'}</span>
                        <span className="truncate">{toastMessage.text}</span>
                    </div>
                    <button
                        onClick={() => setToastMessage(null)}
                        className="text-xs opacity-70 hover:opacity-100 cursor-pointer ml-2"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* Lyrics Content Container */}
            <div
                ref={containerRef}
                className="flex-1 overflow-y-auto p-4 space-y-4 text-center select-none scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent"
            >
                {loading || isFetchingOnline ? (
                    <div className="h-full flex flex-col items-center justify-center space-y-3 text-zinc-400 py-16">
                        <div className="w-6 h-6 border-2 border-zinc-600 border-t-zinc-200 rounded-full animate-spin" />
                        <p className="text-xs font-medium">
                            {isFetchingOnline ? t(lang, 'lyrics.autoFetching') : t(lang, 'general.update.checking')}
                        </p>
                    </div>
                ) : lines.length > 0 ? (
                    lines.map((line, idx) => {
                        const isActive = idx === activeIndex;
                        return (
                            <div
                                key={line.id}
                                ref={isActive ? activeLineRef : null}
                                onClick={() => {
                                    if (line.timeSec !== null && onSeek) {
                                        onSeek(line.timeSec);
                                    }
                                }}
                                className={`transition-all duration-250 py-1.5 px-3 rounded-xl cursor-pointer ${
                                    isActive
                                        ? 'scale-105 font-bold text-base text-zinc-100 drop-shadow-md py-2.5 bg-zinc-800/40'
                                        : 'text-zinc-500 hover:text-zinc-300 text-sm font-medium'
                                }`}
                                style={
                                    isActive
                                        ? {
                                              color: accent.hex || '#22c55e',
                                              textShadow: `0 0 16px ${accent.hex || '#22c55e'}30`,
                                          }
                                        : undefined
                                }
                            >
                                {line.text}
                            </div>
                        );
                    })
                ) : (
                    <div className="h-full flex flex-col items-center justify-center space-y-3 text-center py-12 px-2">
                        <div className="p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 text-zinc-500">
                            <LyricsIcon size={28} />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-sm font-semibold text-zinc-200">
                                {t(lang, 'lyrics.notFound')}
                            </h3>
                            <p className="text-[11px] text-zinc-400 leading-relaxed max-w-[220px] mx-auto">
                                {t(lang, 'lyrics.notFoundDesc')}
                            </p>
                        </div>
                        <div className="flex flex-col space-y-2 pt-1 w-full max-w-[180px]">
                            <button
                                onClick={handleManualSearchClick}
                                disabled={isFetchingOnline}
                                {...hSearchOnline}
                                className="px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all shadow-md cursor-pointer flex items-center justify-center space-x-1.5 disabled:opacity-50"
                                style={{ backgroundColor: accent.hex || '#22c55e' }}
                            >
                                <LyricsIcon size={14} />
                                <span>{t(lang, 'lyrics.searchBtn')}</span>
                            </button>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                {...hImportFile}
                                className="px-3.5 py-1.5 rounded-xl text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/60 transition-colors cursor-pointer"
                            >
                                {t(lang, 'lyrics.importBtn')}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer Bar */}
            {lines.length > 0 && (
                <div className="flex flex-col border-t border-zinc-800/60 bg-zinc-900/40 text-[11px] text-zinc-400 shrink-0">
                    <div className="flex items-center justify-between px-3.5 py-2">
                        <div className="flex items-center space-x-2 truncate">
                            <span className="font-medium text-zinc-300 truncate cursor-help" {...hSource}>
                                {getSourceLabel(source)}
                            </span>
                            <span className="text-zinc-500">•</span>
                            <span className="cursor-help" {...hType}>
                                {isSynced ? t(lang, 'lyrics.typeSynced') : t(lang, 'lyrics.typePlain')}
                            </span>
                        </div>
                        <div className="flex items-center space-x-2 shrink-0">
                            {(source === 'lrclib' || source === 'custom') && (
                                <button
                                    onClick={handleSaveLrc}
                                    disabled={isSaving}
                                    {...hSaveLrc}
                                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 transition-all flex items-center space-x-1 cursor-pointer disabled:opacity-50 shadow-sm"
                                    title={t(lang, 'lyrics.saveLrcBtn')}
                                >
                                    <span>💾</span>
                                    <span>{isSaving ? '...' : t(lang, 'lyrics.saveLrcBtn')}</span>
                                </button>
                            )}
                            <button
                                onClick={() => setIsSearchOpen(true)}
                                {...hSearchOnline}
                                className="px-2 py-1 rounded-lg hover:bg-zinc-800 text-zinc-300 transition-colors cursor-pointer"
                                title={t(lang, 'lyrics.searchBtn')}
                            >
                                🔍
                            </button>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                {...hImportFile}
                                className="hover:text-zinc-200 transition-colors underline cursor-pointer"
                            >
                                {t(lang, 'lyrics.importBtn')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Search Modal */}
            <LyricsSearchModal
                isOpen={isSearchOpen}
                onClose={() => setIsSearchOpen(false)}
                lang={lang}
                initialTitle={songTitle}
                initialArtist={artistName}
                accentColor={accent.hex || '#22c55e'}
                searchOnlineLyrics={searchOnlineLyrics}
                onSelectLyric={(content) => applyLyrics(content, 'lrclib')}
            />
        </div>
    );
}

function MetadataPanel({
    lang,
    selectedSong,
    metadata,
    accentColor,
    coverDataUrl,
    resetSidebarToken,
    currentTime,
    onSeek,
    onContextMenu,
    onOpenEditMetadata,
}: MetadataPanelProps) {
    const accent = getAccent(accentColor);
    const songTitle = selectedSong
        ? (metadata?.title || selectedSong.name.replace(/\.[^/.]+$/, ''))
        : null;

    const [activeTab, setActiveTab] = useState<'metadata' | 'lyrics'>('metadata');

    useEffect(() => {
        setActiveTab(loadSavedTab());
    }, []);

    const changeTab = useCallback((tab: 'metadata' | 'lyrics') => {
        setActiveTab(tab);
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(TAB_STORAGE_KEY, tab);
        }
    }, []);
    const [width, setWidth] = useState<number>(DEFAULT_WIDTH);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);
    const isDraggingRef = useRef(false);
    const startXRef = useRef(0);
    const startWidthRef = useRef(DEFAULT_WIDTH);
    const widthPendingRef = useRef<number | null>(null);

    // Per-field hover descriptions — specific label shown in status bar per item
    const hTitle = useHoverDescription(selectedSong ? t(lang, 'status.meta.title') : null);
    const hArtist = useHoverDescription(selectedSong ? t(lang, 'status.meta.artist') : null);
    const hAlbum = useHoverDescription(selectedSong ? t(lang, 'status.meta.album') : null);
    const hGenre = useHoverDescription(selectedSong ? t(lang, 'status.meta.genre') : null);
    const hYear = useHoverDescription(selectedSong ? t(lang, 'status.meta.year') : null);
    const hTrack = useHoverDescription(selectedSong ? t(lang, 'status.meta.track') : null);
    const hDisc = useHoverDescription(selectedSong ? t(lang, 'status.meta.disc') : null);
    const hDuration = useHoverDescription(selectedSong ? t(lang, 'status.meta.duration') : null);
    const hBitrate = useHoverDescription(selectedSong ? t(lang, 'status.meta.bitrate') : null);
    const hSample = useHoverDescription(selectedSong ? t(lang, 'status.meta.sampleRate') : null);
    const hChannel = useHoverDescription(selectedSong ? t(lang, 'status.meta.channel') : null);
    const hFormat = useHoverDescription(selectedSong ? t(lang, 'status.meta.format') : null);
    const hSize = useHoverDescription(selectedSong ? t(lang, 'status.meta.size') : null);
    const hCoverSz = useHoverDescription(selectedSong ? t(lang, 'status.meta.coverSize') : null);
    const hFileName = useHoverDescription(selectedSong ? t(lang, 'status.meta.fileName') : null);
    const hCreated = useHoverDescription(selectedSong ? t(lang, 'status.meta.created') : null);
    const hModified = useHoverDescription(selectedSong ? t(lang, 'status.meta.modified') : null);
    const hComment = useHoverDescription(selectedSong ? t(lang, 'status.meta.comment') : null);
    const hLocation = useHoverDescription(selectedSong ? t(lang, 'status.meta.location') : null);
    const hCoverArt = useHoverDescription(selectedSong ? t(lang, 'status.meta.cover') : null);
    const { setHoverInfo } = useHoverInfo();

    useEffect(() => {
        setWidth(loadSavedWidth());
    }, []);

    useEffect(() => {
        if (resetSidebarToken === 0) return;
        setWidth(DEFAULT_WIDTH);
        setActiveTab('metadata');
        if (typeof window !== 'undefined') {
            window.localStorage.removeItem(STORAGE_KEY);
            window.localStorage.removeItem(TAB_STORAGE_KEY);
        }
    }, [resetSidebarToken]);

    useEffect(() => {
        const handleWindowResize = () => {
            const currentWinW = window.innerWidth;
            const folderWidth = typeof window !== 'undefined'
                ? Number(window.localStorage.getItem('music-app-sidebar-width') || 288)
                : 288;
            const maxAllowed = Math.max(MIN_WIDTH, currentWinW - folderWidth - 300);
            const effectiveMax = Math.min(MAX_WIDTH, maxAllowed);
            setWidth(prev => (prev > effectiveMax ? effectiveMax : prev));
        };
        window.addEventListener('resize', handleWindowResize);
        return () => window.removeEventListener('resize', handleWindowResize);
    }, []);

    const onMouseMove = useCallback((e: MouseEvent) => {
        if (!isDraggingRef.current) return;
        const delta = startXRef.current - e.clientX;
        const currentWinW = window.innerWidth;
        const folderWidth = typeof window !== 'undefined'
            ? Number(window.localStorage.getItem('music-app-sidebar-width') || 288)
            : 288;
        const maxAllowed = Math.max(MIN_WIDTH, currentWinW - folderWidth - 300);
        const effectiveMax = Math.min(MAX_WIDTH, maxAllowed);
        const next = Math.min(effectiveMax, Math.max(MIN_WIDTH, startWidthRef.current + delta));
        setWidth(next);
        widthPendingRef.current = next;
    }, []);

    const onMouseUpRef = useRef<(() => void) | null>(null);

    const onMouseUp = useCallback(() => {
        if (!isDraggingRef.current) return;
        isDraggingRef.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        // Write to localStorage once on release instead of every frame
        if (widthPendingRef.current !== null) {
            window.localStorage.setItem(STORAGE_KEY, String(widthPendingRef.current));
            widthPendingRef.current = null;
        }
        window.removeEventListener('mousemove', onMouseMove);
        if (onMouseUpRef.current) {
            window.removeEventListener('mouseup', onMouseUpRef.current);
        }
    }, [onMouseMove]);

    useEffect(() => {
        onMouseUpRef.current = onMouseUp;
    }, [onMouseUp]);

    const onMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        isDraggingRef.current = true;
        startXRef.current = e.clientX;
        startWidthRef.current = width;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    }, [width, onMouseMove, onMouseUp]);

    useEffect(() => {
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, [onMouseMove, onMouseUp]);

    const trackStr = metadata?.track_number != null
        ? metadata.total_tracks != null
            ? `${metadata.track_number} / ${metadata.total_tracks}`
            : String(metadata.track_number)
        : null;

    const discStr = metadata?.disc_number != null
        ? metadata.total_discs != null
            ? `${metadata.disc_number} / ${metadata.total_discs}`
            : String(metadata.disc_number)
        : null;

    return (
        <aside
            style={{ width }}
            className="relative flex shrink-0 flex-col border-l border-zinc-800/50 bg-zinc-950/40 max-lg:flex-1 max-lg:min-w-0 overflow-hidden"
        >
            <div
                onMouseDown={onMouseDown}
                onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = accent.hex400 + '40';
                    setHoverInfo(t(lang, 'status.resizeHandle'));
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '';
                    setHoverInfo(null);
                }}
                className="absolute top-0 left-0 h-full w-1.5 cursor-col-resize transition-colors z-10 max-lg:hidden"
            />

            {/* Navbar Header (Horizontal Tab Switcher) */}
            <div className="flex items-center border-b border-zinc-800/40 bg-zinc-900/50 p-1.5 gap-1.5 select-none shrink-0">
                <button
                    onClick={() => changeTab('metadata')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        activeTab === 'metadata'
                            ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/60'
                            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/30'
                    }`}
                >
                    <DetailsIcon size={14} />
                    <span>{t(lang, 'metadata.heading')}</span>
                </button>
                <button
                    onClick={() => changeTab('lyrics')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        activeTab === 'lyrics'
                            ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/60'
                            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/30'
                    }`}
                >
                    <LyricsIcon size={14} />
                    <span>{t(lang, 'lyrics.title')}</span>
                </button>
            </div>

            {/* Tab 1: Metadata View */}
            {activeTab === 'metadata' && (
                <div
                    className="flex-1 overflow-y-auto overflow-x-hidden p-3 md:p-4 space-y-3 md:space-y-4 select-text [&_*::selection]:bg-(--selection-bg) [&_*::selection]:text-(--selection-color)"
                    style={{
                        '--selection-bg': accent.hex500 + '80',
                        '--selection-color': '#ffffff'
                    } as React.CSSProperties}
                    onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const sel = window.getSelection()?.toString().trim();
                        setContextMenu({
                            x: e.clientX,
                            y: e.clientY,
                            items: [
                                {
                                    label: t(lang, 'contextMenu.copyText'),
                                    icon: <CopyIcon size={14} />,
                                    onClick: () => {
                                        if (sel) navigator.clipboard.writeText(sel);
                                    },
                                    disabled: !sel
                                }
                            ]
                        });
                    }}
                >
                    <AnimatePresence mode="wait">
                        {selectedSong ? (
                            <motion.div
                                key={selectedSong.path}
                                {...contentMotion}
                            >
                                {/* Cover art small */}
                                <div
                                    {...hCoverArt}
                                    onContextMenu={onContextMenu}
                                    className="w-full aspect-square max-w-40 mx-auto rounded-xl overflow-hidden bg-zinc-900/80 ring-1 ring-white/5 mb-4"
                                >
                                    <AnimatePresence mode="wait">
                                        {coverDataUrl ? (
                                            <motion.img
                                                key={selectedSong.path}
                                                {...contentMotion}
                                                src={coverDataUrl}
                                                alt={t(lang, 'metadata.cover')}
                                                className="w-full h-full object-contain"
                                            />
                                        ) : (
                                            <motion.div
                                                key="placeholder"
                                                {...contentMotion}
                                                animate={{ opacity: 0.12, y: 0 }}
                                                className="w-full h-full flex items-center justify-center"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
                                                    <path d="M9 18V5l12-2v13" />
                                                    <circle cx="6" cy="18" r="3" />
                                                    <circle cx="18" cy="16" r="3" />
                                                </svg>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                <div className="flex items-center justify-between">
                                    <SectionTitle title={t(lang, 'metadata.songInfo')} />
                                    {checkIsHiRes(selectedSong, metadata) && (
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-widest bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">
                                            Hi-Res Audio
                                        </span>
                                    )}
                                </div>
                                <div className="space-y-3 pl-1">
                                    <MetaRow label={t(lang, 'metadata.title')} value={songTitle || '—'} hoverProps={hTitle} />
                                    <MetaRow label={t(lang, 'metadata.artist')} value={metadata?.artist || t(lang, 'metadata.unknownArtist')} hoverProps={hArtist} />
                                    {metadata?.album && <MetaRow label={t(lang, 'metadata.album')} value={metadata.album} hoverProps={hAlbum} />}
                                    {metadata?.genre && <MetaRow label={t(lang, 'metadata.genre')} value={metadata.genre} hoverProps={hGenre} />}
                                    {metadata?.year != null && <MetaRow label={t(lang, 'metadata.year')} value={String(metadata.year)} hoverProps={hYear} />}
                                    {trackStr && <MetaRow label={t(lang, 'metadata.track')} value={trackStr} hoverProps={hTrack} />}
                                    {discStr && <MetaRow label={t(lang, 'metadata.disc')} value={discStr} hoverProps={hDisc} />}
                                    <MetaRow label={t(lang, 'metadata.duration')} value={formatDuration(metadata?.duration ?? null)} hoverProps={hDuration} />
                                </div>

                                <SectionTitle title='' />
                                <div className="space-y-3 pl-1">
                                    {metadata?.bitrate != null && (
                                        <MetaRow label={t(lang, 'metadata.bitrate')} value={`${metadata.bitrate} kbps`} hoverProps={hBitrate} />
                                    )}
                                    {metadata?.sample_rate != null && (
                                        <MetaRow label={t(lang, 'metadata.sampleRate')} value={`${(metadata.sample_rate / 1000).toFixed(1)} kHz`} hoverProps={hSample} />
                                    )}
                                    {metadata?.bit_depth != null && (
                                        <MetaRow label={t(lang, 'metadata.bitDepth')} value={`${metadata.bit_depth}-bit`} />
                                    )}
                                    {metadata?.channels != null && (
                                        <MetaRow label={t(lang, 'metadata.channel')} value={channelsLabel(lang, metadata.channels)} hoverProps={hChannel} />
                                    )}
                                    <MetaRow label={t(lang, 'metadata.format')} value={selectedSong.ext.toUpperCase()} hoverProps={hFormat} />
                                    <MetaRow label={t(lang, 'metadata.size')} value={formatSize(selectedSong.size)} hoverProps={hSize} />
                                    {metadata?.cover_b64 && (
                                        <MetaRow
                                            label={t(lang, 'metadata.coverSize')}
                                            value={formatSize(Math.round(metadata.cover_b64.length * 3 / 4))}
                                            hoverProps={hCoverSz}
                                        />
                                    )}
                                </div>
                                <div className="space-y-3 mt-3 pl-1">
                                    <MetaRow label={t(lang, 'metadata.fileName')} value={selectedSong.name} hoverProps={hFileName} />
                                    <MetaRow label={t(lang, 'metadata.created')} value={formatDate(selectedSong.ctime)} hoverProps={hCreated} />
                                    <MetaRow label={t(lang, 'metadata.modified')} value={formatDate(selectedSong.mtime)} hoverProps={hModified} />
                                </div>

                                {metadata?.comment && (
                                    <>
                                        <SectionTitle title={t(lang, 'metadata.comment')} />
                                        <div className="mt-1 p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/40 text-xs text-zinc-300 whitespace-pre-wrap break-words" {...(hComment ?? {})}>
                                            {metadata.comment}
                                        </div>
                                    </>
                                )}

                                {selectedSong.path && (
                                    <>
                                        <SectionTitle title={t(lang, 'metadata.fileLocation')} />
                                        <div className="mt-1 p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/40 text-[11px] text-zinc-400 font-mono break-all leading-relaxed" {...(hLocation ?? {})}>
                                            {selectedSong.path}
                                        </div>
                                    </>
                                )}
                            </motion.div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center space-y-4 opacity-50 select-none py-20">
                                <div className="p-4 rounded-2xl bg-zinc-800/40 border border-zinc-700/50">
                                    <MusicNoteIcon size={40} className="text-zinc-500" />
                                </div>
                                <div className="space-y-1 text-center">
                                    <p className="text-sm font-medium text-zinc-300">Tidak ada lagu</p>
                                    <p className="text-xs text-zinc-500">Pilih lagu untuk melihat detail</p>
                                </div>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            )}

            {/* Tab 2: Lyrics View */}
            {activeTab === 'lyrics' && (
                <LyricsSection
                    lang={lang}
                    selectedSong={selectedSong}
                    metadata={metadata}
                    currentTime={currentTime}
                    onSeek={onSeek}
                    accentColor={accentColor}
                />
            )}

            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    items={contextMenu.items}
                    onClose={() => setContextMenu(null)}
                />
            )}
        </aside>
    );
}

export default memo(MetadataPanel);
