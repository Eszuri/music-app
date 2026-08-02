import {useCallback, useEffect, useRef, useState} from "react";
import {safeSetLocalStorage} from "../lib/homeState";

export const GAIN_BOOST_KEY = "music-app-gain-boost";
export const MIN_GAIN = 1;   // 100% — sama seperti volume native, tidak ada boost
export const MAX_GAIN = 3;   // 300% — batas atas supaya tidak terlalu mudah clipping

function loadSavedGain(): number {
    if (typeof window === "undefined") return MIN_GAIN;
    try {
        const raw = window.localStorage.getItem(GAIN_BOOST_KEY);
        if (!raw) return MIN_GAIN;
        const parsed = parseFloat(raw);
        if (!Number.isFinite(parsed)) return MIN_GAIN;
        return Math.max(MIN_GAIN, Math.min(MAX_GAIN, parsed));
    } catch {
        return MIN_GAIN;
    }
}

/**
 * Menempelkan Web Audio API GainNode ke elemen <audio> yang sudah ada,
 * supaya volumenya bisa di-boost melebihi batas native 0–1 (sampai 300%).
 *
 * AudioContext + MediaElementSource dibuat secara lazy (browser memblokir
 * pembuatan AudioContext sebelum ada user gesture, dan createMediaElementSource
 * hanya boleh dipanggil sekali per elemen audio).
 */
export interface EqualizerAudioState {
    enabled: boolean;
    bandMode: number;
    preampDb: number;
    gains: number[];
    frequencies: number[];
}

