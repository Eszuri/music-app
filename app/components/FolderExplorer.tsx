'use client';

import React, {memo, useCallback, useEffect, useRef, useState} from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import {getAccent} from '../lib/colors';
import {t, type Lang} from '../lib/translations';
import {contentMotion} from '../lib/animations';
import ContextMenu, {ContextMenuItem} from './ContextMenu';
import {useHoverInfo} from '../contexts/HoverInfoContext';
import {useHoverDescription} from '../hooks/useHoverDescription';

export interface FileEntry {
    name: string;
    path: string;
    is_dir: boolean;
    ext: string;
    mtime: number;
    size: number;
    ctime: number;
    display_name: string;
    sort_key: string;
}

interface FolderExplorerProps {
    lang: Lang;
    files: FileEntry[];
    loading: boolean;
    selectedSong: FileEntry | null;
    playingAncestorPrefix: string | null;
    displayPath: string;
    debugError?: string;
    goUp: () => void;
    setCurrentPath: (path: string) => void;
    playSong: (file: FileEntry, skipWallpaper?: boolean) => void;
    onChangeFolder: () => void;
    musicFolder: string | null;
    resetSidebarToken: number;
    accentColor: string;
    onContextDir?: (e: React.MouseEvent, file: FileEntry) => void;
    onContextFile?: (e: React.MouseEvent, file: FileEntry) => void;
    onGlobalContextMenu?: (e: React.MouseEvent) => void;
}

function isAncestorOf(folderPath: string, targetPath: string): boolean {
    const f = folderPath.toLowerCase();
    const t = targetPath.toLowerCase();
    if (f === t) return false;
    return t.startsWith(f + '\\') || t.startsWith(f + '/');
}

const MIN_WIDTH = 160;
const MAX_WIDTH = 640;
const DEFAULT_WIDTH = 288;
const STORAGE_KEY = 'music-app-sidebar-width';
const ROW_HEIGHT = 36;
const VIRTUAL_BUFFER = 5;

function loadSavedWidth(): number {
    if (typeof window === 'undefined') return DEFAULT_WIDTH;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_WIDTH;
    const n = Number(raw);
    if (!Number.isFinite(n)) return DEFAULT_WIDTH;
    return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, n));
}

