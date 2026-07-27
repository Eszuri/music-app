'use client';

import {AnimatePresence, motion} from 'framer-motion';

interface HomeAlertsProps {
    toastVisible: boolean;
    volumeLimitExceeded: boolean;
    volumeLimit: number;
    onCloseToast: () => void;
    onCloseVolumeAlert: () => void;
}

export default function HomeAlerts({
    toastVisible,
    volumeLimitExceeded,
    volumeLimit,
    onCloseToast,
    onCloseVolumeAlert,
}: HomeAlertsProps) {
    return (
        <AnimatePresence>
            {toastVisible && (
                <motion.div
                    key="toast"
                    initial={{opacity: 0, y: -12, scale: 0.95}}
                    animate={{opacity: 1, y: 0, scale: 1}}
                    exit={{opacity: 0, y: -12, scale: 0.95}}
                    transition={{duration: 0.2}}
                    className="fixed top-4 right-4 z-70 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-900/80 border border-red-700/50 text-sm text-red-200 shadow-2xl shadow-black/40 backdrop-blur-sm"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 8v4M12 16h.01" />
                    </svg>
                    <span>Terjadi error. Cek <strong>Debug</strong> log untuk detail.</span>
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
                    initial={{opacity: 0, y: -12, scale: 0.95}}
                    animate={{opacity: 1, y: 0, scale: 1}}
                    exit={{opacity: 0, y: -12, scale: 0.95}}
                    transition={{duration: 0.3}}
                    className="fixed top-4 left-1/2 -translate-x-1/2 z-70 flex items-center gap-2.5 px-5 py-3 rounded-xl bg-amber-900/90 border border-amber-600/60 text-sm text-amber-100 shadow-2xl shadow-black/40 backdrop-blur-sm"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    <span>Volume sistem melebihi batas aman (<strong>{volumeLimit}</strong>)! Turunkan volume untuk melindungi pendengaran.</span>
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
        </AnimatePresence>
    );
}
