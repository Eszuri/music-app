'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import { t, type Lang } from '../lib/translations';
import { useAiLyricsPlugin } from '../hooks/useAiLyricsPlugin';
import { isBrowserTauri, getTauri } from '../lib/homeState';
import { getAccent } from '../lib/colors';

export interface AiModelSpec {
    code: string;
    label: string;
    sizeText: string;
    descId: string;
    descEn: string;
    minRamGb: number;
    minCpuCores: number;
}

const AI_MODELS: AiModelSpec[] = [
    {
        code: 'tiny',
        label: 'Tiny',
        sizeText: '74 MB',
        descId: 'Paling ringan & cepat',
        descEn: 'Ultra fast & lightweight',
        minRamGb: 2,
        minCpuCores: 2,
    },
    {
        code: 'base',
        label: 'Base',
        sizeText: '141 MB',
        descId: 'Seimbang & efisien',
        descEn: 'Balanced & efficient',
        minRamGb: 4,
        minCpuCores: 2,
    },
    {
        code: 'small',
        label: 'Small',
        sizeText: '465 MB',
        descId: 'Akurasi tinggi untuk lagu kompleks',
        descEn: 'High accuracy for complex songs',
        minRamGb: 6,
        minCpuCores: 4,
    },
    {
        code: 'medium',
        label: 'Medium',
        sizeText: '1.46 GB',
        descId: 'Presisi sangat tinggi',
        descEn: 'Very high precision',
        minRamGb: 8,
        minCpuCores: 4,
    },
    {
        code: 'large-v3-turbo',
        label: 'Large v3 Turbo',
        sizeText: '1.54 GB',
        descId: 'Ultra presisi generasi terbaru',
        descEn: 'Next-gen ultra precision',
        minRamGb: 12,
        minCpuCores: 6,
    },
    {
        code: 'large-v3',
        label: 'Large v3',
        sizeText: '2.95 GB',
        descId: 'Kualitas studio maksimal',
        descEn: 'Maximum studio quality',
        minRamGb: 16,
        minCpuCores: 8,
    },
];

interface AiLyricsModalProps {
    isOpen: boolean;
    onClose: () => void;
    lang: Lang;
    initialTitle?: string;
    initialArtist?: string;
    accentColor: string;
    songPath?: string;
    onSelectLyric?: (lrcContent: string) => void;
}

