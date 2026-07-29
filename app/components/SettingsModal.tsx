'use client';

import {useEffect, useState} from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import {getAccent} from '../lib/colors';
import {t} from '../lib/translations';
import {useHoverDescription} from '../hooks/useHoverDescription';
import AboutSection from './settings/AboutSection';
import ChangelogSection from './settings/ChangelogSection';
import DebugSection from './settings/DebugSection';
import GeneralSection from './settings/GeneralSection';
import ShortcutSection from './settings/ShortcutSection';
import SortSection from './settings/SortSection';
import StyleSection from './settings/StyleSection';
import {getSections} from './settings/sectionsConfig';
import type {SectionId, SettingsModalProps} from './settings/types';

export type {LogEntry} from '../types/log';

export default function SettingsModal({
    lang,
    setLang,
    open,
    onClose,
    musicFolder,
    onChangeFolder,
    autoWallpaper,
    setAutoWallpaper,
    resetOnClose,
    setResetOnClose,
    volumeStep,
    setVolumeStep,
    volumeMode,
    setVolumeMode,
    volumeLimit,
    setVolumeLimit,
    volume,
    defaultWallpaper,
    onPickWallpaper,
    onClearWallpaper,
    folderSort,
    setFolderSort,
    fileSort,
    setFileSort,
    sortDir,
    setSortDir,
    nameSource,
    setNameSource,
    formats,
    setFormats,
    shortcuts,
    updateShortcut,
    resetShortcuts,
    accentColor,
    setAccentColor,
    customAccentHex,
    setCustomAccentHex,
    onResetSidebarWidth,
    logs,
    onCheckUpdate,
    updateStatus,
    updateChecking,
    updateDownloaded,
    updateTotal,
}: SettingsModalProps) {
    const [activeSection, setActiveSection] = useState<SectionId>('general');
    const closeHover = useHoverDescription(t(lang, 'status.closeSettings'));
    const settingItemHover = useHoverDescription(t(lang, 'status.settingItem'));

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open) return null;

    const sections = getSections(lang);

    return (
        <AnimatePresence>
            <motion.div
                key="backdrop"
                initial={{opacity: 0}}
                animate={{opacity: 1}}
                exit={{opacity: 0}}
                transition={{duration: 0.18}}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
                onClick={onClose}
            >
                <motion.div
                    key="modal"
                    initial={{opacity: 0, scale: 0.95, y: 10}}
                    animate={{opacity: 1, scale: 1, y: 0}}
                    exit={{opacity: 0, scale: 0.95, y: 10}}
                    transition={{duration: 0.2, ease: [0.16, 1, 0.3, 1]}}
                    className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl shadow-black/60 w-[min(900px,90vw)] h-[min(560px,80vh)] flex overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Sidebar nav */}
                    <nav className="w-36 lg:w-40 xl:w-44 border-r border-zinc-800 bg-zinc-950/60 p-2.5 md:p-3 flex flex-col gap-1 overflow-y-auto">
                        <h3 className="px-3 py-2 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                            {t(lang, 'settings.title')}
                        </h3>
                        {sections.map((s) => {
                            const isActive = s.id === activeSection;
                            const a = getAccent(accentColor);
                            return (
                                <motion.button
                                    key={s.id}
                                    {...settingItemHover}
                                    onClick={() => setActiveSection(s.id)}
                                    whileHover={{x: 2}}
                                    whileTap={{scale: 0.97}}
                                    transition={{duration: 0.15}}
                                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left cursor-pointer ${isActive
                                        ? `${a.bg15} ${a.text400} border ${a.border500_20}`
                                        : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100 border border-transparent'
                                        }`}
                                >
                                    {s.icon}
                                    <span>{s.label}</span>
                                </motion.button>
                            );
                        })}
                    </nav>

                    {/* Content */}
                    <div className="flex-1 flex flex-col">
                        <header className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-zinc-800">
                            <h2 className="text-lg font-semibold text-zinc-100">
                                {sections.find((s) => s.id === activeSection)?.label}
                            </h2>
                            <button
                                onClick={onClose}
                                {...closeHover}
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 transition-colors cursor-pointer"
                                aria-label={t(lang, 'settings.close')}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M18 6 6 18M6 6l12 12" />
                                </svg>
                            </button>
                        </header>
                        <div className="flex-1 overflow-y-auto p-4 md:p-6">
                            {activeSection === 'general' && (
                                    <GeneralSection
                                        lang={lang}
                                        setLang={setLang}
                                        musicFolder={musicFolder}
                                        onChangeFolder={onChangeFolder}
                                        autoWallpaper={autoWallpaper}
                                        setAutoWallpaper={setAutoWallpaper}
                                        resetOnClose={resetOnClose}
                                        setResetOnClose={setResetOnClose}
                                        volumeStep={volumeStep}
                                        setVolumeStep={setVolumeStep}
                                        volumeMode={volumeMode}
                                        setVolumeMode={setVolumeMode}
                                        volumeLimit={volumeLimit}
                                        setVolumeLimit={setVolumeLimit}
                                        volume={volume}
                                    defaultWallpaper={defaultWallpaper}
                                    onPickWallpaper={onPickWallpaper}
                                    onClearWallpaper={onClearWallpaper}
                                    accentColor={accentColor}
                                    onCheckUpdate={onCheckUpdate}
                                    updateStatus={updateStatus}
                                    updateChecking={updateChecking}
                                    updateDownloaded={updateDownloaded}
                                    updateTotal={updateTotal}
                                />
                            )}
                            {activeSection === 'sort' && (
                                <SortSection
                                    lang={lang}
                                    folderSort={folderSort}
                                    setFolderSort={setFolderSort}
                                    fileSort={fileSort}
                                    setFileSort={setFileSort}
                                    sortDir={sortDir}
                                    setSortDir={setSortDir}
                                    nameSource={nameSource}
                                    setNameSource={setNameSource}
                                    formats={formats}
                                    setFormats={setFormats}
                                />
                            )}
                            {activeSection === 'shortcut' && (
                                <ShortcutSection
                                    lang={lang}
                                    shortcuts={shortcuts}
                                    updateShortcut={updateShortcut}
                                    resetShortcuts={resetShortcuts}
                                    accentColor={accentColor}
                                />
                            )}
                            {activeSection === 'style' && (
                                <StyleSection
                                    lang={lang}
                                    accentColor={accentColor}
                                    setAccentColor={setAccentColor}
                                    customAccentHex={customAccentHex}
                                    setCustomAccentHex={setCustomAccentHex}
                                    onResetSidebarWidth={onResetSidebarWidth}
                                />
                            )}
                            {activeSection === 'changelog' && <ChangelogSection lang={lang} />}
                            {activeSection === 'about' && <AboutSection lang={lang} />}
                            {activeSection === 'debug' && <DebugSection lang={lang} logs={logs} />}
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
