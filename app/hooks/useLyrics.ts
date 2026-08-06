'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getTauri, isBrowserTauri } from '../lib/homeState';

interface LyricLine {
    id: number;
    timeSec: number | null;
    text: string;
}

export interface LyricsState {
    lines: LyricLine[];
    isSynced: boolean;
    source: string | null; // "lrc_file" | "embedded" | "custom"
    loading: boolean;
    activeIndex: number;
    importLyricsFile: (fileContent: string, fileName: string) => void;
}

/** Parses raw LRC format string into array of timestamped lines */
function parseLrcText(rawText: string): { lines: LyricLine[]; isSynced: boolean } {
    if (!rawText || !rawText.trim()) {
        return { lines: [], isSynced: false };
    }

    const rawLines = rawText.split(/\r?\n/);
    const parsed: LyricLine[] = [];
    const timeRegex = /\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]/g;
    let hasTimestamps = false;

    let idCounter = 0;

    for (const rawLine of rawLines) {
        const text = rawLine.replace(/\[\d{1,3}:\d{2}(?:\.\d{1,3})?\]/g, '').trim();
        const matches = Array.from(rawLine.matchAll(timeRegex));

        if (matches.length > 0) {
            hasTimestamps = true;
            for (const match of matches) {
                const minutes = parseInt(match[1], 10);
                const seconds = parseInt(match[2], 10);
                const fracStr = match[3] || '0';
                let fraction = parseFloat(`0.${fracStr}`);
                if (fracStr.length === 2) fraction = parseInt(fracStr, 10) / 100;
                if (fracStr.length === 3) fraction = parseInt(fracStr, 10) / 1000;

                const timeSec = minutes * 60 + seconds + (isNaN(fraction) ? 0 : fraction);
                parsed.push({
                    id: idCounter++,
                    timeSec,
                    text: text || '♪',
                });
            }
        } else if (text.length > 0 && !rawLine.startsWith('[ti:') && !rawLine.startsWith('[ar:') && !rawLine.startsWith('[al:')) {
            parsed.push({
                id: idCounter++,
                timeSec: null,
                text,
            });
        }
    }

    if (hasTimestamps) {
        parsed.sort((a, b) => {
            if (a.timeSec === null) return 1;
            if (b.timeSec === null) return -1;
            return a.timeSec - b.timeSec;
        });
    }

    return { lines: parsed, isSynced: hasTimestamps };
}

export function useLyrics(songPath: string | null, currentTime: number): LyricsState {
    const [rawText, setRawText] = useState<string | null>(null);
    const [source, setSource] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(false);

    // Load lyrics from Rust IPC whenever songPath changes
    useEffect(() => {
        if (!songPath) {
            setRawText(null);
            setSource(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        let isMounted = true;

        if (isBrowserTauri) {
            getTauri()
                .then((mod) => mod.invoke<{ raw_text: string; source: string } | null>('get_lyrics', { filePath: songPath }))
                .then((res) => {
                    if (!isMounted) return;
                    if (res && res.raw_text) {
                        setRawText(res.raw_text);
                        setSource(res.source);
                    } else {
                        setRawText(null);
                        setSource(null);
                    }
                })
                .catch(() => {
                    if (isMounted) {
                        setRawText(null);
                        setSource(null);
                    }
                })
                .finally(() => {
                    if (isMounted) setLoading(false);
                });
        } else {
            setRawText(null);
            setSource(null);
            setLoading(false);
        }

        return () => {
            isMounted = false;
        };
    }, [songPath]);

    const { lines, isSynced } = useMemo(() => {
        if (!rawText) return { lines: [], isSynced: false };
        return parseLrcText(rawText);
    }, [rawText]);

    // Calculate active line index based on currentTime
    const activeIndex = useMemo(() => {
        if (!isSynced || lines.length === 0) return -1;
        let index = -1;
        for (let i = 0; i < lines.length; i++) {
            const timeSec = lines[i].timeSec;
            if (timeSec !== null && timeSec <= currentTime + 0.25) { // 250ms lead-in threshold
                index = i;
            } else if (timeSec !== null && timeSec > currentTime + 0.25) {
                break;
            }
        }
        return index;
    }, [lines, isSynced, currentTime]);

    const importLyricsFile = useCallback((content: string) => {
        setRawText(content);
        setSource('custom');
    }, []);

    return {
        lines,
        isSynced,
        source,
        loading,
        activeIndex,
        importLyricsFile,
    };
}
