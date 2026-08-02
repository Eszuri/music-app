'use client';

import {memo} from 'react';
import {motion} from 'framer-motion';
import {useCallback, useState} from 'react';
import type {FileEntry} from '../FolderExplorer';
import type {SongMetadata} from '../PlayerPanel';
import {getAccent} from '../../lib/colors';
import {t, type Lang} from '../../lib/translations';
import {contentMotion} from '../../lib/animations';
import ContextMenu, {type ContextMenuItem} from '../ContextMenu';
import {StreamingIcon, SettingsIcon, EQIcon, EditIcon} from '../icons';
import {getTauri} from '../../lib/homeState';
import {useHoverDescription} from '../../hooks/useHoverDescription';

interface HomeHeaderProps {
    lang: Lang;
    isCompact: boolean;
    musicFolder: string | null;
    selectedSong: FileEntry | null;
    metadata: SongMetadata | null;
    isPlaying: boolean;
    showLeftSidebar: boolean;
    showRightSidebar: boolean;
    accentColor: string;
    onOpenStreaming: () => void;
    onOpenSettings: () => void;
    onOpenEqualizer?: () => void;
    onOpenEditMetadata?: () => void;
    onToggleLeftSidebar: () => void;
    onToggleRightSidebar: () => void;
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

function HomeHeader({
    lang,
    isCompact,
    musicFolder,
    selectedSong,
    metadata,
    isPlaying,
    showLeftSidebar,
    showRightSidebar,
    accentColor,
    onOpenStreaming,
    onOpenSettings,
    onOpenEqualizer,
    onOpenEditMetadata,
    onToggleLeftSidebar,
    onToggleRightSidebar,
    onGlobalContextMenu,
}: HomeHeaderProps) {
    const accent = getAccent(accentColor);
    const eqHover = useHoverDescription(t(lang, 'equalizer.title'));
    const editMetaHover = useHoverDescription('Edit Metadata');

    const [contextMenu, setContextMenu] = useState<{x: number; y: number; items: ContextMenuItem[]} | null>(null);
    const hideContextMenu = useCallback(() => setContextMenu(null), []);

    const showStreamingMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const items: ContextMenuItem[] = [
            {
                label: t(lang, 'contextMenu.openStreaming'),
                icon: (
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 11a9 9 0 0 1 9 9" />
                        <path d="M4 4a16 16 0 0 1 16 16" />
                        <circle cx="5" cy="19" r="1" />
                    </svg>
                ),
                onClick: onOpenStreaming,
            },
        ];
        setContextMenu({x: e.clientX, y: e.clientY, items: [...items, ...appendDevTools(items, lang)]});
    }, [lang, onOpenStreaming]);

    const showSettingsMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const items: ContextMenuItem[] = [
            {
                label: t(lang, 'contextMenu.openSettings'),
                icon: (
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                        <circle cx="12" cy="12" r="3" />
                    </svg>
                ),
                onClick: onOpenSettings,
            },
        ];
        setContextMenu({x: e.clientX, y: e.clientY, items: [...items, ...appendDevTools(items, lang)]});
    }, [lang, onOpenSettings]);

    const streamingHover = useHoverDescription(t(lang, 'status.streaming'));
    const settingsHover = useHoverDescription(t(lang, 'status.settings'));
    const leftSidebarHover = useHoverDescription(t(lang, 'status.toggleLeftSidebar'));
    const rightSidebarHover = useHoverDescription(t(lang, 'status.toggleRightSidebar'));
    const titleHover = useHoverDescription(t(lang, 'status.headerTitle'));
    const playStatusHover = useHoverDescription(t(lang, 'status.playStatus'));

    return (
        <>
            <header onContextMenu={onGlobalContextMenu} className="flex items-center px-3 sm:px-5 py-2.5 sm:py-3 border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-sm relative gap-2">
                <div className="flex items-center gap-1.5 shrink-0">
                    <button
                        {...streamingHover}
                        onClick={onOpenStreaming}
                        onContextMenu={showStreamingMenu}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-800/50 hover:bg-zinc-700/60 text-zinc-300 hover:text-zinc-100 text-xs font-medium cursor-pointer transition-colors"
                        title={t(lang, 'header.streaming')}
                    >
                        <StreamingIcon size={14} />
                        <span className="hidden lg:inline">{t(lang, 'header.streaming')}</span>
                    </button>

                    <button
                        {...settingsHover}
                        onClick={onOpenSettings}
                        onContextMenu={showSettingsMenu}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-800/50 hover:bg-zinc-700/60 text-zinc-300 hover:text-zinc-100 text-xs font-medium cursor-pointer transition-colors"
                        title={t(lang, 'header.settings')}
                    >
                        <SettingsIcon size={14} />
                        <span className="hidden lg:inline">{t(lang, 'header.settings')}</span>
                    </button>

                    {onOpenEqualizer && (
                        <button
                            {...eqHover}
                            onClick={onOpenEqualizer}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-800/50 hover:bg-zinc-700/60 text-zinc-300 hover:text-zinc-100 text-xs font-medium cursor-pointer transition-colors"
                            title={t(lang, 'equalizer.title')}
                        >
                            <EQIcon size={14} />
                            <span className="hidden lg:inline">{t(lang, 'equalizer.title')}</span>
                        </button>
                    )}

                    {onOpenEditMetadata && (
                        <button
                            {...editMetaHover}
                            onClick={onOpenEditMetadata}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-800/50 hover:bg-zinc-700/60 text-zinc-300 hover:text-zinc-100 text-xs font-medium cursor-pointer transition-colors"
                            title={t(lang, 'contextMenu.editMetadata')}
                        >
                            <EditIcon size={14} />
                            <span className="hidden lg:inline">{t(lang, 'contextMenu.editMetadata')}</span>
                        </button>
                    )}
                    {isCompact && musicFolder && (
                        <>
                            <div className="w-px h-5 bg-zinc-800/60 mx-0.5" />
                            <button
                                {...leftSidebarHover}
                                onClick={onToggleLeftSidebar}
                                className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${showLeftSidebar ? 'bg-zinc-700/70 text-zinc-200' : 'bg-zinc-800/50 text-zinc-500 hover:text-zinc-300'}`}
                                title={t(lang, 'header.toggleList')}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M3 3h18v18H3z" />
                                    <path d="M8 3v18" />
                                </svg>
                                <span className="hidden sm:inline">{t(lang, 'header.listLabel')}</span>
                            </button>
                            <button
                                {...rightSidebarHover}
                                onClick={onToggleRightSidebar}
                                className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${showRightSidebar ? 'bg-zinc-700/70 text-zinc-200' : 'bg-zinc-800/50 text-zinc-500 hover:text-zinc-300'}`}
                                title={t(lang, 'header.toggleInfo')}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" />
                                    <path d="M12 16v-4M12 8h.01" />
                                </svg>
                                <span className="hidden sm:inline">{t(lang, 'header.infoLabel')}</span>
                            </button>
                        </>
                    )}
                </div>
                {/* Title & status — show global context menu on right-click */}
                <h1
                    {...titleHover}
                    onContextMenu={onGlobalContextMenu}
                    className="flex-1 text-center text-base sm:text-lg font-bold tracking-tight text-zinc-100 truncate min-w-0 cursor-default"
                >
                    {selectedSong
                        ? (metadata?.title || selectedSong.name.replace(/\.[^.]+$/, ''))
                        : t(lang, 'about.title')}
                </h1>
                <motion.span
                    {...playStatusHover}
                    onContextMenu={onGlobalContextMenu}
                    key={isPlaying ? 'playing' : 'stopped'}
                    {...contentMotion}
                    className={`text-[11px] font-medium px-2 sm:px-2.5 py-1 rounded-full flex items-center gap-1 sm:gap-1.5 shrink-0 ${isPlaying ? `${accent.bg15} ${accent.text400} border ${accent.border500_20}` : 'bg-zinc-800/50 text-zinc-500 border border-zinc-700/30'
                        }`}
                >
                    {isPlaying ? (
                        <>
                            <motion.span
                                className={`inline-block w-1.5 h-1.5 rounded-full ${accent.bg400}`}
                                animate={{opacity: [1, 0.5, 1]}}
                                transition={{duration: 1.2, repeat: Infinity, ease: 'easeInOut'}}
                            />
                            {t(lang, 'header.playing')}
                        </>
                    ) : (
                        <>
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-zinc-500" />
                            {t(lang, 'header.stopped')}
                        </>
                    )}
                </motion.span>
            </header>

            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    items={contextMenu.items}
                    onClose={hideContextMenu}
                />
            )}
        </>
    );
}
export default memo(HomeHeader);
