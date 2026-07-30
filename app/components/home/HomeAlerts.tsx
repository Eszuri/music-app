'use client';

import {AnimatePresence, motion} from 'framer-motion';
import {t, type Lang} from '../../lib/translations';
import {contentMotion} from '../../lib/animations';

interface HomeAlertsProps {
    lang: Lang;
    toastVisible: boolean;
    volumeLimitExceeded: boolean;
    volumeLimit: number;
    onCloseToast: () => void;
    onCloseVolumeAlert: () => void;
    updateAlertInfo: {version: string} | null;
    updateAlertDownloading: boolean;
    updateAlertProgress: number;
    updateAlertTotal: number;
    onUpdate: () => void;
    onRemindLater: () => void;
    onStayCurrent: () => void;
}

export default function HomeAlerts({
    lang,
    toastVisible,
    volumeLimitExceeded,
    volumeLimit,
    onCloseToast,
    onCloseVolumeAlert,
    updateAlertInfo,
    updateAlertDownloading,
    updateAlertProgress,
    updateAlertTotal,
    onUpdate,
    onRemindLater,
    onStayCurrent,
}: HomeAlertsProps) {
    const updateProgress =
        updateAlertDownloading && updateAlertTotal > 0
            ? Math.min(updateAlertProgress / updateAlertTotal, 1)
            : 0;

    return (
        <AnimatePresence>
            {toastVisible && (
                <motion.div
                    key="toast"
                    {...contentMotion}
                    className="fixed top-4 right-4 z-70 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-900/80 border border-red-700/50 text-sm text-red-200 shadow-2xl shadow-black/40 backdrop-blur-sm"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 8v4M12 16h.01" />
                    </svg>
                    <span dangerouslySetInnerHTML={{__html: t(lang, 'alert.error')}} />
                    <button
                        onClick={onCloseToast}
                        className="ml-2 w-5 h-5 rounded flex items-center justify-center text-red-300 hover:text-red-100 hover:bg-red-800/60 cursor-pointer"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                    </button>
                </motion.div>
            )}
            {volumeLimitExceeded && (
                <motion.div
                    key="volume-alert"
                    {...contentMotion}
                    className="fixed top-4 left-1/2 -translate-x-1/2 z-70 flex items-center gap-2.5 px-5 py-3 rounded-xl bg-amber-900/90 border border-amber-600/60 text-sm text-amber-100 shadow-2xl shadow-black/40 backdrop-blur-sm"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    <span dangerouslySetInnerHTML={{__html: t(lang, 'alert.volumeWarning', {limit: volumeLimit})}} />
                    <button
                        onClick={onCloseVolumeAlert}
                        className="ml-2 w-5 h-5 rounded flex items-center justify-center text-amber-300 hover:text-amber-100 hover:bg-amber-800/60 cursor-pointer"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                    </button>
                </motion.div>
            )}
            {updateAlertInfo && !updateAlertDownloading && (
                <motion.div
                    key="update-alert"
                    {...contentMotion}
                    className="fixed top-4 right-4 z-70 flex flex-col gap-3 px-5 py-4 rounded-xl bg-zinc-900/90 border border-zinc-700/60 text-sm text-zinc-200 shadow-2xl shadow-black/40 backdrop-blur-sm min-w-[340px]"
                >
                    <div className="flex items-center gap-2.5">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                            <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
                            <path d="M12 6v6l4 2" />
                        </svg>
                        <div className="flex flex-col">
                            <span className="text-sm font-semibold text-zinc-100">{t(lang, 'general.updateAlert.title')}</span>
                            <span className="text-xs text-zinc-400">{t(lang, 'general.updateAlert.message', {version: updateAlertInfo.version})}</span>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={onUpdate}
                            className="h-8 px-3 rounded-lg text-[11px] font-medium text-white bg-green-600 hover:bg-green-500 transition-colors cursor-pointer text-center whitespace-nowrap"
                        >
                            {t(lang, 'general.updateAlert.updateBtn')}
                        </button>
                        <button
                            onClick={onRemindLater}
                            className="h-8 px-3 rounded-lg text-[11px] font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/50 transition-colors cursor-pointer text-center whitespace-nowrap"
                        >
                            {t(lang, 'general.updateAlert.remindLater')}
                        </button>
                        <button
                            onClick={onStayCurrent}
                            className="h-8 px-3 rounded-lg text-[11px] font-medium text-zinc-400 bg-zinc-800/50 hover:bg-zinc-700/70 border border-zinc-700/30 transition-colors cursor-pointer text-center whitespace-nowrap"
                        >
                            {t(lang, 'general.updateAlert.stayCurrent')}
                        </button>
                    </div>
                </motion.div>
            )}
            {updateAlertDownloading && (
                <motion.div
                    key="update-downloading"
                    {...contentMotion}
                    className="fixed top-4 right-4 z-70 flex flex-col gap-2.5 px-5 py-4 rounded-xl bg-zinc-900/90 border border-zinc-700/60 text-sm text-zinc-200 shadow-2xl shadow-black/40 backdrop-blur-sm min-w-[260px]"
                >
                    <div className="flex items-center gap-2.5">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        <span className="text-xs text-zinc-300">{t(lang, 'general.updateAlert.downloading')}</span>
                    </div>
                    {updateAlertTotal > 0 && (
                        <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                            <div
                                className="h-full rounded-full bg-green-500 transition-all duration-200"
                                style={{width: `${updateProgress * 100}%`}}
                            />
                        </div>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
}