function FolderExplorer({
    lang,
    files,
    loading,
    selectedSong,
    playingAncestorPrefix,
    displayPath,
    debugError,
    goUp,
    setCurrentPath,
    playSong,
    onChangeFolder,
    musicFolder,
    resetSidebarToken,
    accentColor,
    onContextDir,
    onContextFile,
    onGlobalContextMenu,
}: FolderExplorerProps) {
    const accent = getAccent(accentColor);
    const [width, setWidth] = useState<number>(DEFAULT_WIDTH);
    const {setHoverInfo} = useHoverInfo();
    const [contextMenu, setContextMenu] = useState<{x: number; y: number; items: ContextMenuItem[]} | null>(null);
    const isDraggingRef = useRef(false);
    const startXRef = useRef(0);
    const startWidthRef = useRef(DEFAULT_WIDTH);
    const widthPendingRef = useRef<number | null>(null);

    const scrollRef = useRef<HTMLDivElement | null>(null);
    const [scrollTop, setScrollTop] = useState(0);
    const [viewportH, setViewportH] = useState(0);
    const lastFilesRef = useRef<FileEntry[]>(files);

    const goUpHover = useHoverDescription(t(lang, 'status.goUp'));
    const pathHover = useHoverDescription(t(lang, 'status.pathName'));
    const changeFolderHover = useHoverDescription(t(lang, 'status.changeFolder'));

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        setViewportH(el.clientHeight);
        const ro = new ResizeObserver(() => setViewportH(el.clientHeight));
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    useEffect(() => {
        if (lastFilesRef.current !== files) {
            lastFilesRef.current = files;
            if (scrollRef.current) scrollRef.current.scrollTop = 0;
            setScrollTop(0);
        }
    });

    useEffect(() => {
        setWidth(loadSavedWidth());
    }, []);

    useEffect(() => {
        if (resetSidebarToken === 0) return;
        setWidth(DEFAULT_WIDTH);
        window.localStorage.removeItem(STORAGE_KEY);
    }, [resetSidebarToken]);

    useEffect(() => {
        const handleWindowResize = () => {
            const currentWinW = window.innerWidth;
            const metaWidth = typeof window !== 'undefined'
                ? Number(window.localStorage.getItem('music-app-meta-width') || 320)
                : 320;
            const maxAllowed = Math.max(MIN_WIDTH, currentWinW - metaWidth - 300);
            const effectiveMax = Math.min(MAX_WIDTH, maxAllowed);
            setWidth(prev => (prev > effectiveMax ? effectiveMax : prev));
        };
        window.addEventListener('resize', handleWindowResize);
        return () => window.removeEventListener('resize', handleWindowResize);
    }, []);

    const onMouseMove = useCallback((e: MouseEvent) => {
        if (!isDraggingRef.current) return;
        const delta = e.clientX - startXRef.current;
        const currentWinW = window.innerWidth;
        const metaWidth = typeof window !== 'undefined'
            ? Number(window.localStorage.getItem('music-app-meta-width') || 320)
            : 320;
        const maxAllowed = Math.max(MIN_WIDTH, currentWinW - metaWidth - 300);
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

    return (
        <aside
            style={{width}}
            className="relative flex shrink-0 flex-col border-r border-zinc-800/50 bg-black/30 max-lg:flex-1 max-lg:min-w-0 overflow-hidden"
        >
            {/* Toolbar header */}
            <div
                onContextMenu={onGlobalContextMenu}
                className="flex items-center gap-2 px-3 py-2.5 border-b border-zinc-800/30"
            >
                <button
                    {...goUpHover}
                    onClick={goUp}
                    onContextMenu={(e: React.MouseEvent) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setContextMenu({
                            x: e.clientX,
                            y: e.clientY,
                            items: [
                                {
                                    label: t(lang, 'folder.goUp'),
                                    icon: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>,
                                    onClick: goUp,
                                    disabled: displayPath === musicFolder
                                }
                            ]
                        });
                    }}
                    title={t(lang, 'folder.goUp')}
                    className={`flex items-center justify-center w-7 h-7 rounded-lg bg-zinc-800/50 hover:bg-zinc-700/60 
        text-zinc-400 hover:text-zinc-100 shrink-0 ${displayPath === musicFolder ? 'invisible pointer-events-none' : 'cursor-pointer'}`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m15 18-6-6 6-6" />
                    </svg>
                </button>
                <span
                    {...pathHover}
                    onContextMenu={(e: React.MouseEvent) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setContextMenu({
                            x: e.clientX,
                            y: e.clientY,
                            items: [
                                {
                                    label: t(lang, 'contextMenu.copyPath'),
                                    icon: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>,
                                    onClick: () => {
                                        if (displayPath) navigator.clipboard.writeText(displayPath);
                                    },
                                    disabled: !displayPath
                                }
                            ]
                        });
                    }}
                    className="text-xs text-zinc-500 truncate flex-1 cursor-default"
                    title={displayPath}
                >
                    {displayPath}
                </span>
                <button
                    {...changeFolderHover}
                    onClick={onChangeFolder}
                    onContextMenu={(e: React.MouseEvent) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setContextMenu({
                            x: e.clientX,
                            y: e.clientY,
                            items: [
                                {
                                    label: t(lang, 'folder.changeFolder', {folder: musicFolder || ''}),
                                    icon: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 12h6M12 9l3 3-3 3" /></svg>,
                                    onClick: onChangeFolder
                                }
                            ]
                        });
                    }}
                    title={t(lang, 'folder.changeFolder', {folder: musicFolder || ''})}
                    className="flex items-center justify-center w-7 h-7 rounded-lg bg-zinc-800/50 hover:bg-zinc-700/60 
        text-zinc-400 hover:text-zinc-100 cursor-pointer shrink-0"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                        <path d="M9 12h6M12 9l3 3-3 3" />
                    </svg>
                </button>
            </div>
            {/* File list scroll area — global context menu on empty scroll space */}
            <div
                ref={scrollRef}
                onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
                onContextMenu={onGlobalContextMenu}
                className="flex-1 overflow-y-auto"
            >
                <AnimatePresence mode="wait" initial={false}>
                    {loading ? (
                        <motion.div
                            key="skeleton"
                            {...contentMotion}
                            className="py-1"
                        >
                            <SkeletonList accentHex={accent.hex400} />
                        </motion.div>
                    ) : files.length === 0 ? (
                        <motion.div
                            key="empty"
                            {...contentMotion}
                            className="p-4 text-zinc-600 text-center"
                        >
                            {t(lang, 'folder.empty')}
                        </motion.div>
                    ) : (
                        <VirtualList
                            lang={lang}
                            files={files}
                            scrollTop={scrollTop}
                            viewportH={viewportH}
                            selectedPath={selectedSong?.path ?? null}
                            playingAncestorPrefix={playingAncestorPrefix}
                            onPick={playSong}
                            onEnterDir={setCurrentPath}
                            onContextDir={onContextDir}
                            onContextFile={onContextFile}
                            accentBg10={accent.bg10}
                            accentText400={accent.text400}
                            accentBorder500={accent.border500}
                            accentBg30={accent.bg30}
                        />
                    )}
                </AnimatePresence>

            </div>
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
                className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize transition-colors max-lg:hidden"
            />
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

const VirtualList = memo(function VirtualList({
    lang,
    files,
    scrollTop,
    viewportH,
    selectedPath,
    playingAncestorPrefix,
    onPick,
    onEnterDir,
    onContextDir,
    onContextFile,
    accentBg10,
    accentText400,
    accentBorder500,
    accentBg30,
}: {
    lang: Lang;
    files: FileEntry[];
    scrollTop: number;
    viewportH: number;
    selectedPath: string | null;
    playingAncestorPrefix: string | null;
    onPick: (file: FileEntry) => void;
    onEnterDir: (path: string) => void;
    onContextDir?: (e: React.MouseEvent, file: FileEntry) => void;
    onContextFile?: (e: React.MouseEvent, file: FileEntry) => void;
    accentBg10: string;
    accentText400: string;
    accentBorder500: string;
    accentBg30: string;
}) {
    const {setHoverInfo} = useHoverInfo();
    const totalH = files.length * ROW_HEIGHT;
    const visibleCount = viewportH > 0 ? Math.ceil(viewportH / ROW_HEIGHT) : 20;
    let startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - VIRTUAL_BUFFER);
    const endIdx = Math.min(files.length, startIdx + visibleCount + VIRTUAL_BUFFER * 2);
    if (endIdx - startIdx < visibleCount + VIRTUAL_BUFFER * 2) {
        startIdx = Math.max(0, endIdx - (visibleCount + VIRTUAL_BUFFER * 2));
    }
    const topPad = startIdx * ROW_HEIGHT;
    const bottomPad = totalH - endIdx * ROW_HEIGHT;
    const slice = files.slice(startIdx, endIdx);

    return (
        <motion.div
            {...contentMotion}
            className="relative"
            style={{height: totalH}}
        >
            <div style={{height: topPad}} />
            {slice.map((file) => {
                const isSelected = selectedPath === file.path;
                const isPlayingAncestor =
                    file.is_dir &&
                    !isSelected &&
                    playingAncestorPrefix != null &&
                    isAncestorOf(file.path, playingAncestorPrefix);
                let rowClass: string;
                let titleAttr: string | undefined;
                if (isSelected) {
                    rowClass = `${accentBg10} ${accentText400} border-l-2 ${accentBorder500}`;
                } else if (isPlayingAncestor) {
                    rowClass = `${accentBg30} ${accentText400} border-l-2 ${accentBorder500}`;
                    titleAttr = t(lang, 'folder.playingAncestor');
                } else {
                    rowClass = 'text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200 border-l-2 border-transparent';
                }
                return (
                    <button
                        key={file.path}
                        onMouseEnter={() => setHoverInfo(t(lang, file.is_dir ? 'status.folderRow' : 'status.fileRow'))}
                        onMouseLeave={() => setHoverInfo(null)}
                        onClick={() => file.is_dir ? onEnterDir(file.path) : onPick(file)}
                        onContextMenu={(e) => {
                            if (file.is_dir) {
                                if (onContextDir) onContextDir(e, file);
                            } else {
                                if (onContextFile) onContextFile(e, file);
                            }
                        }}
                        title={titleAttr}
                        className={`w-full flex items-center gap-2.5 px-3 text-sm text-left cursor-pointer transition-colors duration-100 ${rowClass}`}
                        style={{height: ROW_HEIGHT}}
                    >
                        <span className="shrink-0 text-[10px]">
                            {file.is_dir ? (isPlayingAncestor ? '▶' : '📁') : isSelected ? '▶' : '🎵'}
                        </span>
                        <span className="truncate">{file.display_name}</span>
                    </button>
                );
            })}
            <div style={{height: Math.max(0, bottomPad)}} />
        </motion.div>
    );
});

function SkeletonList({accentHex}: {accentHex: string}) {
    const widths = ['w-10/12', 'w-8/12', 'w-11/12', 'w-9/12', 'w-7/12', 'w-10/12', 'w-9/12', 'w-8/12'];
    return (
        <motion.div
            initial="hidden"
            animate="show"
            variants={{
                hidden: {},
                show: {transition: {staggerChildren: 0.04}},
            }}
        >
            {widths.map((w, i) => (
                <motion.div
                    key={i}
                    variants={{
                        hidden: {opacity: 0, y: 8},
                        show: {opacity: 1, y: 0},
                    }}
                    transition={{duration: 0.25, ease: 'easeInOut'}}
                    className="flex items-center gap-2.5 px-3 py-2 border-l-2 border-transparent"
                >
                    <span className="shrink-0 w-3 h-3 rounded-sm bg-zinc-800/70" />
                    <span
                        className={`relative overflow-hidden h-3 rounded ${w} bg-zinc-800/70`}
                    >
                        <motion.span
                            className="absolute inset-x-0 -top-1/2 h-1/2"
                            style={{
                                background: `linear-gradient(0deg, transparent, ${accentHex}33, transparent)`,
                            }}
                            animate={{y: ['0%', '300%']}}
                            transition={{
                                duration: 1.4,
                                repeat: Infinity,
                                ease: 'easeInOut',
                                delay: i * 0.08,
                            }}
                        />
                    </span>
                </motion.div>
            ))}
        </motion.div>
    );
}

export default memo(FolderExplorer);
