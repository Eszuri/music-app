'use client';

import { useState, useEffect } from 'react';
import { SettingGroup } from './controls';
import { t, type Lang } from '../../lib/translations';
import { getAccent } from '../../lib/colors';
import { useAiLyricsPlugin } from '../../hooks/useAiLyricsPlugin';

export interface AiModelSpec {
    code: string;
    label: string;
    descriptionKey: string;
    minRamGb: number;
    minCpuCores: number;
    sizeText: string;
    sizeBytes: number;
    downloadUrl: string;
}

export const AI_MODELS_LIST: AiModelSpec[] = [
    {
        code: 'tiny',
        label: 'Tiny',
        descriptionKey: 'lyrics.model.tiny.desc',
        minRamGb: 2,
        minCpuCores: 2,
        sizeText: '74 MB',
        sizeBytes: 74 * 1024 * 1024,
        downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
    },
    {
        code: 'base',
        label: 'Base',
        descriptionKey: 'lyrics.model.base.desc',
        minRamGb: 4,
        minCpuCores: 2,
        sizeText: '141 MB',
        sizeBytes: 141 * 1024 * 1024,
        downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
    },
    {
        code: 'small',
        label: 'Small',
        descriptionKey: 'lyrics.model.small.desc',
        minRamGb: 6,
        minCpuCores: 4,
        sizeText: '465 MB',
        sizeBytes: 465 * 1024 * 1024,
        downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
    },
    {
        code: 'medium',
        label: 'Medium',
        descriptionKey: 'lyrics.model.medium.desc',
        minRamGb: 8,
        minCpuCores: 4,
        sizeText: '1.46 GB',
        sizeBytes: 1460 * 1024 * 1024,
        downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin',
    },
    {
        code: 'large-v3-turbo',
        label: 'Large v3 Turbo',
        descriptionKey: 'lyrics.model.turbo.desc',
        minRamGb: 12,
        minCpuCores: 6,
        sizeText: '1.54 GB',
        sizeBytes: 1540 * 1024 * 1024,
        downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin',
    },
    {
        code: 'large-v3',
        label: 'Large v3',
        descriptionKey: 'lyrics.model.large.desc',
        minRamGb: 16,
        minCpuCores: 8,
        sizeText: '2.95 GB',
        sizeBytes: 2950 * 1024 * 1024,
        downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin',
    },
];

