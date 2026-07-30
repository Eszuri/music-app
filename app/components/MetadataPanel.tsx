'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileEntry } from './FolderExplorer';
import { SongMetadata } from './PlayerPanel';
import { getAccent } from '../lib/colors';
import {t, type Lang} from '../lib/translations';
import ContextMenu, { ContextMenuItem } from './ContextMenu';
import { useHoverDescription } from '../hooks/useHoverDescription';
import { MetadataPanelSkeleton } from './Skeleton';

interface MetadataPanelProps {
    lang: Lang;
    selectedSong: FileEntry | null;
    metadata: SongMetadata | null;
    accentColor: string;
    resetSidebarToken: number;
    onContextMenu?: (e: React.MouseEvent) => void;
}

const MIN_WIDTH = 200;
const MAX_WIDTH = 640;
const DEFAULT_WIDTH = 320;
const STORAGE_KEY = 'music-app-meta-width';

function loadSavedWidth(): number {
    if (typeof window === 'undefined') return DEFAULT_WIDTH;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_WIDTH;
    const n = Number(raw);
    if (!Number.isFinite(n)) return DEFAULT_WIDTH;
    return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, n));
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

function MetaRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex flex-col gap-0.5 min-w-0">
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

export default function MetadataPanel({ lang, selectedSong, metadata, accentColor, resetSidebarToken, onContextMenu }: MetadataPanelProps) {
    const accent = getAccent(accentColor);
    const songTitle = selectedSong
        ? (metadata?.title || selectedSong.name.replace(/\.[^/.]+$/, ''))
        : null;

    const [width, setWidth] = useState<number>(DEFAULT_WIDTH);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);
    const isDraggingRef = useRef(false);
    const startXRef = useRef(0);
    const startWidthRef = useRef(DEFAULT_WIDTH);

    const metaHover = useHoverDescription(t(lang, 'status.songDetails'));

    useEffect(() => {
        setWidth(loadSavedWidth());
    }, []);

    useEffect(() => {
        if (resetSidebarToken === 0) return;
        setWidth(DEFAULT_WIDTH);
        window.localStorage.removeItem(STORAGE_KEY);
    }, [resetSidebarToken]);

    useEffect(() => {
        if (width === DEFAULT_WIDTH) return;
        window.localStorage.setItem(STORAGE_KEY, String(width));
    }, [width]);

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
    }, []);

    const onMouseUp = useCallback(() => {
        if (!isDraggingRef.current) return;
        isDraggingRef.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
    }, [onMouseMove]);

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
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '';
                }}
                className="absolute top-0 left-0 h-full w-1.5 cursor-col-resize transition-colors z-10 max-lg:hidden"
            />

            <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800/30">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4M12 8h.01" />
                </svg>
                <span className="text-xs font-medium text-zinc-400 tracking-wide">{t(lang, 'metadata.heading')}</span>
            </div>

            <div 
                {...metaHover}
                className="flex-1 overflow-y-auto overflow-x-hidden p-3 md:p-4 space-y-3 md:space-y-4 select-text [&_*::selection]:bg-[var(--selection-bg)] [&_*::selection]:text-[var(--selection-color)]"
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
                                icon: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
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
                        metadata ? (
                            <motion.div
                                key={selectedSong.path}
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                transition={{ duration: 0.2 }}
                            >
                                {/* Cover art small */}
                                <div
                                    onContextMenu={onContextMenu}
                                    className="w-full aspect-square max-w-[160px] mx-auto rounded-xl overflow-hidden bg-zinc-900/80 ring-1 ring-white/5 mb-4"
                                >
                                    <AnimatePresence mode="wait">
                                        {metadata?.cover_b64 ? (
                                            <motion.img
                                                key={selectedSong.path}
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                transition={{ duration: 0.2 }}
                                                src={`data:${metadata.cover_mime};base64,${metadata.cover_b64}`}
                                                alt={t(lang, 'metadata.cover')}
                                                className="w-full h-full object-contain"
                                            />
                                        ) : (
                                            <motion.div
                                                key="placeholder"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 0.12 }}
                                                exit={{ opacity: 0 }}
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

                                <SectionTitle title={t(lang, 'metadata.songInfo')} />
                                <div className="space-y-3 pl-1">
                                    <MetaRow label={t(lang, 'metadata.title')} value={songTitle || '—'} />
                                    <MetaRow label={t(lang, 'metadata.artist')} value={metadata?.artist || t(lang, 'metadata.unknownArtist')} />
                                    {metadata?.album && <MetaRow label={t(lang, 'metadata.album')} value={metadata.album} />}
                                    {metadata?.genre && <MetaRow label={t(lang, 'metadata.genre')} value={metadata.genre} />}
                                    {metadata?.year != null && <MetaRow label={t(lang, 'metadata.year')} value={String(metadata.year)} />}
                                    {trackStr && <MetaRow label={t(lang, 'metadata.track')} value={trackStr} />}
                                    {discStr && <MetaRow label={t(lang, 'metadata.disc')} value={discStr} />}
                                    <MetaRow label={t(lang, 'metadata.duration')} value={formatDuration(metadata?.duration ?? null)} />
                                </div>

                                <SectionTitle title={t(lang, 'metadata.techInfo')} />
                                <div className="space-y-3 pl-1">
                                    {metadata?.bitrate != null && (
                                        <MetaRow label={t(lang, 'metadata.bitrate')} value={`${metadata.bitrate} kbps`} />
                                    )}
                                    {metadata?.sample_rate != null && (
                                        <MetaRow label={t(lang, 'metadata.sampleRate')} value={`${(metadata.sample_rate / 1000).toFixed(1)} kHz`} />
                                    )}
                                    {metadata?.channels != null && (
                                        <MetaRow label={t(lang, 'metadata.channel')} value={channelsLabel(lang, metadata.channels)} />
                                    )}
                                    <MetaRow label={t(lang, 'metadata.format')} value={selectedSong.ext.toUpperCase()} />
                                    <MetaRow label={t(lang, 'metadata.size')} value={formatSize(selectedSong.size)} />
                                </div>

                                <SectionTitle title={t(lang, 'metadata.fileInfo')} />
                                <div className="space-y-3 pl-1">
                                    <MetaRow label={t(lang, 'metadata.fileName')} value={selectedSong.name} />
                                    <MetaRow label={t(lang, 'metadata.created')} value={formatDate(selectedSong.ctime)} />
                                    <MetaRow label={t(lang, 'metadata.modified')} value={formatDate(selectedSong.mtime)} />
                                </div>

                                {/* Comment */}
                                {metadata?.comment && (
                                    <>
                                        <SectionTitle title={t(lang, 'metadata.comment')} />
                                        <div className="pl-1">
                                            <p className="text-sm text-zinc-300 leading-relaxed break-words">
                                                {metadata.comment}
                                            </p>
                                        </div>
                                    </>
                                )}

                                {/* Path */}
                                <SectionTitle title={t(lang, 'metadata.location')} />
                                <div className="pl-1">
                                    <p className="text-xs text-zinc-500 break-all leading-relaxed font-mono">
                                        {selectedSong.path}
                                    </p>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="loading-metadata"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                            >
                                <MetadataPanelSkeleton accentColor={accentColor} />
                            </motion.div>
                        )
                    ) : (
                        <motion.div
                            key="no-song"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.2 }}
                            className="flex flex-col items-center justify-center h-full text-center pt-24"
                        >
                            <div className="w-14 h-14 rounded-2xl bg-zinc-800/50 flex items-center justify-center mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-600">
                                    <circle cx="12" cy="12" r="10" />
                                    <path d="M12 16v-4M12 8h.01" />
                                </svg>
                            </div>
                            <p className="text-sm text-zinc-500">{t(lang, 'metadata.emptyTitle')}</p>
                            <p className="text-xs text-zinc-600 mt-1">{t(lang, 'metadata.emptyDesc')}</p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
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
