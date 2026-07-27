'use client';

import {useEffect, useRef} from 'react';
import type {LogEntry} from '../../types/log';

export default function DebugSection({logs}: {logs: LogEntry[]}) {
    const bottomRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        bottomRef.current?.scrollIntoView({behavior: 'smooth'});
    }, [logs.length]);
    return (
        <div className="h-full flex flex-col">
            <div className="text-xs text-zinc-500 mb-2">
                Total log: {logs.length}
            </div>
            <div className="flex-1 overflow-y-auto bg-black/40 rounded-xl border border-zinc-800 p-3 font-mono text-[11px] leading-relaxed space-y-1">
                {logs.length === 0 ? (
                    <div className="text-zinc-600 italic">Belum ada log</div>
                ) : (
                    logs.map((log) => (
                        <div key={log.id} className={`${log.level === 'error' ? 'text-red-400' : log.level === 'warn' ? 'text-yellow-400' : 'text-zinc-400'}`}>
                            <span className="text-zinc-600">[{log.time}]</span>
                            <span className="uppercase mx-1 text-[10px] opacity-70">[{log.level}]</span>
                            <span>{log.message}</span>
                        </div>
                    ))
                )}
                <div ref={bottomRef} />
            </div>
        </div>
    );
}
