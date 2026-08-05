'use client';

import {useEffect, useState} from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import {getAccent} from '../lib/colors';
import {t} from '../lib/translations';
import {modalContentMotion, backdropMotion} from '../lib/animations';
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
    pauseIfMuted,
    setPauseIfMuted,
    fadeAudio,
    setFadeAudio,
    fadeDuration,
    setFadeDuration,
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
    layoutMode = 'default',
    setLayoutMode,
    onResetSidebarWidth,
    onResetAllSettings,
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

    const sections = getSections(lang);

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    key="settings-backdrop"
                    {...backdropMotion}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm cursor-pointer"
                    onClick={onClose}
                >
                    <motion.div
                        key="settings-modal"
                        {...modalContentMotion}
                        className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl shadow-black/60 w-[min(900px,90vw)] h-[min(560px,80vh)] flex overflow-hidden cursor-default"
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
                                <button
                                    key={s.id}
                                    {...settingItemHover}
                                    onClick={() => setActiveSection(s.id)}
                                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left cursor-pointer ${isActive
                                        ? `${a.bg15} ${a.text400} border ${a.border500_20}`
                                        : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100 border border-transparent'
                                        }`}
                                >
                                    {s.icon}
                                    <span>{s.label}</span>
                                </button>
                            );
                        })}
                    </nav>

                    {/* Content */}
                    <div className="flex-1 flex flex-col">
                        <header className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-zinc-800">
                            <h2 className="text-lg font-semibold text-zinc-100">
                                {sections.find((s) => s.id === activeSection)?.label}
                            </h2>
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
                                        pauseIfMuted={pauseIfMuted}
                                        setPauseIfMuted={setPauseIfMuted}
                                        fadeAudio={fadeAudio}
                                        setFadeAudio={setFadeAudio}
                                        fadeDuration={fadeDuration}
                                        setFadeDuration={setFadeDuration}
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
                                    onResetAllSettings={onResetAllSettings}
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
                                     layoutMode={layoutMode}
                                     setLayoutMode={setLayoutMode}
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
            )}
        </AnimatePresence>
    );
}
