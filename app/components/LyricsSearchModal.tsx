'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lang, t } from '../lib/translations';
import { OnlineLyricItem } from '../hooks/useLyrics';
import { LyricsIcon } from './icons';
import { getAccent } from '../lib/colors';

interface LyricsSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    lang: Lang;
    initialTitle?: string;
    initialArtist?: string;
    accentColor: string;
    songPath?: string | null;
    searchOnlineLyrics: (query: string) => Promise<OnlineLyricItem[]>;
    onSelectLyric: (lrcContent: string) => void;
}

function formatDuration(seconds?: number): string {
    if (!seconds || seconds <= 0) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function LyricsSearchModal({
    isOpen,
    onClose,
    lang,
    initialTitle = '',
    initialArtist = '',
    accentColor,
    songPath,
    searchOnlineLyrics,
    onSelectLyric,
}: LyricsSearchModalProps) {
    const accent = getAccent(accentColor);
    const accentHex = accentColor?.startsWith('#')
        ? accentColor
        : (accent?.hex500 || '#0284c7');

    const [query, setQuery] = useState<string>('');
    const [results, setResults] = useState<OnlineLyricItem[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [searched, setSearched] = useState<boolean>(false);
    const [previewItem, setPreviewItem] = useState<OnlineLyricItem | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
    const mouseDownOnBackdropRef = useRef<boolean>(false);

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Close context menu on outside click or scroll
    useEffect(() => {
        if (!contextMenu) return;
        const handleOutside = () => setContextMenu(null);
        window.addEventListener('click', handleOutside);
        window.addEventListener('scroll', handleOutside, true);
        return () => {
            window.removeEventListener('click', handleOutside);
            window.removeEventListener('scroll', handleOutside, true);
        };
    }, [contextMenu]);

    useEffect(() => {
        if (isOpen) {
            const initialQuery = `${initialTitle} ${initialArtist}`.trim();
            setQuery(initialQuery);
            setResults([]);
            setSearched(false);
            setPreviewItem(null);
            if (initialQuery) {
                handleSearch(initialQuery);
            }
        }
    }, [isOpen, initialTitle, initialArtist]);

    const handleSearch = async (searchQuery?: string) => {
        const q = searchQuery !== undefined ? searchQuery : query;
        if (!q.trim()) return;

        setLoading(true);
        setSearched(true);
        setPreviewItem(null);
        try {
            const res = await searchOnlineLyrics(q);
            setResults(res);
        } catch (err) {
            console.error('Failed to search lyrics:', err);
            setResults([]);
        } finally {
            setLoading(false);
        }
    };

    const handleCopyText = (e: React.MouseEvent) => {
        e.stopPropagation();
        const selection = window.getSelection()?.toString();
        const lyricContent = previewItem?.syncedLyrics || previewItem?.plainLyrics || '';
        const textToCopy = selection && selection.trim().length > 0 ? selection : lyricContent;
        if (textToCopy) {
            navigator.clipboard.writeText(textToCopy);
        }
        setContextMenu(null);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    onMouseDown={(e) => {
                        mouseDownOnBackdropRef.current = e.target === e.currentTarget;
                    }}
                    onClick={(e) => {
                        if (mouseDownOnBackdropRef.current && e.target === e.currentTarget) {
                            onClose();
                        }
                        mouseDownOnBackdropRef.current = false;
                    }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md select-none"
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.94, y: 14 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.94, y: 14 }}
                        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                        className="relative w-full max-w-2xl bg-zinc-900/95 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/60">
                            <div className="flex items-center space-x-3">
                                <div
                                    className="p-2 rounded-xl bg-zinc-800/80 border border-zinc-700/50"
                                    style={{ color: accentHex }}
                                >
                                    <LyricsIcon size={20} />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-zinc-100">
                                        {t(lang, 'lyrics.searchModalTitle')}
                                    </h2>
                                    <p className="text-xs text-zinc-400">Powered by LRCLIB Database</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 transition-colors cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Search Bar */}
                        <div className="p-4 border-b border-zinc-800/60 bg-zinc-950/40">
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    handleSearch();
                                }}
                                className="flex items-center space-x-2"
                            >
                                <input
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder={t(lang, 'lyrics.searchPlaceholder')}
                                    className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors"
                                />
                                <button
                                    type="submit"
                                    disabled={loading || !query.trim()}
                                    className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white transition-all shadow-md cursor-pointer disabled:opacity-50 hover:brightness-110 active:scale-[0.98]"
                                    style={{ backgroundColor: accentHex }}
                                >
                                    {loading ? t(lang, 'lyrics.autoFetching') : t(lang, 'lyrics.searchBtn')}
                                </button>
                            </form>

                        </div>

                        {/* Content Area */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px] scrollbar-thin scrollbar-thumb-zinc-800">
                            {loading ? (
                                <div className="h-64 flex flex-col items-center justify-center space-y-3 text-zinc-400">
                                    <div className="w-7 h-7 border-2 border-zinc-600 border-t-zinc-200 rounded-full animate-spin" />
                                    <p className="text-xs font-medium">{t(lang, 'lyrics.autoFetching')}</p>
                                </div>
                            ) : previewItem ? (
                                /* Preview View */
                                <div className="flex flex-col h-full space-y-4">
                                    <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                                        <div>
                                            <h3 className="text-sm font-bold text-zinc-100">
                                                {previewItem.trackName}
                                            </h3>
                                            <p className="text-xs text-zinc-400">
                                                {previewItem.artistName} {previewItem.albumName ? `• ${previewItem.albumName}` : ''}
                                            </p>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <button
                                                onClick={() => setPreviewItem(null)}
                                                className="px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-800/60 hover:bg-zinc-800 transition-colors cursor-pointer"
                                            >
                                                ← {t(lang, 'lyrics.backBtn')}
                                            </button>
                                            <button
                                                onClick={() => {
                                                    const content = previewItem.syncedLyrics || previewItem.plainLyrics || '';
                                                    if (content) {
                                                        onSelectLyric(content);
                                                        onClose();
                                                    }
                                                }}
                                                className="px-4 py-1.5 rounded-xl text-xs font-semibold text-white transition-all cursor-pointer shadow-md hover:brightness-110 active:scale-[0.98]"
                                                style={{ backgroundColor: accentHex }}
                                            >
                                                {t(lang, 'lyrics.applyBtn')}
                                            </button>
                                        </div>
                                    </div>
                                    <div
                                        className="lyrics-preview-box flex-1 overflow-y-auto p-4 rounded-xl bg-zinc-950/80 border border-zinc-800/80 font-mono text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap max-h-80 select-text"
                                        onContextMenu={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setContextMenu({ x: e.clientX, y: e.clientY });
                                        }}
                                    >
                                        <style>{`
                                            .lyrics-preview-box::selection, .lyrics-preview-box *::selection {
                                                background-color: ${accentHex}66 !important;
                                                color: #ffffff !important;
                                            }
                                        `}</style>
                                        {previewItem.syncedLyrics || previewItem.plainLyrics || t(lang, 'lyrics.emptyContent')}
                                    </div>
                                </div>
                            ) : results.length > 0 ? (
                                /* Results List */
                                results.map((item) => {
                                    const isSynced = !!item.syncedLyrics;
                                    const hasLyrics = !!(item.syncedLyrics || item.plainLyrics);
                                    return (
                                        <div
                                            key={item.id || `${item.trackName}-${item.artistName}`}
                                            className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-900/60 hover:bg-zinc-800/70 border border-zinc-800/60 transition-colors"
                                        >
                                            <div className="flex-1 min-w-0 pr-3">
                                                <div className="flex items-center space-x-2">
                                                    <span className="text-sm font-semibold text-zinc-100 truncate">
                                                        {item.trackName}
                                                    </span>
                                                    {isSynced ? (
                                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
                                                            {t(lang, 'lyrics.syncedBadge')}
                                                        </span>
                                                    ) : hasLyrics ? (
                                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700/50 shrink-0">
                                                            {t(lang, 'lyrics.plainBadge')}
                                                        </span>
                                                    ) : null}
                                                </div>
                                                <div className="text-xs text-zinc-400 truncate mt-0.5">
                                                    {item.artistName} {item.albumName ? `• ${item.albumName}` : ''}
                                                </div>
                                            </div>
                                            <div className="flex items-center space-x-3 shrink-0">
                                                <span className="text-xs text-zinc-500 font-mono">
                                                    {formatDuration(item.duration)}
                                                </span>
                                                {hasLyrics && (
                                                    <>
                                                        <button
                                                            onClick={() => setPreviewItem(item)}
                                                            className="px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/60 transition-colors cursor-pointer"
                                                        >
                                                            {t(lang, 'lyrics.previewBtn')}
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                const content = item.syncedLyrics || item.plainLyrics || '';
                                                                if (content) {
                                                                    onSelectLyric(content);
                                                                    onClose();
                                                                }
                                                            }}
                                                            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white transition-all shadow-sm cursor-pointer hover:brightness-110 active:scale-[0.98]"
                                                            style={{ backgroundColor: accentHex }}
                                                        >
                                                            {t(lang, 'lyrics.applyBtn')}
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            ) : searched ? (
                                <div className="h-64 flex flex-col items-center justify-center space-y-2 text-center text-zinc-500">
                                    <p className="text-sm font-medium text-zinc-400">
                                        {t(lang, 'lyrics.searchNoResults')}
                                    </p>
                                </div>
                            ) : (
                                <div className="h-64 flex flex-col items-center justify-center space-y-2 text-center text-zinc-500">
                                    <LyricsIcon size={32} className="text-zinc-600" />
                                    <p className="text-xs text-zinc-400">
                                        {t(lang, 'lyrics.searchPlaceholder')}
                                    </p>
                                </div>
                            )}
                        </div>
                    </motion.div>

                    {/* Custom Context Menu for Lyric Preview Box */}
                    {contextMenu && (
                        <div
                            className="fixed z-[70] bg-zinc-900/95 border border-zinc-800 rounded-xl shadow-2xl py-1 px-1 min-w-[140px] text-xs font-medium backdrop-blur-md animate-fade-in"
                            style={{ top: contextMenu.y, left: contextMenu.x }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button
                                type="button"
                                onClick={handleCopyText}
                                className="w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-zinc-200 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer text-left"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-zinc-400">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                                <span>{t(lang, 'contextMenu.copyText')}</span>
                            </button>
                        </div>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
}