export function useGainBoost(
    audioRef: React.RefObject<HTMLAudioElement | null>,
    equalizer?: EqualizerAudioState,
) {
    const [gain, setGainState] = useState<number>(() => loadSavedGain());
    const [supported, setSupported] = useState(true);

    const ctxRef = useRef<AudioContext | null>(null);
    const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
    const preampNodeRef = useRef<GainNode | null>(null);
    const gainNodeRef = useRef<GainNode | null>(null);
    const filtersRef = useRef<BiquadFilterNode[]>([]);
    const attachedElementRef = useRef<HTMLAudioElement | null>(null);

    const gainRef = useRef(gain);
    gainRef.current = gain;

    const eqRef = useRef(equalizer);
    eqRef.current = equalizer;

    const rebuildEqFilters = useCallback((ctx: AudioContext, freqs: number[], eq?: EqualizerAudioState): BiquadFilterNode[] => {
        return freqs.map((freq, i) => {
            const filter = ctx.createBiquadFilter();
            if (i === 0) {
                filter.type = 'lowshelf';
            } else if (i === freqs.length - 1) {
                filter.type = 'highshelf';
            } else {
                filter.type = 'peaking';
                filter.Q.value = 1.4;
            }
            filter.frequency.value = freq;

            const db = eq?.enabled ? (eq.gains[i] ?? 0) : 0;
            filter.gain.value = db;
            return filter;
        });
    }, []);

    const connectGraph = useCallback(() => {
        const source = sourceNodeRef.current;
        const preamp = preampNodeRef.current;
        const gainNode = gainNodeRef.current;
        const filters = filtersRef.current;
        if (!source || !preamp || !gainNode) return;

        try {
            source.disconnect();
            preamp.disconnect();
            filters.forEach((f) => f.disconnect());
            gainNode.disconnect();

            // Connect: source ➔ preamp ➔ filter[0] ➔ ... ➔ filter[N-1] ➔ gainNode ➔ destination
            let lastNode: AudioNode = source;
            lastNode.connect(preamp);
            lastNode = preamp;

            filters.forEach((filter) => {
                lastNode.connect(filter);
                lastNode = filter;
            });

            lastNode.connect(gainNode);
            gainNode.connect(ctxRef.current!.destination);
        } catch (e) {
            console.warn("useGainBoost: failed to connect audio graph", e);
        }
    }, []);

    const ensureGraph = useCallback(() => {
        const audio = audioRef.current;
        if (!audio) return null;

        // Sudah tersambung ke elemen audio yang sama, tidak perlu diulang.
        if (attachedElementRef.current === audio && gainNodeRef.current) {
            return gainNodeRef.current;
        }

        try {
            const AudioCtxCtor =
                window.AudioContext ||
                (window as unknown as {webkitAudioContext?: typeof AudioContext})
                    .webkitAudioContext;
            if (!AudioCtxCtor) {
                setSupported(false);
                return null;
            }

            const ctx = ctxRef.current ?? new AudioCtxCtor();
            ctxRef.current = ctx;

            const source = ctx.createMediaElementSource(audio);
            sourceNodeRef.current = source;

            const preamp = ctx.createGain();
            const eq = eqRef.current;
            const preampLinear = eq?.enabled ? Math.pow(10, (eq.preampDb ?? 0) / 20) : 1;
            preamp.gain.value = preampLinear;
            preampNodeRef.current = preamp;

            const freqs = eq?.frequencies ?? [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
            const filters = rebuildEqFilters(ctx, freqs, eq);
            filtersRef.current = filters;

            const gainNode = ctx.createGain();
            gainNode.gain.value = gainRef.current;
            gainNodeRef.current = gainNode;

            attachedElementRef.current = audio;
            connectGraph();

            return gainNode;
        } catch (e) {
            console.warn("useGainBoost: gagal inisialisasi Web Audio graph", e);
            setSupported(false);
            return null;
        }
    }, [audioRef, rebuildEqFilters, connectGraph]);

    // Sambungkan graph saat audio mulai diputar
    useEffect(() => {
        let attachedAudio: HTMLAudioElement | null = null;

        const handlePlay = () => {
            const node = ensureGraph();
            if (ctxRef.current?.state === "suspended") {
                ctxRef.current.resume().catch(() => {});
            }
            if (node) node.gain.value = gainRef.current;
        };

        const timer = setInterval(() => {
            const audio = audioRef.current;
            if (audio && audio !== attachedAudio) {
                if (attachedAudio) {
                    attachedAudio.removeEventListener("play", handlePlay);
                }
                audio.addEventListener("play", handlePlay);
                attachedAudio = audio;
            }
        }, 100);

        return () => {
            clearInterval(timer);
            if (attachedAudio) {
                attachedAudio.removeEventListener("play", handlePlay);
            }
        };
    }, [audioRef, ensureGraph]);

    // Sinkronkan GainNode setiap kali state gain berubah
    useEffect(() => {
        if (gainNodeRef.current) {
            gainNodeRef.current.gain.value = gain;
        }
        safeSetLocalStorage(GAIN_BOOST_KEY, String(gain));
    }, [gain]);

    // Sinkronkan Equalizer & Preamp setiap kali state equalizer berubah
    useEffect(() => {
        const ctx = ctxRef.current;
        const eq = equalizer;
        if (!ctx || !eq) return;

        // Sync Preamp gain
        if (preampNodeRef.current) {
            const preampLinear = eq.enabled ? Math.pow(10, (eq.preampDb ?? 0) / 20) : 1;
            preampNodeRef.current.gain.setValueAtTime(preampLinear, ctx.currentTime);
        }

        // If band count changed, rebuild filters & reconnect graph
        if (filtersRef.current.length !== eq.frequencies.length) {
            filtersRef.current = rebuildEqFilters(ctx, eq.frequencies, eq);
            connectGraph();
        } else {
            // Update gain on existing filters
            filtersRef.current.forEach((filter, i) => {
                const db = eq.enabled ? (eq.gains[i] ?? 0) : 0;
                filter.gain.setValueAtTime(db, ctx.currentTime);
            });
        }
    }, [equalizer, rebuildEqFilters, connectGraph]);

    // Tutup AudioContext saat unmount.
    useEffect(() => {
        return () => {
            ctxRef.current?.close().catch(() => {});
            ctxRef.current = null;
        };
    }, []);

    const setGain = useCallback((value: number) => {
        const clamped = Math.max(MIN_GAIN, Math.min(MAX_GAIN, value));
        setGainState(clamped);
    }, []);

    return {gain, setGain, supported, minGain: MIN_GAIN, maxGain: MAX_GAIN};
}
