'use client';

import {motion} from 'framer-motion';
import type {FileEntry} from '../FolderExplorer';
import type {SongMetadata} from '../PlayerPanel';
import {getAccent} from '../../lib/colors';
import {t, type Lang} from '../../lib/translations';

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
    onToggleLeftSidebar: () => void;
    onToggleRightSidebar: () => void;
}

export default function HomeHeader({
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
    onToggleLeftSidebar,
    onToggleRightSidebar,
}: HomeHeaderProps) {
    const accent = getAccent(accentColor);

    return (
        <header className="flex items-center justify-center px-5 py-3 border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-sm relative">
            <div className="absolute left-5 flex items-center gap-1.5">
                <motion.button
                    onClick={onOpenStreaming}
                    whileHover={{scale: 1.04}}
                    whileTap={{scale: 0.96}}
                    transition={{duration: 0.15}}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-800/50 hover:bg-zinc-700/60 text-zinc-300 hover:text-zinc-100 text-xs font-medium cursor-pointer"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 11a9 9 0 0 1 9 9" />
                        <path d="M4 4a16 16 0 0 1 16 16" />
                        <circle cx="5" cy="19" r="1" />
                    </svg>
                    {t(lang, 'header.streaming')}
                </motion.button>
                <motion.button
                    onClick={onOpenSettings}
                    whileHover={{scale: 1.04}}
                    whileTap={{scale: 0.96}}
                    transition={{duration: 0.15}}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-800/50 hover:bg-zinc-700/60 text-zinc-300 hover:text-zinc-100 text-xs font-medium cursor-pointer"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                        <circle cx="12" cy="12" r="3" />
                    </svg>
                    {t(lang, 'header.settings')}
                </motion.button>
            </div>
            {isCompact && musicFolder && (
                <div className="absolute left-27 flex items-center gap-1.5">
                    <motion.button
                        onClick={onToggleLeftSidebar}
                        whileHover={{scale: 1.05}}
                        whileTap={{scale: 0.92}}
                        className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${showLeftSidebar ? 'bg-zinc-700/70 text-zinc-200' : 'bg-zinc-800/50 text-zinc-500 hover:text-zinc-300'}`}
                        title={t(lang, 'header.toggleList')}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 3h18v18H3z" />
                            <path d="M8 3v18" />
                        </svg>
                        {t(lang, 'header.listLabel')}
                    </motion.button>
                    <motion.button
                        onClick={onToggleRightSidebar}
                        whileHover={{scale: 1.05}}
                        whileTap={{scale: 0.92}}
                        className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${showRightSidebar ? 'bg-zinc-700/70 text-zinc-200' : 'bg-zinc-800/50 text-zinc-500 hover:text-zinc-300'}`}
                        title={t(lang, 'header.toggleInfo')}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 16v-4M12 8h.01" />
                        </svg>
                        {t(lang, 'header.infoLabel')}
                    </motion.button>
                </div>
            )}
            <h1 className="text-lg font-bold tracking-tight text-zinc-100 truncate max-w-[40%]">
                {selectedSong
                    ? (metadata?.title || selectedSong.name.replace(/\.[^.]+$/, ''))
                    : t(lang, 'about.title')}
            </h1>
            <motion.span
                key={isPlaying ? 'playing' : 'stopped'}
                initial={{scale: 0.9, opacity: 0}}
                animate={{scale: 1, opacity: 1}}
                transition={{duration: 0.2}}
                className={`text-[11px] font-medium px-2.5 py-1 rounded-full absolute right-5 flex items-center gap-1.5 ${isPlaying ? `${accent.bg15} ${accent.text400} border ${accent.border500_20}` : 'bg-zinc-800/50 text-zinc-500 border border-zinc-700/30'
                    }`}
            >
                {isPlaying ? (
                    <>
                        <motion.span
                            className={`inline-block w-1.5 h-1.5 rounded-full ${accent.bg400}`}
                            animate={{scale: [1, 1.4, 1], opacity: [1, 0.5, 1]}}
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
    );
}
