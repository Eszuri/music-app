import {useCallback, useEffect, useRef, useState} from 'react';
import type {LogEntry} from '../types/log';

export function useAppLogging() {
    const [debugError, setDebugError] = useState('');
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [toastVisible, setToastVisible] = useState(false);
    const logIdRef = useRef(0);
    const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const origConsoleRef = useRef({error: console.error.bind(console), warn: console.warn.bind(console)});

    const addLog = useCallback((level: string, message: string) => {
        const id = ++logIdRef.current;
        const now = new Date();
        const time = now.toLocaleTimeString(undefined, {hour: '2-digit', minute: '2-digit', second: '2-digit'});
        const entry: LogEntry = {id, time, level, message};
        setLogs(prev => [...prev.slice(-499), entry]);
        if (level === 'error') {
            origConsoleRef.current.error(message);
        } else if (level === 'warn') {
            origConsoleRef.current.warn(message);
        }
    }, []);

    const showError = useCallback((msg: string) => {
        setDebugError(msg);
        addLog('error', msg);
        setToastVisible(true);
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => setToastVisible(false), 4000);
    }, [addLog]);

    useEffect(() => {
        const orig = origConsoleRef.current;
        const handler = (ev: ErrorEvent) => {
            const text = ev.error?.message || ev.message || '';
            if (text.includes('AbortError') || text.includes('abort')) return;
            addLog('error', `[RENDER] ${text.slice(0, 200)}`);
        };
        const rejectionHandler = (e: PromiseRejectionEvent) => {
            const text = e.reason?.message || String(e.reason || '');
            if (text.includes('AbortError') || text.includes('abort')) return;
            addLog('error', `[PROMISE] ${text.slice(0, 200)}`);
        };
        console.error = (...args: unknown[]) => {
            const text = args.map(a => String(a)).join(' ');
            if (!text.includes('AbortError')) {
                addLog('error', `[CONSOLE] ${text.slice(0, 200)}`);
            }
            orig.error(...args);
        };
        console.warn = (...args: unknown[]) => {
            const text = args.map(a => String(a)).join(' ');
            addLog('warn', `[CONSOLE] ${text.slice(0, 200)}`);
            orig.warn(...args);
        };
        window.addEventListener('error', handler);
        window.addEventListener('unhandledrejection', rejectionHandler);
        return () => {
            console.error = orig.error;
            console.warn = orig.warn;
            window.removeEventListener('error', handler);
            window.removeEventListener('unhandledrejection', rejectionHandler);
        };
    }, [addLog]);

    return {
        debugError,
        setDebugError,
        logs,
        toastVisible,
        setToastVisible,
        addLog,
        showError,
    };
}
