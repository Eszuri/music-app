import {useCallback, useRef, useState} from 'react';
import {isBrowserTauri} from '../lib/homeState';

interface UseAppUpdaterOptions {
    addLog: (level: string, message: string) => void;
}

export function useAppUpdater(options: UseAppUpdaterOptions) {
    const {addLog} = options;
    const [updateChecking, setUpdateChecking] = useState(false);
    const [updateStatus, setUpdateStatus] = useState('');
    const [updateDownloaded, setUpdateDownloaded] = useState(0);
    const [updateTotal, setUpdateTotal] = useState(0);
    const updateTotalRef = useRef(0);

    const handleCheckUpdate = useCallback(async () => {
        if (!isBrowserTauri) {
            setUpdateStatus('Hanya tersedia di aplikasi desktop');
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
                setUpdateStatus(`v${update.version} tersedia. Mendownload...`);
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
                setUpdateStatus(`v${update.version} siap. Menginstall...`);
                await update.install();
            } else {
                setUpdateStatus('Sudah versi terbaru');
            }
        } catch (e) {
            const msg = String(e);
            setUpdateStatus(`Error: ${msg.slice(0, 80)}`);
            addLog('error', `Update check failed: ${msg}`);
        } finally {
            setUpdateChecking(false);
            setUpdateDownloaded(0);
            setUpdateTotal(0);
            updateTotalRef.current = 0;
        }
    }, [addLog]);

    return {
        updateChecking,
        updateStatus,
        updateDownloaded,
        updateTotal,
        handleCheckUpdate,
    };
}
