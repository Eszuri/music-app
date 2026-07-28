import {useCallback, useRef, useState} from 'react';
import {isBrowserTauri} from '../lib/homeState';
import {t, type Lang} from '../lib/translations';

interface UseAppUpdaterOptions {
    addLog: (level: string, message: string) => void;
    lang: Lang;
}

export function useAppUpdater(options: UseAppUpdaterOptions) {
    const {addLog, lang} = options;
    const [updateChecking, setUpdateChecking] = useState(false);
    const [updateStatus, setUpdateStatus] = useState('');
    const [updateDownloaded, setUpdateDownloaded] = useState(0);
    const [updateTotal, setUpdateTotal] = useState(0);
    const updateTotalRef = useRef(0);

    const handleCheckUpdate = useCallback(async () => {
        if (!isBrowserTauri) {
            setUpdateStatus(t(lang, 'general.update.desktopOnly'));
            return;
        }
        setUpdateChecking(true);
        setUpdateStatus('');
        setUpdateDownloaded(0);
        setUpdateTotal(0);
        updateTotalRef.current = 0;
        try {
            const {check} = await import('@tauri-apps/plugin-updater');
            const update = await check();
            if (update) {
                setUpdateStatus(t(lang, 'general.update.available', {version: update.version}));
                await update.download((ev) => {
                    if (ev.event === 'Started') {
                        const total = ev.data.contentLength ?? 0;
                        updateTotalRef.current = total;
                        setUpdateTotal(total);
                        setUpdateDownloaded(0);
                    } else if (ev.event === 'Progress') {
                        setUpdateDownloaded((d) => d + ev.data.chunkLength);
                    }
                });
                const total = updateTotalRef.current;
                if (total > 0) setUpdateDownloaded(total);
                setUpdateStatus(t(lang, 'general.update.installing', {version: update.version}));
                await update.install();
            } else {
                setUpdateStatus(t(lang, 'general.update.latest'));
            }
        } catch (e) {
            const msg = String(e);
            setUpdateStatus(t(lang, 'general.update.error', {msg: msg.slice(0, 80)}));
            addLog('error', `Update check failed: ${msg}`);
        } finally {
            setUpdateChecking(false);
            setUpdateDownloaded(0);
            setUpdateTotal(0);
            updateTotalRef.current = 0;
        }
    }, [addLog, lang]);

    return {
        updateChecking,
        updateStatus,
        updateDownloaded,
        updateTotal,
        handleCheckUpdate,
    };
}