export function AiLyricsModal({
    isOpen,
    onClose,
    lang,
    initialTitle = '',
    initialArtist = '',
    accentColor,
    songPath,
    onSelectLyric,
}: AiLyricsModalProps) {
    const mouseDownOnBackdropRef = useRef<boolean>(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    const [selectedAiModel, setSelectedAiModel] = useState<string>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('symvonia_ai_lyrics_model') || 'base';
        }
        return 'base';
    });

    const [isolateVocals, setIsolateVocals] = useState<boolean>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('symvonia_ai_isolate_vocals');
            if (saved !== null) return saved === 'true';
        }
        return false;
    });

    const [systemSpecs, setSystemSpecs] = useState<{ ramGb: number; cpuCores: number }>(() => {
        if (typeof navigator !== 'undefined') {
            const cpuCores = navigator.hardwareConcurrency || 4;
            const ramGb = (navigator as unknown as { deviceMemory?: number }).deviceMemory || 8;
            return { ramGb, cpuCores };
        }
        return { ramGb: 8, cpuCores: 4 };
    });

    useEffect(() => {
        if (!isOpen || !isBrowserTauri) return;
        let isMounted = true;
        getTauri()
            .then((mod) => mod.invoke<{ ramGb: number; cpuCores: number }>('get_system_specs'))
            .then((specs) => {
                if (isMounted && specs) setSystemSpecs(specs);
            })
            .catch(() => {});
        return () => {
            isMounted = false;
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (isDropdownOpen) {
                    setIsDropdownOpen(false);
                } else {
                    onClose();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, isDropdownOpen, onClose]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        if (isDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isDropdownOpen]);

    const selectedModelInfo = AI_MODELS.find((m) => m.code === selectedAiModel) || AI_MODELS[1];
    const isRamLow = systemSpecs.ramGb < selectedModelInfo.minRamGb;
    const isCpuLow = systemSpecs.cpuCores < selectedModelInfo.minCpuCores;
    const isLowSpecsWarning = isRamLow || isCpuLow;

    const {
        pluginStatus: aiStatus,
        isDownloading: isAiDownloading,
        isGenerating: isAiGenerating,
        modelDownloadProgress: aiModelProgress,
        generateProgress: aiGenerateProgress,
        downloadedModels,
        downloadPlugin: downloadAiPlugin,
        generateLyrics: generateAiLyrics,
        cancelGeneration: cancelAiGeneration,
    } = useAiLyricsPlugin();

    const handleGenerateAiLyrics = async () => {
        if (!songPath) return;
        try {
            const lrcContent = await generateAiLyrics(songPath, selectedAiModel, 'auto', isolateVocals);
            if (lrcContent) {
                onSelectLyric?.(lrcContent);
                onClose();
            }
        } catch {
            // Errors handled in hook
        }
    };

    const isCurrentModelDownloaded = downloadedModels.includes(selectedAiModel);
    const accent = getAccent(accentColor);
    const accentHex = accentColor.startsWith('#')
        ? accentColor
        : (accent?.hex500 || '#0284c7');

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
                    onMouseDown={(e) => {
                        mouseDownOnBackdropRef.current = e.target === e.currentTarget;
                    }}
                    onMouseUp={(e) => {
                        if (mouseDownOnBackdropRef.current && e.target === e.currentTarget) {
                            onClose();
                        }
                        mouseDownOnBackdropRef.current = false;
                    }}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: 8 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="bg-zinc-950/95 border border-zinc-800/80 rounded-2xl w-full max-w-2xl min-h-[520px] shadow-2xl shadow-black/80 flex flex-col justify-between text-zinc-100 select-none relative max-h-[88vh]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4.5 border-b border-zinc-800/70 bg-zinc-900/40 rounded-t-2xl shrink-0">
                            <div className="flex items-center gap-3.5 min-w-0">
                                <div
                                    className="w-10 h-10 rounded-xl flex items-center justify-center bg-zinc-900 border border-zinc-800 shrink-0 transition-colors"
                                    style={{ color: accentHex }}
                                >
                                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z" />
                                    </svg>
                                </div>
                                <div className="min-w-0">
                                    <h2 className="text-base font-semibold tracking-tight text-zinc-100">
                                        {t(lang, 'lyrics.aiPlugin.title')}
                                    </h2>
                                    <p className="text-xs text-zinc-400 truncate max-w-[460px]">
                                        {initialTitle ? `${initialTitle}${initialArtist ? ` • ${initialArtist}` : ''}` : t(lang, 'lyrics.aiPlugin.desc')}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 transition-colors cursor-pointer shrink-0"
                                aria-label="Close"
                            >
                                <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 sm:p-7 space-y-5 flex-1 flex flex-col justify-between overflow-y-auto">
                            {/* Model Selection Row (Relative with Z-index) */}
                            <div className="space-y-2 relative z-30" ref={dropdownRef}>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-semibold text-zinc-200 text-xs">
                                        {t(lang, 'lyrics.aiPlugin.modelLabel')}
                                    </span>
                                    <span className="text-[11px] font-mono text-zinc-300 bg-zinc-900 border border-zinc-800/80 px-2.5 py-1 rounded-md flex items-center gap-1.5 shadow-xs">
                                        <span className="text-zinc-400 font-sans font-medium">
                                            {lang === 'id' ? 'Sistem Komputer Ini:' : 'This PC:'}
                                        </span>
                                        <span className="font-semibold text-zinc-200">
                                            {systemSpecs.ramGb}GB RAM • {systemSpecs.cpuCores} Core
                                        </span>
                                    </span>
                                </div>

                                {/* Custom Dropdown Trigger */}
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setIsDropdownOpen((prev) => !prev)}
                                        className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl bg-zinc-900/90 border text-left transition-all cursor-pointer ${
                                            isDropdownOpen
                                                ? 'border-zinc-500 bg-zinc-900 shadow-md ring-1 ring-zinc-500/40'
                                                : 'border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <span className="text-sm font-semibold text-zinc-100">
                                                {selectedModelInfo.label}
                                            </span>
                                            <span className="text-xs font-mono text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded">
                                                {selectedModelInfo.sizeText}
                                            </span>
                                            <span className="text-xs text-zinc-400 truncate hidden sm:inline">
                                                • {lang === 'id' ? selectedModelInfo.descId : selectedModelInfo.descEn}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2.5 shrink-0 ml-2">
                                            {isCurrentModelDownloaded ? (
                                                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                                    {t(lang, 'lyrics.aiPlugin.tagDownloaded')}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 bg-zinc-800/60 px-2.5 py-1 rounded-md border border-zinc-700/40">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                                                    {t(lang, 'lyrics.aiPlugin.tagNotDownloaded')}
                                                </span>
                                            )}
                                            <svg
                                                className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${
                                                    isDropdownOpen ? 'rotate-180 text-zinc-200' : ''
                                                }`}
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <polyline points="6 9 12 15 18 9" />
                                            </svg>
                                        </div>
                                    </button>

                                    {/* Dropdown Options Popup */}
                                    <AnimatePresence>
                                        {isDropdownOpen && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                                                transition={{ duration: 0.15, ease: 'easeOut' }}
                                                className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-zinc-900 border border-zinc-700/80 rounded-xl shadow-2xl shadow-black overflow-hidden max-h-72 overflow-y-auto p-1.5 divide-y divide-zinc-800/60"
                                            >
                                                {AI_MODELS.map((m) => {
                                                    const isSelected = m.code === selectedAiModel;
                                                    const isDownloaded = downloadedModels.includes(m.code);
                                                    const isHeavy = systemSpecs.ramGb < m.minRamGb || systemSpecs.cpuCores < m.minCpuCores;

                                                    return (
                                                        <button
                                                            key={m.code}
                                                            type="button"
                                                            onClick={() => {
                                                                setSelectedAiModel(m.code);
                                                                if (typeof window !== 'undefined') {
                                                                    localStorage.setItem('symvonia_ai_lyrics_model', m.code);
                                                                }
                                                                setIsDropdownOpen(false);
                                                            }}
                                                            className={`w-full px-3.5 py-3 rounded-lg text-left transition-colors flex items-center justify-between gap-3 cursor-pointer ${
                                                                isSelected
                                                                    ? 'bg-zinc-800 text-zinc-100 font-medium'
                                                                    : 'text-zinc-300 hover:bg-zinc-800/60 hover:text-zinc-100'
                                                            }`}
                                                        >
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-xs font-semibold text-zinc-100">
                                                                        {m.label}
                                                                    </span>
                                                                    <span className="text-[11px] font-mono text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded">
                                                                        {m.sizeText}
                                                                    </span>
                                                                </div>
                                                                <p className="text-xs text-zinc-400 truncate mt-0.5">
                                                                    {lang === 'id' ? m.descId : m.descEn}
                                                                </p>
                                                            </div>

                                                            <div className="flex items-center gap-2.5 shrink-0">
                                                                {isHeavy && (
                                                                    <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                                                                        Min {m.minRamGb}GB
                                                                    </span>
                                                                )}
                                                                {isDownloaded ? (
                                                                    <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium">
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                                                        {t(lang, 'lyrics.aiPlugin.tagDownloaded')}
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center gap-1 text-xs text-zinc-400 font-medium">
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                                                                        {t(lang, 'lyrics.aiPlugin.tagNotDownloaded')}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>

                            {/* Stable Fixed-Height Info & Warning Slot (No layout jumping) */}
                            <div className="h-14 w-full relative z-10">
                                {isLowSpecsWarning ? (
                                    <div className="h-full w-full bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-2.5 text-xs text-amber-200/90 flex items-center gap-3 shadow-xs">
                                        <svg className="w-4.5 h-4.5 text-amber-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 1 1.73-3Z" />
                                            <line x1="12" y1="9" x2="12" y2="13" />
                                            <line x1="12" y1="17" x2="12.01" y2="17" />
                                        </svg>
                                        <p className="text-xs leading-tight text-amber-200/90 line-clamp-2">
                                            {t(lang, 'lyrics.aiPlugin.lowSpecsDesc', {
                                                model: selectedModelInfo.label,
                                                minRam: selectedModelInfo.minRamGb,
                                                minCpu: selectedModelInfo.minCpuCores,
                                                ram: systemSpecs.ramGb,
                                                cpu: systemSpecs.cpuCores,
                                            })}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="h-full w-full bg-zinc-900/40 border border-zinc-800/60 rounded-xl px-4 py-2.5 text-xs text-zinc-400 flex items-center gap-3">
                                        <svg className="w-4.5 h-4.5 text-emerald-400/90 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                        <p className="text-xs leading-tight text-zinc-400 line-clamp-2">
                                            {lang === 'id'
                                                ? `Model ${selectedModelInfo.label} optimal & kompatibel dengan spesifikasi perangkat Anda.`
                                                : `Model ${selectedModelInfo.label} is optimal and fully compatible with your system.`}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Vocal Isolation Toggle Card */}
                            <div
                                onClick={() => {
                                    const next = !isolateVocals;
                                    setIsolateVocals(next);
                                    if (typeof window !== 'undefined') {
                                        localStorage.setItem('symvonia_ai_isolate_vocals', String(next));
                                    }
                                }}
                                className="bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700/80 rounded-xl p-4 sm:p-4.5 flex items-center justify-between gap-4 cursor-pointer transition-all relative z-10"
                            >
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold text-zinc-200">
                                            {t(lang, 'lyrics.aiPlugin.isolateVocals')}
                                        </span>
                                    </div>
                                    <p className="text-xs text-zinc-400 mt-0.5 leading-normal">
                                        {t(lang, 'lyrics.aiPlugin.isolateVocalsHint')}
                                    </p>
                                </div>

                                {/* Custom Toggle Switch */}
                                <div
                                    className="w-10 h-5.5 rounded-full p-0.5 transition-colors shrink-0"
                                    style={{
                                        backgroundColor: isolateVocals ? accentHex : '#3f3f46',
                                    }}
                                >
                                    <motion.div
                                        className="w-4.5 h-4.5 rounded-full bg-white shadow-sm"
                                        animate={{ x: isolateVocals ? 18 : 0 }}
                                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                    />
                                </div>
                            </div>

                            {/* Action / Progress Area */}
                            <div className="pt-2 relative z-10">
                                {isAiGenerating ? (
                                    <div className="space-y-2.5 bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className="w-4 h-4 rounded-full border-2 border-zinc-400 border-t-transparent animate-spin shrink-0" />
                                                <span className="text-xs font-medium text-zinc-200 truncate">
                                                    {aiGenerateProgress?.segmentText ||
                                                        t(lang, 'lyrics.aiPlugin.generating', {
                                                            pct: aiGenerateProgress?.percent ?? 0,
                                                        })}
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={cancelAiGeneration}
                                                className="px-3 py-1.5 text-xs font-medium text-rose-300 hover:text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg transition-colors cursor-pointer shrink-0"
                                            >
                                                {t(lang, 'lyrics.aiPlugin.cancelBtn')}
                                            </button>
                                        </div>
                                        <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-300"
                                                style={{
                                                    width: `${aiGenerateProgress?.percent ?? 0}%`,
                                                    backgroundColor: accentHex,
                                                }}
                                            />
                                        </div>
                                    </div>
                                ) : aiModelProgress ? (
                                    <div className="space-y-2.5 bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
                                        <div className="flex items-center justify-between text-xs text-zinc-300">
                                            <div className="flex items-center gap-2">
                                                <div className="w-4 h-4 rounded-full border-2 border-zinc-400 border-t-transparent animate-spin shrink-0" />
                                                <span>
                                                    {t(lang, 'lyrics.aiPlugin.downloadingModel', {
                                                        model: aiModelProgress.modelName,
                                                        pct: aiModelProgress.percent,
                                                    })}
                                                </span>
                                            </div>
                                            <span className="font-mono text-zinc-400">
                                                {aiModelProgress.percent}%
                                            </span>
                                        </div>
                                        <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-300"
                                                style={{
                                                    width: `${aiModelProgress.percent}%`,
                                                    backgroundColor: accentHex,
                                                }}
                                            />
                                        </div>
                                    </div>
                                ) : aiStatus?.installed ? (
                                    <button
                                        type="button"
                                        onClick={handleGenerateAiLyrics}
                                        className="w-full py-3.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md hover:brightness-110 active:scale-[0.99] text-white"
                                        style={{ backgroundColor: accentHex }}
                                    >
                                        <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z" />
                                        </svg>
                                        <span>
                                            {isCurrentModelDownloaded
                                                ? t(lang, 'lyrics.aiPlugin.generateBtn')
                                                : t(lang, 'lyrics.aiPlugin.generateBtnDownload')}
                                        </span>
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => downloadAiPlugin()}
                                        disabled={isAiDownloading}
                                        className="w-full py-3.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                                    >
                                        {isAiDownloading ? (
                                            <>
                                                <div className="w-4 h-4 rounded-full border-2 border-zinc-400 border-t-transparent animate-spin" />
                                                <span>{t(lang, 'lyrics.aiPlugin.downloadingPlugin')}</span>
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                    <polyline points="7 10 12 15 17 10" />
                                                    <line x1="12" y1="15" x2="12" y2="3" />
                                                </svg>
                                                <span>{t(lang, 'lyrics.aiPlugin.installBtn')}</span>
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
