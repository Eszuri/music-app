'use client';

import { motion, AnimatePresence } from 'framer-motion';

import { useState, useEffect, useRef } from 'react';
import { t, type Lang } from '../lib/translations';
import { useAiLyricsPlugin } from '../hooks/useAiLyricsPlugin';
import { isBrowserTauri, getTauri } from '../lib/homeState';

export interface AiModelSpec {
    code: string;
    label: string;
    minRamGb: number;
    minCpuCores: number;
    sizeText: string;
}

const AI_MODELS: AiModelSpec[] = [
    { code: 'tiny', label: 'Tiny (Ringan - 74MB)', minRamGb: 2, minCpuCores: 2, sizeText: '74MB' },
    { code: 'base', label: 'Base (Standard - 141MB)', minRamGb: 4, minCpuCores: 2, sizeText: '141MB' },
    { code: 'small', label: 'Small (Presisi Tinggi - 465MB)', minRamGb: 6, minCpuCores: 4, sizeText: '465MB' },
    { code: 'medium', label: 'Medium (Sangat Presisi - 1.46GB)', minRamGb: 8, minCpuCores: 4, sizeText: '1.46GB' },
    { code: 'large-v3-turbo', label: 'Large v3 Turbo (Ultra Presisi - 1.54GB)', minRamGb: 12, minCpuCores: 6, sizeText: '1.54GB' },
    { code: 'large-v3', label: 'Large v3 (Presisi Maksimal - 2.95GB)', minRamGb: 16, minCpuCores: 8, sizeText: '2.95GB' },
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

    const [systemSpecs, setSystemSpecs] = useState<{ ramGb: number; cpuCores: number }>({
        ramGb: 8,
        cpuCores: 4,
    });

    useEffect(() => {
        if (!isOpen) return;
        let isMounted = true;
        if (isBrowserTauri) {
            getTauri()
                .then((mod) => mod.invoke<{ ramGb: number; cpuCores: number }>('get_system_specs'))
                .then((specs) => {
                    if (isMounted && specs) setSystemSpecs(specs);
                })
                .catch(() => {});
        } else if (typeof navigator !== 'undefined') {
            const cpuCores = navigator.hardwareConcurrency || 4;
            const ramGb = (navigator as any).deviceMemory || 8;
            setSystemSpecs({ ramGb, cpuCores });
        }
        return () => {
            isMounted = false;
        };
    }, [isOpen]);

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

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
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
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="bg-zinc-950 border border-purple-900/40 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
                        onClick={(e) => e.stopPropagation()}
                    >

                {/* Modal Header */}
                <div className="flex items-center justify-between p-4 border-b border-zinc-800/80 bg-purple-950/20">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-purple-900/40 border border-purple-700/40 rounded-xl text-purple-300 shadow-xs">
                            ✨
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                                {t(lang, 'lyrics.aiPlugin.title')}
                            </h2>
                            <p className="text-[11px] text-zinc-400 font-medium truncate max-w-[280px]">
                                {initialTitle} {initialArtist ? `— ${initialArtist}` : ''}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 transition-colors cursor-pointer"
                    >
                        ✕
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-4 space-y-4 overflow-y-auto">
                    {/* System Specs Bar */}
                    <div className="flex items-center justify-between text-xs px-1">
                        <span className="text-zinc-400 text-xs font-semibold">
                            {t(lang, 'lyrics.aiPlugin.modelLabel')}
                        </span>
                        <span className="text-[10px] font-mono font-medium text-purple-300 bg-purple-950/60 border border-purple-800/40 rounded-md px-2 py-0.5 shadow-sm">
                            💻 System Specs: {systemSpecs.ramGb}GB RAM • {systemSpecs.cpuCores} Core CPU
                        </span>
                    </div>

                    {/* Model Dropdown */}
                    <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 focus-within:border-purple-500/40 transition-colors">
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
                            {AI_MODELS.map((m) => {
                                const fits = systemSpecs.ramGb >= m.minRamGb && systemSpecs.cpuCores >= m.minCpuCores;
                                const tag = fits ? '✅ OK' : `⚠️ Heavy (Min ${m.minRamGb}GB RAM)`;
                                return (
                                    <option key={m.code} value={m.code} className="bg-zinc-900 text-zinc-100 py-1">
                                        {m.label} — [{tag}]
                                    </option>
                                );
                            })}
                        </select>
                    </div>

                    {/* Real-time System Specs Warning Banner */}
                    {isLowSpecsWarning && (
                        <div className="bg-amber-950/50 border border-amber-500/40 rounded-xl p-3 text-xs text-amber-200 flex items-start gap-2.5 shadow-md">
                            <span className="text-base shrink-0 select-none">⚠️</span>
                            <div className="space-y-1 min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-semibold text-amber-300 text-xs">
                                        {t(lang, 'lyrics.aiPlugin.lowSpecsTitle')}
                                    </span>
                                    <span className="text-[10px] font-mono bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30 shrink-0">
                                        RAM {systemSpecs.ramGb}GB / Min {selectedModelInfo.minRamGb}GB
                                    </span>
                                </div>
                                <p className="text-[11px] text-amber-200/90 leading-relaxed">
                                    {t(lang, 'lyrics.aiPlugin.lowSpecsDesc', {
                                        model: selectedModelInfo.label,
                                        minRam: selectedModelInfo.minRamGb,
                                        minCpu: selectedModelInfo.minCpuCores,
                                        ram: systemSpecs.ramGb,
                                        cpu: systemSpecs.cpuCores,
                                    })}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Isolate Vocals Checkbox */}
                    <div className="bg-zinc-900/80 border border-zinc-800/80 hover:border-purple-500/40 rounded-xl p-3 transition-all space-y-1.5">
                        <label className="flex items-center gap-2.5 text-xs cursor-pointer select-none">
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
                                className="w-4 h-4 rounded bg-zinc-950 border-zinc-700 text-purple-600 focus:ring-purple-500 cursor-pointer accent-purple-500 shrink-0"
                            />
                            <span className="font-semibold text-purple-200 text-xs">
                                {t(lang, 'lyrics.aiPlugin.isolateVocals')}
                            </span>
                        </label>
                        <p className="text-[11px] text-zinc-400 pl-6.5 leading-relaxed">
                            {isolateVocals
                                ? t(lang, 'lyrics.aiPlugin.isolateVocalsTrueHint')
                                : t(lang, 'lyrics.aiPlugin.isolateVocalsFalseHint')}
                        </p>
                    </div>

                    {/* Action & Progress Button */}
                    <div className="pt-2">
                        {isAiGenerating ? (
                            <div className="flex flex-col gap-2.5 bg-purple-950/40 border border-purple-800/40 p-3.5 rounded-xl">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                        <div className="w-3.5 h-3.5 rounded-full border-2 border-purple-400 border-t-transparent animate-spin shrink-0" />
                                        <p className="text-xs font-semibold text-purple-200 truncate">
                                            {aiGenerateProgress?.segmentText || t(lang, 'lyrics.aiPlugin.generating', { pct: aiGenerateProgress?.percent ?? 0 })}
                                        </p>
                                    </div>
                                    <button
                                        onClick={cancelAiGeneration}
                                        className="px-2.5 py-1 text-[11px] font-semibold text-rose-300 bg-rose-500/20 hover:bg-rose-500/30 rounded-lg transition-colors shrink-0 cursor-pointer"
                                    >
                                        {t(lang, 'lyrics.aiPlugin.cancelBtn')}
                                    </button>
                                </div>
                                <div className="w-full bg-purple-900/60 h-2 rounded-full overflow-hidden">
                                    <div
                                        className="bg-purple-400 h-full transition-all duration-300"
                                        style={{ width: `${aiGenerateProgress?.percent ?? 0}%` }}
                                    />
                                </div>
                            </div>
                        ) : aiModelProgress ? (
                            <div className="flex items-center gap-2.5 bg-purple-950/40 border border-purple-800/40 p-3.5 rounded-xl">
                                <div className="w-3.5 h-3.5 rounded-full border-2 border-purple-400 border-t-transparent animate-spin shrink-0" />
                                <span className="text-xs text-purple-200">
                                    {t(lang, 'lyrics.aiPlugin.downloadingModel', { model: aiModelProgress.modelName, pct: aiModelProgress.percent })}
                                </span>
                            </div>
                        ) : aiStatus?.installed ? (
                            <button
                                type="button"
                                onClick={handleGenerateAiLyrics}
                                className="w-full py-3 px-4 rounded-xl bg-purple-600/30 hover:bg-purple-600/40 border border-purple-500/40 text-purple-200 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md active:scale-98"
                            >
                                <span>{t(lang, 'lyrics.aiPlugin.generateBtn')}</span>
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => downloadAiPlugin()}
                                disabled={isAiDownloading}
                                className="w-full py-3 px-4 rounded-xl bg-purple-950/60 hover:bg-purple-900/60 border border-purple-800/60 text-purple-300 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                            >
                                <span>
                                    {isAiDownloading
                                        ? t(lang, 'lyrics.aiPlugin.downloadingPlugin')
                                        : t(lang, 'lyrics.aiPlugin.installBtn')}
                                </span>
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
