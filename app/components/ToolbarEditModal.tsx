'use client';

import React, {memo, useEffect, useCallback} from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import {getAccent} from '../lib/colors';
import {t, type Lang} from '../lib/translations';
import {modalContentMotion, backdropMotion} from '../lib/animations';

export interface ColumnDefinition {
    key: string;
    labelKey: string;
    descKey: string;
    required?: boolean;
    defaultWidth: number;
}

export const ALL_TOOLBAR_COLUMNS: ColumnDefinition[] = [
    {key: 'name', labelKey: 'toolbarEdit.col.name', descKey: 'toolbarEdit.col.name.desc', required: true, defaultWidth: 140},
    {key: 'artist', labelKey: 'toolbarEdit.col.artist', descKey: 'toolbarEdit.col.artist.desc', defaultWidth: 112},
    {key: 'album', labelKey: 'toolbarEdit.col.album', descKey: 'toolbarEdit.col.album.desc', defaultWidth: 112},
    {key: 'track', labelKey: 'toolbarEdit.col.track', descKey: 'toolbarEdit.col.track.desc', defaultWidth: 56},
    {key: 'year', labelKey: 'toolbarEdit.col.year', descKey: 'toolbarEdit.col.year.desc', defaultWidth: 48},
    {key: 'genre', labelKey: 'toolbarEdit.col.genre', descKey: 'toolbarEdit.col.genre.desc', defaultWidth: 80},
    {key: 'duration', labelKey: 'toolbarEdit.col.duration', descKey: 'toolbarEdit.col.duration.desc', defaultWidth: 64},
    {key: 'ext', labelKey: 'toolbarEdit.col.ext', descKey: 'toolbarEdit.col.ext.desc', defaultWidth: 48},
    {key: 'size', labelKey: 'toolbarEdit.col.size', descKey: 'toolbarEdit.col.size.desc', defaultWidth: 64},
    {key: 'mtime', labelKey: 'toolbarEdit.col.mtime', descKey: 'toolbarEdit.col.mtime.desc', defaultWidth: 120},
    {key: 'ctime', labelKey: 'toolbarEdit.col.ctime', descKey: 'toolbarEdit.col.ctime.desc', defaultWidth: 120},
];

export const DEFAULT_TOOLBAR_COLUMNS = ['name', 'artist', 'album', 'year', 'duration', 'ext', 'size', 'mtime'];

interface ToolbarEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    toolbarColumns: string[];
    setToolbarColumns: (cols: string[]) => void;
    accentColor: string;
    lang: Lang;
}

function ToolbarEditModal({
    isOpen,
    onClose,
    toolbarColumns,
    setToolbarColumns,
    accentColor,
    lang,
}: ToolbarEditModalProps) {
    const accent = getAccent(accentColor);

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    const toggleColumn = useCallback((key: string) => {
        if (key === 'name') return; // name is required and locked
        const exists = toolbarColumns.includes(key);
        if (exists) {
            setToolbarColumns(toolbarColumns.filter((c) => c !== key));
        } else {
            // Keep canonical order based on ALL_TOOLBAR_COLUMNS
            const next = ALL_TOOLBAR_COLUMNS
                .filter((c) => c.key === key || toolbarColumns.includes(c.key))
                .map((c) => c.key);
            setToolbarColumns(next);
        }
    }, [toolbarColumns, setToolbarColumns]);

    const resetToDefault = useCallback(() => {
        setToolbarColumns(DEFAULT_TOOLBAR_COLUMNS);
    }, [setToolbarColumns]);

    const activeCount = toolbarColumns.length;
    const totalCount = ALL_TOOLBAR_COLUMNS.length;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        {...backdropMotion}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/75 backdrop-blur-sm cursor-pointer"
                    />

                    {/* Dialog Container */}
                    <motion.div
                        {...modalContentMotion}
                        className="relative z-10 w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-zinc-900/95 border border-zinc-800 shadow-2xl shadow-black/80 overflow-hidden"
                    >
                        {/* 1. Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-950/40 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-xl ${accent.bg10} border ${accent.border500} flex items-center justify-center ${accent.text400} shadow-xs`}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="3" y="3" width="18" height="18" rx="2" />
                                        <path d="M9 3v18" />
                                        <path d="M15 3v18" />
                                    </svg>
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-base font-semibold text-zinc-100">
                                            {t(lang, 'toolbarEdit.title')}
                                        </h2>
                                        <span className={`text-[11px] px-2 py-0.5 rounded-full ${accent.bg10} ${accent.text400} border ${accent.border500} font-medium`}>
                                            {t(lang, 'toolbarEdit.visibleCount', {count: activeCount, total: totalCount})}
                                        </span>
                                    </div>
                                    <p className="text-xs text-zinc-400 mt-0.5">
                                        {t(lang, 'toolbarEdit.subtitle')}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* 2. Columns Selection Grid */}
                        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-2">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                {ALL_TOOLBAR_COLUMNS.map((col) => {
                                    const isChecked = col.required || toolbarColumns.includes(col.key);
                                    const isLocked = col.required;

                                    return (
                                        <div
                                            key={col.key}
                                            onClick={() => !isLocked && toggleColumn(col.key)}
                                            className={`flex items-center justify-between p-3 rounded-xl border transition-all select-none ${
                                                isLocked
                                                    ? 'bg-zinc-850/40 border-zinc-800/80 cursor-default opacity-85'
                                                    : isChecked
                                                    ? `${accent.bg10} border-zinc-700 hover:border-zinc-500 cursor-pointer shadow-xs`
                                                    : 'bg-zinc-900/60 border-zinc-800/60 hover:bg-zinc-850/60 hover:border-zinc-700 cursor-pointer'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3 min-w-0 pr-2">
                                                {/* Custom Checkbox */}
                                                <div
                                                    className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-colors border ${
                                                        isChecked
                                                            ? `${accent.bg600} ${accent.border500} text-white`
                                                            : 'bg-zinc-800/80 border-zinc-700 text-transparent'
                                                    }`}
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="20 6 9 17 4 12" />
                                                    </svg>
                                                </div>

                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-xs font-semibold truncate ${isChecked ? 'text-zinc-100' : 'text-zinc-400'}`}>
                                                            {t(lang, col.labelKey as any)}
                                                        </span>
                                                        {isLocked && (
                                                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 font-medium tracking-wide">
                                                                {t(lang, 'toolbarEdit.required')}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[11px] text-zinc-500 truncate mt-0.5">
                                                        {t(lang, col.descKey as any)}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Column Key Badge */}
                                            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-950/60 text-zinc-500 shrink-0 border border-zinc-800/50">
                                                {col.key}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 3. Footer Actions */}
                        <div className="flex items-center justify-between px-6 py-3.5 bg-zinc-950/80 border-t border-zinc-800/80 shrink-0">
                            <button
                                onClick={resetToDefault}
                                className="px-3 py-1.5 rounded-lg bg-zinc-850 hover:bg-zinc-750 text-zinc-400 hover:text-zinc-200 transition-colors text-xs font-medium cursor-pointer border border-zinc-800"
                            >
                                {t(lang, 'toolbarEdit.reset')}
                            </button>

                            <button
                                onClick={onClose}
                                className={`px-5 py-1.5 rounded-lg ${accent.bg600} hover:brightness-110 text-white transition-all text-xs font-semibold cursor-pointer shadow-sm active:scale-95`}
                            >
                                {t(lang, 'toolbarEdit.save')}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}

export default memo(ToolbarEditModal);
