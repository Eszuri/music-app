'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lang, t } from '../lib/translations';
import { OnlineLyricItem } from '../hooks/useLyrics';
import { LyricsIcon } from './icons';

import { useAiLyricsPlugin } from '../hooks/useAiLyricsPlugin';
import { getTauri, isBrowserTauri } from '../lib/homeState';


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

const AI_MODELS = [

    { code: 'base', label: 'Base (Standard - 141MB)' },
    { code: 'tiny', label: 'Tiny (Ringan - 74MB)' },
    { code: 'small', label: 'Small (Tinggi - 465MB)' },
    { code: 'medium', label: 'Medium (Sangat Presisi - 1.46GB)' },
    { code: 'large-v3-turbo', label: 'Large v3 Turbo (Presisi & Cepat - 1.54GB)' },
    { code: 'large-v3', label: 'Large v3 (Presisi Maksimal - 2.95GB)' },
];

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
    const [query, setQuery] = useState<string>('');
    const [results, setResults] = useState<OnlineLyricItem[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [searched, setSearched] = useState<boolean>(false);
    const [previewItem, setPreviewItem] = useState<OnlineLyricItem | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
    const mouseDownOnBackdropRef = useRef<boolean>(false);

    const [selectedAiModel, setSelectedAiModel] = useState<string>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('symvonia_ai_lyrics_model') || 'base';
        }
        return 'base';
    });

    const [isolateVocals, setIsolateVocals] = useState<boolean>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('symvonia_ai_isolate_vocals') === 'true';
        }
        return false;
    });

    const {
        pluginStatus: aiStatus,
        isDownloading: isAiDownloading,
        isGenerating: isAiGenerating,
        modelDownloadProgress: aiModelProgress,
        generateProgress: aiGenerateProgress,
        downloadPlugin: downloadAiPlugin,
        generateLyrics: generateAiLyrics,
        cancelGeneration: cancelAiGeneration,
    } = useAiLyricsPlugin();


    const activeSongPathRef = useRef<string | null>(songPath ?? null);

    // Keep active song path updated without cancelling background AI lyrics generation
    useEffect(() => {
        activeSongPathRef.current = songPath ?? null;
    }, [songPath]);

    const handleGenerateAiLyrics = async () => {
        if (!songPath) return;
        const targetPath = songPath;
        try {
            const lrcContent = await generateAiLyrics(songPath, selectedAiModel, 'auto', isolateVocals);

            if (lrcContent) {
                // 1. Auto-save generated LRC file to disk for the target song
                if (isBrowserTauri) {
                    try {
                        const mod = await getTauri();
                        await mod.invoke('save_lrc_file', { filePath: targetPath, lrcContent });
                    } catch (saveErr) {
                        console.error('Failed to auto-save LRC file:', saveErr);
                    }
                }

                // 2. If user is currently playing/viewing the target song, apply immediately to player
                if (activeSongPathRef.current === targetPath) {
                    setPreviewItem({
                        trackName: initialTitle || 'Audio Track',
                        artistName: initialArtist || 'Local AI',
                        syncedLyrics: lrcContent,
                    });
                    onSelectLyric(lrcContent);
                }
            }
        } catch (err) {
            console.error('AI lyrics generation error:', err);
        }
    };




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
                                    style={{ color: accentColor }}
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
                                    className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white transition-all shadow-md cursor-pointer disabled:opacity-50"
                                    style={{ backgroundColor: accentColor }}
                                >
                                    {loading ? t(lang, 'lyrics.autoFetching') : t(lang, 'lyrics.searchBtn')}
                                </button>
                            </form>

                            {/* Local AI Lyrics Generator Bar */}
                            {songPath && (
                                <div className="mt-3 pt-3 border-t border-zinc-800/60 space-y-2.5">
                                    {aiStatus?.installed && !isAiGenerating && !aiModelProgress && (
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 focus-within:border-purple-500/40 transition-colors">
                                                <span className="text-zinc-400 text-xs font-medium shrink-0">
                                                    {t(lang, 'lyrics.aiPlugin.modelLabel')}
                                                </span>
                                                <select
                                                    value={selectedAiModel}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setSelectedAiModel(val);
                                                        if (typeof window !== 'undefined') {
                                                            localStorage.setItem('symvonia_ai_lyrics_model', val);
                                                        }
                                                    }}
                                                    className="bg-transparent text-zinc-100 text-xs font-semibold focus:outline-none w-full cursor-pointer"
                                                >
                                                    {AI_MODELS.map((m) => (
                                                        <option key={m.code} value={m.code} className="bg-zinc-900 text-zinc-100">
                                                            {m.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    )}


                                    {aiStatus?.installed && !isAiGenerating && !aiModelProgress && (
                                        <label className="flex items-center gap-2 text-xs cursor-pointer select-none bg-zinc-900/80 border border-zinc-800/80 hover:border-purple-500/40 rounded-xl px-3 py-2 transition-all">
                                            <input
                                                type="checkbox"
                                                checked={isolateVocals}
                                                onChange={(e) => {
                                                    const val = e.target.checked;
                                                    setIsolateVocals(val);
                                                    if (typeof window !== 'undefined') {
                                                        localStorage.setItem('symvonia_ai_isolate_vocals', String(val));
                                                    }
                                                }}
                                                className="w-3.5 h-3.5 rounded bg-zinc-950 border-zinc-700 text-purple-600 focus:ring-purple-500 cursor-pointer accent-purple-500"
                                            />
                                            <span className="font-medium text-purple-200/90 text-[11px]">
                                                {t(lang, 'lyrics.aiPlugin.isolateVocals')}
                                            </span>
                                        </label>
                                    )}

                                    {isAiGenerating ? (
                                        <div className="flex-1 flex items-center justify-between gap-3 bg-purple-950/40 border border-purple-800/40 px-3.5 py-2 rounded-xl">
                                            <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                                <div className="w-3.5 h-3.5 rounded-full border-2 border-purple-400 border-t-transparent animate-spin shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-semibold text-purple-200 truncate">
                                                        {aiGenerateProgress?.segmentText || t(lang, 'lyrics.aiPlugin.generating', { pct: aiGenerateProgress?.percent ?? 0 })}
                                                    </p>
                                                    <div className="w-full bg-purple-900/60 h-1.5 rounded-full mt-1 overflow-hidden">
                                                        <div
                                                            className="bg-purple-400 h-full transition-all duration-300"
                                                            style={{ width: `${aiGenerateProgress?.percent ?? 0}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={cancelAiGeneration}
                                                className="px-2.5 py-1 text-[11px] font-semibold text-rose-300 bg-rose-500/20 hover:bg-rose-500/30 rounded-lg transition-colors shrink-0"
                                            >
                                                Batal
                                            </button>
                                        </div>
                                    ) : aiModelProgress ? (
                                        <div className="flex-1 flex items-center gap-2.5 bg-purple-950/40 border border-purple-800/40 px-3.5 py-2 rounded-xl">
                                            <div className="w-3.5 h-3.5 rounded-full border-2 border-purple-400 border-t-transparent animate-spin shrink-0" />
                                            <span className="text-xs text-purple-200">
                                                Mengunduh Model AI ({aiModelProgress.modelName}): {aiModelProgress.percent}%
                                            </span>
                                        </div>
                                    ) : aiStatus?.installed ? (
                                        <button
                                            type="button"
                                            onClick={handleGenerateAiLyrics}
                                            className="w-full py-2.5 px-4 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-200 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm active:scale-98"
                                        >
                                            <span>✨</span>
                                            <span>{t(lang, 'lyrics.aiPlugin.generateBtn')}</span>
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => downloadAiPlugin()}
                                            disabled={isAiDownloading}
                                            className="w-full py-2.5 px-4 rounded-xl bg-purple-950/50 hover:bg-purple-900/50 border border-purple-800/50 text-purple-300 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
                                        >
                                            <span>✨</span>
                                            <span>
                                                {isAiDownloading
                                                    ? 'Mengunduh Plugin AI...'
                                                    : t(lang, 'lyrics.aiPlugin.installBtn')}
                                            </span>
                                        </button>
                                    )}
                                </div>
                            )}
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
                                                className="px-4 py-1.5 rounded-xl text-xs font-semibold text-white transition-all cursor-pointer shadow-md"
                                                style={{ backgroundColor: accentColor }}
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
                                                background-color: ${accentColor}66 !important;
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
                                                            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white transition-all shadow-sm cursor-pointer"
                                                            style={{ backgroundColor: accentColor }}
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