export default function LyricsSection({
    lang,
    accentColor,
}: {
    lang: Lang;
    accentColor: string;
}) {
    const accent = getAccent(accentColor);

    const {
        pluginStatus,
        downloadedModels,
        refreshDownloadedModels,
        modelDownloadProgress,
        systemSpecs,
        downloadModel,
        deleteModel,
        openModelsFolder,
        importModelFromFile,
        openExternalUrl,
        cancelGeneration,
        downloadPlugin,
    } = useAiLyricsPlugin();

    const [viewTab, setViewTab] = useState<'manager' | 'manual'>('manager');
    const [selectedManualModelCode, setSelectedManualModelCode] = useState<string>('base');
    const [copiedCmd, setCopiedCmd] = useState<boolean>(false);
    const [copiedLink, setCopiedLink] = useState<boolean>(false);
    const [copiedPath, setCopiedPath] = useState<boolean>(false);

    // Periodic check for downloaded models status
    useEffect(() => {
        const interval = setInterval(() => {
            refreshDownloadedModels();
        }, 3000);
        return () => clearInterval(interval);
    }, [refreshDownloadedModels]);

    const isInstalled = pluginStatus?.installed === true;

    // Calculate total size of downloaded models
    const downloadedSpecs = AI_MODELS_LIST.filter((m) => downloadedModels.includes(m.code));
    const totalSizeBytes = downloadedSpecs.reduce((acc, curr) => acc + curr.sizeBytes, 0);
    const totalSizeText = (totalSizeBytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';

    // Get selected manual model details
    const selectedManualModel =
        AI_MODELS_LIST.find((m) => m.code === selectedManualModelCode) || AI_MODELS_LIST[1];

    const modelsFolderPath = `%APPDATA%\\com.symvonia.player\\plugins\\ai-lyrics\\models\\`;

    const getPowerShellScriptForModel = (model: AiModelSpec) =>
        `$m = "$env:APPDATA\\com.symvonia.player\\plugins\\ai-lyrics\\models"; New-Item -ItemType Directory -Path $m -Force; Invoke-WebRequest -Uri "${model.downloadUrl}" -OutFile "$m\\ggml-${model.code}.bin"`;

    const currentPsScript = getPowerShellScriptForModel(selectedManualModel);

    const copyScript = () => {
        navigator.clipboard.writeText(currentPsScript);
        setCopiedCmd(true);
        setTimeout(() => setCopiedCmd(false), 2000);
    };

    const copyLink = () => {
        navigator.clipboard.writeText(selectedManualModel.downloadUrl);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
    };

    const copyPath = () => {
        navigator.clipboard.writeText(modelsFolderPath);
        setCopiedPath(true);
        setTimeout(() => setCopiedPath(false), 2000);
    };

    return (
        <div className="space-y-6 pb-6">
            {/* Top Hero Section */}
            <div className="p-5 rounded-3xl bg-gradient-to-b from-zinc-900/90 to-zinc-950/90 border border-zinc-800/80 shadow-lg space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-2xl ${accent.bg10} border ${accent.border500_20} shadow-md flex items-center justify-center shrink-0`}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={accent.text400}>
                                <path d="m12 3-1.9 5.8a2 2 0 0 1-1.28 1.28L3 12l5.8 1.9a2 2 0 0 1 1.28 1.28L12 21l1.9-5.8a2 2 0 0 1 1.28-1.28L21 12l-5.8-1.9a2 2 0 0 1-1.28-1.28Z"/>
                                <path d="M5 3v4"/>
                                <path d="M19 17v4"/>
                            </svg>
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl font-bold text-zinc-100 tracking-tight">
                                    {t(lang, 'sections.lyrics')}
                                </h2>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${accent.bg15} ${accent.text400} border ${accent.border500_30}`}>
                                    Whisper AI Engine
                                </span>
                            </div>
                            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                                {t(lang, 'lyrics.manager.subtitle')}
                            </p>
                        </div>
                    </div>

                    {/* Top Action Toolbar */}
                    <div className="flex items-center gap-2 self-start md:self-center shrink-0">
                        <button
                            onClick={() => openModelsFolder()}
                            className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-zinc-800/90 hover:bg-zinc-700/80 text-zinc-200 border border-zinc-700/60 transition-all flex items-center gap-2 cursor-pointer shadow-xs active:scale-95"
                            title={t(lang, 'lyrics.manager.openFolder')}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={accent.text400}>
                                <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>
                            </svg>
                            <span>{t(lang, 'lyrics.manager.openFolder')}</span>
                        </button>
                    </div>
                </div>

                {/* System Stats Overview Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 flex items-center gap-3.5 hover:border-zinc-700/60 transition-colors">
                        <div className={`p-2.5 rounded-xl ${accent.bg10} ${accent.text400} border ${accent.border500_20}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect width="18" height="18" x="3" y="3" rx="2"/>
                                <path d="M7 7h10M7 12h10M7 17h10"/>
                            </svg>
                        </div>
                        <div>
                            <div className="text-[11px] font-medium text-zinc-400">
                                {t(lang, 'lyrics.manager.statsInstalled')}
                            </div>
                            <div className="text-sm font-bold text-zinc-100 mt-0.5">
                                {downloadedModels.length} / {AI_MODELS_LIST.length} Model Ready
                            </div>
                        </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 flex items-center gap-3.5 hover:border-zinc-700/60 transition-colors">
                        <div className={`p-2.5 rounded-xl ${accent.bg10} ${accent.text400} border ${accent.border500_20}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                <polyline points="7 10 12 15 17 10"/>
                                <line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                        </div>
                        <div>
                            <div className="text-[11px] font-medium text-zinc-400">
                                {t(lang, 'lyrics.manager.statsStorage')}
                            </div>
                            <div className="text-sm font-bold text-zinc-100 mt-0.5">
                                {downloadedModels.length > 0 ? `${totalSizeText} Terpakai` : '0 GB'}
                            </div>
                        </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 flex items-center gap-3.5 hover:border-zinc-700/60 transition-colors">
                        <div className={`p-2.5 rounded-xl ${accent.bg10} ${accent.text400} border ${accent.border500_20}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="4" y="4" width="16" height="16" rx="2"/>
                                <rect x="9" y="9" width="6" height="6"/>
                                <path d="M15 2v2M9 2v2M15 20v2M9 20v2M2 15h2M2 9h2M20 15h2M20 9h2"/>
                            </svg>
                        </div>
                        <div>
                            <div className="text-[11px] font-medium text-zinc-400">
                                {t(lang, 'lyrics.manager.systemSpecs')}
                            </div>
                            <div className="text-xs font-semibold text-zinc-200 mt-0.5">
                                {systemSpecs ? `${systemSpecs.ramGb}GB RAM • ${systemSpecs.cpuCores} Core CPU` : 'Mendeteksi...'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Plugin Uninstalled Banner */}
            {!isInstalled && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in">
                    <div className="flex items-start gap-3">
                        <span className="text-xl mt-0.5">⚠️</span>
                        <div>
                            <h4 className="text-sm font-semibold text-amber-200">
                                {t(lang, 'lyrics.manager.pluginNotInstalledTitle')}
                            </h4>
                            <p className="text-xs text-amber-300/80 mt-0.5">
                                {t(lang, 'lyrics.manager.pluginNotInstalledDesc')}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => downloadPlugin()}
                        className={`px-4 py-2 text-xs font-bold rounded-xl ${accent.bg500} text-white hover:opacity-95 transition-all shrink-0 cursor-pointer shadow-sm active:scale-95`}
                    >
                        {t(lang, 'audio.bitperfect.plugin.install')}
                    </button>
                </div>
            )}

            {/* Segmented Main View Switcher Navbar (Refined & Symmetrical) */}
            <div className="p-1.5 rounded-2xl bg-zinc-950/90 border border-zinc-800/90 grid grid-cols-2 gap-1.5 shadow-sm">
                <button
                    onClick={() => setViewTab('manager')}
                    className={`py-2.5 px-4 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        viewTab === 'manager'
                            ? `${accent.bg500} text-white shadow-md`
                            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                    }`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect width="18" height="18" x="3" y="3" rx="2"/>
                        <path d="M7 7h10M7 12h10M7 17h10"/>
                    </svg>
                    <span>Manager Model Downloader</span>
                </button>

                <button
                    onClick={() => setViewTab('manual')}
                    className={`py-2.5 px-4 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        viewTab === 'manual'
                            ? `${accent.bg500} text-white shadow-md`
                            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                    }`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M12 16v-4"/>
                        <path d="M12 8h.01"/>
                    </svg>
                    <span>Panduan Manual & Terminal</span>
                </button>
            </div>

            {/* TAB VIEW 1: MANAGER MODEL DOWNLOADER */}
            {viewTab === 'manager' && (
                <SettingGroup title={t(lang, 'lyrics.manager.groupTitle')}>
                    <div className="divide-y divide-zinc-800/50">
                        {AI_MODELS_LIST.map((model) => {
                            const isDownloaded = downloadedModels.includes(model.code);
                            const isDownloadingThisModel =
                                Boolean(modelDownloadProgress &&
                                (modelDownloadProgress.modelName === model.code ||
                                    modelDownloadProgress.modelName.toLowerCase().includes(model.code.toLowerCase())));

                            // Hardware spec recommendation check
                            const ramOk = !systemSpecs || systemSpecs.ramGb >= model.minRamGb;
                            const cpuOk = !systemSpecs || systemSpecs.cpuCores >= model.minCpuCores;
                            const isRec = ramOk && cpuOk;

                            return (
                                <div
                                    key={model.code}
                                    className="py-4 px-3.5 my-1 rounded-2xl transition-all space-y-3 hover:bg-zinc-900/40"
                                >
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5">
                                        {/* Left Side: Model Info & Badges */}
                                        <div className="space-y-1.5">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-bold text-sm text-zinc-100">
                                                    {model.label}
                                                </span>

                                                {/* File Size Badge */}
                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700/50">
                                                    {model.sizeText}
                                                </span>

                                                {/* Download Status Badge */}
                                                {isDownloaded ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                                        {t(lang, 'lyrics.manager.installedBadge')}
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800/80 text-zinc-400 border border-zinc-700/50">
                                                        {t(lang, 'lyrics.manager.notDownloadedBadge')}
                                                    </span>
                                                )}

                                                {/* High RAM Alert Badge */}
                                                {!isRec && (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30" title={`Req: ${model.minRamGb}GB RAM, ${model.minCpuCores} Core CPU`}>
                                                        ⚠️ Butuh RAM Besar ({model.minRamGb}GB+)
                                                    </span>
                                                )}
                                            </div>

                                            <p className="text-xs text-zinc-400 leading-relaxed">
                                                {t(lang, model.descriptionKey)}
                                            </p>

                                            <div className="text-[11px] text-zinc-500 flex items-center gap-3 pt-0.5 font-mono">
                                                <span>Min RAM: {model.minRamGb} GB</span>
                                                <span>•</span>
                                                <span>Min CPU: {model.minCpuCores} Core</span>
                                            </div>
                                        </div>

                                        {/* Right Side: Action Buttons */}
                                        <div className="flex items-center gap-2 shrink-0 self-start md:self-center flex-wrap">
                                            {!isDownloaded ? (
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => importModelFromFile(model.code)}
                                                        className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-zinc-800/90 hover:bg-zinc-700/80 text-zinc-200 border border-zinc-700/60 transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-xs"
                                                        title={t(lang, 'lyrics.manager.importFileTitle')}
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
                                                            <path d="M14 2v4a1 1 0 0 0 1 1h4"/>
                                                        </svg>
                                                        <span>{t(lang, 'lyrics.manager.importBtn')}</span>
                                                    </button>

                                                    <button
                                                        onClick={() => downloadModel(model.code)}
                                                        disabled={isDownloadingThisModel}
                                                        className={`px-4 py-1.5 text-xs font-bold rounded-xl ${accent.bg500} text-white hover:opacity-95 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 disabled:opacity-50`}
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                                            <polyline points="7 10 12 15 17 10"/>
                                                            <line x1="12" y1="15" x2="12" y2="3"/>
                                                        </svg>
                                                        <span>{t(lang, 'lyrics.manager.downloadBtn')}</span>
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => deleteModel(model.code)}
                                                    className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/25 transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-xs"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="3 6 5 6 21 6"/>
                                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                                    </svg>
                                                    <span>{t(lang, 'lyrics.manager.deleteBtn')}</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Real-time Download Progress Bar */}
                                    {isDownloadingThisModel && modelDownloadProgress && (
                                        <div className={`p-3.5 rounded-xl bg-zinc-950/90 border ${accent.border500_30} space-y-2 animate-in fade-in duration-200`}>
                                            <div className="flex items-center justify-between text-xs">
                                                <div className={`flex items-center gap-2 ${accent.text400} font-medium`}>
                                                    <div className={`w-3.5 h-3.5 rounded-full border-2 ${accent.border500} border-t-transparent animate-spin`} />
                                                    <span>{t(lang, 'lyrics.manager.downloadingProgress', { model: model.label, pct: modelDownloadProgress.percent })}</span>
                                                </div>
                                                <button
                                                    onClick={() => cancelGeneration()}
                                                    className="text-[11px] font-semibold text-rose-400 hover:text-rose-300 cursor-pointer"
                                                >
                                                    {t(lang, 'audio.bitperfect.plugin.cancel')}
                                                </button>
                                            </div>
                                            <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                                                <div
                                                    className={`h-full ${accent.bg500} transition-all duration-300 rounded-full`}
                                                    style={{ width: `${modelDownloadProgress.percent}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </SettingGroup>
            )}

            {/* TAB VIEW 2: PANDUAN INSTALASI MANUAL & TERMINAL */}
            {viewTab === 'manual' && (
                <div className={`p-6 rounded-3xl bg-zinc-900/90 border ${accent.border500_30} space-y-5 animate-in fade-in duration-200 shadow-lg`}>
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-3.5">
                        <div className="flex items-center gap-2.5">
                            <span className={`${accent.text400} text-lg`}>📘</span>
                            <h3 className="text-base font-bold text-zinc-100 tracking-tight">
                                {t(lang, 'lyrics.manual.perModelTitle')}
                            </h3>
                        </div>
                        <button
                            onClick={() => setViewTab('manager')}
                            className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-zinc-800/90 hover:bg-zinc-700/80 text-zinc-200 border border-zinc-700/60 transition-all cursor-pointer flex items-center gap-1.5 shadow-xs active:scale-95"
                        >
                            <span>{t(lang, 'lyrics.manual.backToManager')}</span>
                        </button>
                    </div>

                    {/* Step Instructions */}
                    <div className="space-y-2.5 text-xs text-zinc-300 leading-relaxed">
                        <p>{t(lang, 'lyrics.manual.step1')}</p>
                        <p>{t(lang, 'lyrics.manual.step2')}</p>

                        <div className="p-3.5 rounded-2xl bg-zinc-950/90 border border-zinc-800/80 font-mono text-[11px] text-zinc-400 space-y-1.5">
                            <div className="flex items-center justify-between">
                                <span className={`${accent.text400} font-semibold`}>
                                    {t(lang, 'lyrics.manual.targetDir')}:
                                </span>
                                <button
                                    onClick={copyPath}
                                    className={`text-[11px] font-semibold ${accent.text400} hover:opacity-80 cursor-pointer`}
                                >
                                    {copiedPath ? 'Path Tersalin!' : 'Salin Path Folder'}
                                </button>
                            </div>
                            <div className="select-all text-zinc-200 break-all bg-zinc-900/90 p-2.5 rounded-xl border border-zinc-800/70 font-mono">
                                %APPDATA%\com.symvonia.player\plugins\ai-lyrics\models\
                            </div>
                        </div>
                    </div>

                    {/* Per-Model Selector Navbar (Refined Symmetrical Tabs) */}
                    <div className="space-y-3 pt-3 border-t border-zinc-800/80">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                                {t(lang, 'lyrics.manual.selectModel')}
                            </span>
                            <span className={`text-[11px] font-mono ${accent.text400} font-semibold bg-zinc-950 px-2.5 py-1 rounded-lg border border-zinc-800/80 shrink-0 self-start sm:self-auto`}>
                                Target: <span className="text-zinc-200">ggml-{selectedManualModel.code}.bin</span> ({selectedManualModel.sizeText})
                            </span>
                        </div>

                        {/* Model Tabs Pills Navbar */}
                        <div className="p-1 rounded-2xl bg-zinc-950/90 border border-zinc-800/90 flex items-center gap-1 overflow-x-auto">
                            {AI_MODELS_LIST.map((m) => {
                                const isSel = m.code === selectedManualModelCode;
                                return (
                                    <button
                                        key={m.code}
                                        onClick={() => setSelectedManualModelCode(m.code)}
                                        className={`flex-1 min-w-[90px] py-2 px-3 text-xs font-semibold rounded-xl transition-all text-center cursor-pointer whitespace-nowrap ${
                                            isSel
                                                ? `${accent.bg500} text-white shadow-xs font-bold`
                                                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                                        }`}
                                    >
                                        {m.label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Selected Model Detail Box */}
                        <div className="p-4.5 rounded-2xl bg-zinc-950/90 border border-zinc-800 space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
                                <div>
                                    <div className="text-xs font-bold text-zinc-100 flex items-center gap-2">
                                        <span>Model {selectedManualModel.label}</span>
                                        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700/50">
                                            {selectedManualModel.sizeText}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                                        {t(lang, selectedManualModel.descriptionKey)}
                                    </p>
                                </div>

                                <button
                                    onClick={() => openExternalUrl(selectedManualModel.downloadUrl)}
                                    className={`px-4 py-2 text-xs font-semibold rounded-xl ${accent.bg500} text-white hover:opacity-95 transition-all flex items-center gap-1.5 shrink-0 self-start sm:self-center cursor-pointer shadow-xs active:scale-95`}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                                        <polyline points="15 3 21 3 21 9"/>
                                        <line x1="10" y1="14" x2="21" y2="3"/>
                                    </svg>
                                    <span>{t(lang, 'lyrics.manual.openBrowser')}</span>
                                </button>
                            </div>

                            {/* Direct URL Box */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between text-[11px]">
                                    <span className="text-zinc-400 font-medium">Direct Download Link (HuggingFace):</span>
                                    <button
                                        onClick={copyLink}
                                        className={`${accent.text400} hover:opacity-80 font-semibold cursor-pointer flex items-center gap-1`}
                                    >
                                        <span>{copiedLink ? t(lang, 'lyrics.manual.copied') : t(lang, 'lyrics.manual.copyLink')}</span>
                                    </button>
                                </div>
                                <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 font-mono text-[10px] text-zinc-300 break-all select-all">
                                    {selectedManualModel.downloadUrl}
                                </div>
                            </div>

                            {/* Model Specific PowerShell Script */}
                            <div className="space-y-1.5 pt-1">
                                <div className="flex items-center justify-between text-[11px]">
                                    <span className="text-zinc-400 font-medium">PowerShell One-Liner Script (Model {selectedManualModel.label}):</span>
                                    <button
                                        onClick={copyScript}
                                        className={`px-3 py-1 text-[11px] font-semibold rounded-lg ${accent.bg15} ${accent.text400} border ${accent.border500_30} transition-all cursor-pointer`}
                                    >
                                        {copiedCmd ? t(lang, 'lyrics.manual.copied') : t(lang, 'lyrics.manual.copyPsCmd')}
                                    </button>
                                </div>
                                <pre className={`p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 text-[10px] ${accent.text400} font-mono overflow-x-auto whitespace-pre-wrap select-all`}>
                                    {currentPsScript}
                                </pre>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
