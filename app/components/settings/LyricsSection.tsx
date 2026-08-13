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

function formatBytes(bytes: number): string {
    if (!bytes || bytes <= 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1000) {
        return `${(mb / 1024).toFixed(2)} GB`;
    }
    return `${mb.toFixed(1)} MB`;
}

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

    const [downloadingModelCode, setDownloadingModelCode] = useState<string | null>(null);
    const [isCancellingDownload, setIsCancellingDownload] = useState<boolean>(false);

    const isAnyDownloadActive = Boolean(modelDownloadProgress) || Boolean(downloadingModelCode);

    const handleStartDownload = async (modelCode: string) => {
        if (isAnyDownloadActive) return;
        setDownloadingModelCode(modelCode);
        try {
            await downloadModel(modelCode);
        } catch (err) {
            console.error('Failed to start model download:', err);
            setDownloadingModelCode(null);
        }
    };

    useEffect(() => {
        if (!modelDownloadProgress) {
            setDownloadingModelCode(null);
        }
    }, [modelDownloadProgress]);

    const handleCancelDownload = async () => {
        if (isCancellingDownload) return;
        setIsCancellingDownload(true);
        try {
            await cancelGeneration();
        } catch (err) {
            console.error('Failed to cancel model download:', err);
        } finally {
            setIsCancellingDownload(false);
            setDownloadingModelCode(null);
        }
    };
    const [viewTab, setViewTab] = useState<'manager' | 'manual'>('manager');
    const [filterStatus, setFilterStatus] = useState<'all' | 'installed' | 'not_installed'>('all');
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

    // Filtered models list
    const filteredModels = AI_MODELS_LIST.filter((model) => {
        const isDownloaded = downloadedModels.includes(model.code);
        if (filterStatus === 'installed') return isDownloaded;
        if (filterStatus === 'not_installed') return !isDownloaded;
        return true;
    });

    return (
        <div className="space-y-6 pb-6">
            {/* Top Hero Section */}
            <div className="p-5 rounded-3xl bg-gradient-to-b from-zinc-900/90 to-zinc-950/90 border border-zinc-800/80 shadow-lg space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                        <div className={`p-3 rounded-2xl ${accent.bg10} border ${accent.border500_20} shadow-md flex items-center justify-center shrink-0`}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={accent.text400}>
                                <path d="m12 3-1.9 5.8a2 2 0 0 1-1.28 1.28L3 12l5.8 1.9a2 2 0 0 1 1.28 1.28L12 21l1.9-5.8a2 2 0 0 1 1.28-1.28L21 12l-5.8-1.9a2 2 0 0 1-1.28-1.28Z"/>
                                <path d="M5 3v4"/>
                                <path d="M19 17v4"/>
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-zinc-100 tracking-tight leading-tight">
                                {t(lang, 'sections.lyrics')}
                            </h2>
                            <p className="text-xs text-zinc-400 mt-0.5 leading-normal">
                                {t(lang, 'lyrics.manager.subtitle')}
                            </p>
                        </div>
                    </div>

                    {/* Top Action Toolbar (Perfectly Centered & Aligned) */}
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={() => openModelsFolder()}
                            className="px-4 py-2.5 text-xs font-semibold rounded-2xl bg-zinc-800/90 hover:bg-zinc-700/80 text-zinc-200 border border-zinc-700/60 transition-all flex items-center gap-2 cursor-pointer shadow-xs active:scale-95 shrink-0"
                            title={t(lang, 'lyrics.manager.openFolder')}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={accent.text400}>
                                <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>
                            </svg>
                            <span>{t(lang, 'lyrics.manager.openFolder')}</span>
                        </button>
                    </div>
                </div>

                {/* 2-Column Overview Grid: Narrower Filter Column (4) & Wider Specs Column (8) */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 pt-2 items-stretch">
                    {/* KOLOM 1: FILTER MODEL AI (Narrower 4-Span Column) */}
                    <div className="md:col-span-4 p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800/80 flex flex-col justify-between space-y-3">
                        <div className="flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={accent.text400}>
                                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
                            </svg>
                            <span className="text-xs font-bold text-zinc-200">
                                {t(lang, 'lyrics.filter.title')}
                            </span>
                        </div>

                        {/* Filter Control Vertical List (Clean Text + Number Badges) */}
                        <div className="p-1 rounded-xl bg-zinc-950/90 border border-zinc-800/80 flex flex-col gap-1">
                            <button
                                onClick={() => setFilterStatus('all')}
                                className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-between cursor-pointer ${
                                    filterStatus === 'all'
                                        ? `${accent.bg500} text-white font-bold shadow-xs`
                                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                                }`}
                            >
                                <span>{t(lang, 'lyrics.filter.all')}</span>
                                <span className="text-[10px] font-mono font-bold opacity-90 px-2 py-0.5 rounded bg-black/30 shrink-0">
                                    {AI_MODELS_LIST.length}
                                </span>
                            </button>

                            <button
                                onClick={() => setFilterStatus('installed')}
                                className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-between cursor-pointer ${
                                    filterStatus === 'installed'
                                        ? `${accent.bg500} text-white font-bold shadow-xs`
                                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                                }`}
                            >
                                <span>{t(lang, 'lyrics.filter.installed')}</span>
                                <span className="text-[10px] font-mono font-bold opacity-90 px-2 py-0.5 rounded bg-black/30 shrink-0">
                                    {downloadedModels.length}
                                </span>
                            </button>

                            <button
                                onClick={() => setFilterStatus('not_installed')}
                                className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-between cursor-pointer ${
                                    filterStatus === 'not_installed'
                                        ? `${accent.bg500} text-white font-bold shadow-xs`
                                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                                }`}
                            >
                                <span>{t(lang, 'lyrics.filter.notInstalled')}</span>
                                <span className="text-[10px] font-mono font-bold opacity-90 px-2 py-0.5 rounded bg-black/30 shrink-0">
                                    {AI_MODELS_LIST.length - downloadedModels.length}
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* KOLOM 2: DETAIL SPESIFIKASI PERANGKAT (Wider 8-Span Column) */}
                    <div className="md:col-span-8 p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800/80 flex flex-col justify-between space-y-3">
                        <div className="flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={accent.text400}>
                                <rect x="4" y="4" width="16" height="16" rx="2"/>
                                <rect x="9" y="9" width="6" height="6"/>
                                <path d="M15 2v2M9 2v2M15 20v2M9 20v2M2 15h2M2 9h2M20 15h2M20 9h2"/>
                            </svg>
                            <span className="text-xs font-bold text-zinc-200">
                                {t(lang, 'lyrics.specs.title')}
                            </span>
                        </div>

                        {/* Specs Detailed Vertical List */}
                        <div className="space-y-1.5">
                            {/* GPU Item */}
                            <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800/70 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="text-xs shrink-0">🎮</span>
                                    <span className="text-[11px] font-medium text-zinc-400 shrink-0">
                                        {t(lang, 'lyrics.specs.gpu')}
                                    </span>
                                    <span className="text-xs font-bold text-zinc-100 truncate" title={systemSpecs?.gpuName || 'Graphics GPU'}>
                                        {systemSpecs?.gpuName || t(lang, 'lyrics.specs.detecting')}
                                    </span>
                                </div>
                            </div>

                            {/* CPU Item */}
                            <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800/70 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="text-xs shrink-0">⚡</span>
                                    <span className="text-[11px] font-medium text-zinc-400 shrink-0">
                                        {t(lang, 'lyrics.specs.cpu')}
                                    </span>
                                    <span className="text-xs font-bold text-zinc-100 truncate" title={systemSpecs ? `${systemSpecs.cpuName || 'CPU'} (${systemSpecs.cpuCores} Core)` : 'CPU'}>
                                        {systemSpecs ? (systemSpecs.cpuName ? `${systemSpecs.cpuName} (${systemSpecs.cpuCores} Core)` : `${systemSpecs.cpuCores} Core`) : t(lang, 'lyrics.specs.detecting')}
                                    </span>
                                </div>
                            </div>

                            {/* RAM Item */}
                            <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800/70 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="text-xs shrink-0">💾</span>
                                    <span className="text-[11px] font-medium text-zinc-400 shrink-0">
                                        {t(lang, 'lyrics.specs.ram')}
                                    </span>
                                    <span className="text-xs font-bold text-zinc-100 truncate">
                                        {systemSpecs ? `${systemSpecs.ramGb} GB RAM Total` : t(lang, 'lyrics.specs.detecting')}
                                    </span>
                                </div>
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

            {/* Segmented Main View Switcher Navbar */}
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
                    <span>{t(lang, 'lyrics.tab.manager')}</span>
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
                    <span>{t(lang, 'lyrics.tab.manual')}</span>
                </button>
            </div>

            {/* TAB VIEW 1: MANAGER MODEL DOWNLOADER */}
            {viewTab === 'manager' && (
                <SettingGroup title={t(lang, 'lyrics.manager.groupTitle')}>
                    <div className="divide-y divide-zinc-800/50">
                        {filteredModels.length === 0 ? (
                            <div className="py-8 text-center text-xs text-zinc-400">
                                {t(lang, 'lyrics.filter.empty')}
                            </div>
                        ) : (
                            filteredModels.map((model) => {
                                const isDownloaded = downloadedModels.includes(model.code);
                                const isDownloadingThisModel =
                                    Boolean(modelDownloadProgress &&
                                    (modelDownloadProgress.modelName === model.code ||
                                        modelDownloadProgress.modelName.toLowerCase().includes(model.code.toLowerCase())));

                                return (
                                    <div
                                        key={model.code}
                                        className="py-4 px-3.5 my-1 rounded-2xl transition-all space-y-3 hover:bg-zinc-900/40"
                                    >
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5">
                                            {/* Left Side: Model Info & Clean Text Status */}
                                            <div className="space-y-1.5">
                                                <div className="flex items-center gap-2.5 flex-wrap">
                                                    <span className="font-bold text-sm text-zinc-100">
                                                        {model.label}
                                                    </span>

                                                    <span className="text-xs text-zinc-500 font-mono">
                                                        ({model.sizeText})
                                                    </span>

                                                    {isDownloaded ? (
                                                        <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                                            {t(lang, 'lyrics.manager.installedBadge')}
                                                        </span>
                                                    ) : (
                                                        <span className="px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-zinc-800/80 text-zinc-400 border border-zinc-700/50">
                                                            {t(lang, 'lyrics.manager.notDownloadedBadge')}
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
                                                            onClick={() => handleStartDownload(model.code)}
                                                            disabled={isAnyDownloadActive}
                                                            className={`px-4 py-1.5 text-xs font-bold rounded-xl ${accent.bg500} text-white hover:opacity-95 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none`}
                                                        >
                                                            {downloadingModelCode === model.code || isDownloadingThisModel ? (
                                                                <div className="flex items-center gap-1.5">
                                                                    <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                                                                    <span>Memproses...</span>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                                                        <polyline points="7 10 12 15 17 10"/>
                                                                        <line x1="12" y1="15" x2="12" y2="3"/>
                                                                    </svg>
                                                                    <span>{t(lang, 'lyrics.manager.downloadBtn')}</span>
                                                                </>
                                                            )}
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
                                        {isDownloadingThisModel && modelDownloadProgress && (() => {
                                            const totalSize = modelDownloadProgress.totalBytes || model.sizeBytes;
                                            const downloadedSize = modelDownloadProgress.downloadedBytes ?? Math.round((modelDownloadProgress.percent / 100) * totalSize);
                                            const formattedDownloaded = formatBytes(downloadedSize);
                                            const formattedTotal = formatBytes(totalSize);

                                            return (
                                                <div className={`p-3.5 rounded-xl bg-zinc-950/90 border ${accent.border500_30} space-y-2 animate-in fade-in duration-200`}>
                                                    <div className="flex items-center justify-between text-xs gap-2">
                                                        <div className={`flex items-center gap-2 ${accent.text400} font-semibold min-w-0`}>
                                                            <div className={`w-3.5 h-3.5 rounded-full border-2 ${accent.border500} border-t-transparent animate-spin shrink-0`} />
                                                            <span className="flex items-center gap-1.5 flex-wrap">
                                                                <span>{t(lang, 'lyrics.manager.downloadingModelProgress')}</span>
                                                                <span className="text-zinc-400 font-mono text-[11px] font-normal">
                                                                    ({formattedDownloaded} / {formattedTotal} • {modelDownloadProgress.percent}%)
                                                                </span>
                                                            </span>
                                                        </div>
                                                        <button
                                                            onClick={handleCancelDownload}
                                                            disabled={isCancellingDownload}
                                                            className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/35 transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none shrink-0 active:scale-95 shadow-xs"
                                                        >
                                                            {isCancellingDownload ? 'Membatalkan...' : t(lang, 'audio.bitperfect.plugin.cancel')}
                                                        </button>
                                                    </div>
                                                    <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                                                        <div
                                                            className={`h-full ${accent.bg500} transition-all duration-300 rounded-full`}
                                                            style={{ width: `${modelDownloadProgress.percent}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </SettingGroup>
            )}

            {/* TAB VIEW 2: PANDUAN INSTALASI MANUAL & TERMINAL */}
            {viewTab === 'manual' && (
                <div className={`p-6 rounded-3xl bg-zinc-900/90 border ${accent.border500_30} space-y-5 animate-in fade-in duration-200 shadow-lg`}>
                    <div className="flex items-center gap-2.5 border-b border-zinc-800 pb-3.5">
                        <span className={`${accent.text400} text-lg`}>📘</span>
                        <h3 className="text-base font-bold text-zinc-100 tracking-tight">
                            {t(lang, 'lyrics.manual.perModelTitle')}
                        </h3>
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
                                    {copiedPath ? t(lang, 'lyrics.manual.copiedPath') : t(lang, 'lyrics.manual.copyPathBtn')}
                                </button>
                            </div>
                            <div className="select-all text-zinc-200 break-all bg-zinc-900/90 p-2.5 rounded-xl border border-zinc-800/70 font-mono">
                                %APPDATA%\com.symvonia.player\plugins\ai-lyrics\models\
                            </div>
                        </div>
                    </div>

                    {/* Per-Model Selector Navbar */}
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
                                        <span className="text-[10px] font-mono text-zinc-400">
                                            ({selectedManualModel.sizeText})
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
