import {useCallback, useEffect, useRef, useState} from "react";
import {getStoredValue, setStoredValue} from "../lib/storage";

const DEFAULT_GAIN = 1; // 100%
const MIN_GAIN = 1; // 100%
const MAX_GAIN = 3; // 300%

function loadSavedGain(): number {
    const val = getStoredValue('gain_boost', DEFAULT_GAIN);
    if (typeof val === 'number' && !isNaN(val) && val >= MIN_GAIN && val <= MAX_GAIN) {
        return val;
    }
    return DEFAULT_GAIN;
}

/** Get optimal Q factor according to number of EQ bands to prevent filter overlap distortion */
function getQFactorForBands(bandCount: number): number {
    if (bandCount <= 5) return 0.85;
    if (bandCount <= 10) return 1.414;
    if (bandCount <= 15) return 2.1;
    return 4.31; // ISO 1/3 Octave standard Q for 31-band EQ
}

export interface EqualizerAudioState {
    enabled: boolean;
    bandMode: number;
    preampDb: number;
    autoPreamp?: boolean;
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
    const limiterNodeRef = useRef<DynamicsCompressorNode | null>(null);
    const filtersRef = useRef<BiquadFilterNode[]>([]);

    const gainRef = useRef(gain);
    gainRef.current = gain;

    const eqRef = useRef(equalizer);
    eqRef.current = equalizer;

    const rebuildEqFilters = useCallback((ctx: AudioContext, freqs: number[], eq?: EqualizerAudioState): BiquadFilterNode[] => {
        const qVal = getQFactorForBands(freqs.length);
        return freqs.map((freq, i) => {
            const filter = ctx.createBiquadFilter();
            if (i === 0) {
                filter.type = 'lowshelf';
            } else if (i === freqs.length - 1) {
                filter.type = 'highshelf';
            } else {
                filter.type = 'peaking';
                filter.Q.value = qVal;
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
        const limiter = limiterNodeRef.current;
        const filters = filtersRef.current;
        if (!source || !preamp || !gainNode || !limiter || !ctxRef.current) return;

        try {
            source.disconnect();
            preamp.disconnect();
            filters.forEach((f) => f.disconnect());
            gainNode.disconnect();
            limiter.disconnect();

            // Connect: source ➔ preamp ➔ filter[0] ➔ ... ➔ filter[N-1] ➔ gainNode ➔ limiter ➔ destination
            let lastNode: AudioNode = preamp;
            source.connect(preamp);

            filters.forEach((filter) => {
                lastNode.connect(filter);
                lastNode = filter;
            });

            lastNode.connect(gainNode);
            gainNode.connect(limiter);
            limiter.connect(ctxRef.current.destination);
        } catch (e) {
            console.error("[useGainBoost] Error connecting AudioContext graph:", e);
        }
    }, []);

    const ensureGraph = useCallback(() => {
        const audio = audioRef.current;
        if (!audio) return null;

        try {
            if (!ctxRef.current) {
                const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
                ctxRef.current = new AudioCtx();
            }

            const ctx = ctxRef.current;

            if (!sourceNodeRef.current) {
                sourceNodeRef.current = ctx.createMediaElementSource(audio);
            }
            if (!preampNodeRef.current) {
                preampNodeRef.current = ctx.createGain();
            }
            if (!gainNodeRef.current) {
                gainNodeRef.current = ctx.createGain();
                gainNodeRef.current.gain.value = gainRef.current;
            }
            if (!limiterNodeRef.current) {
                const comp = ctx.createDynamicsCompressor();
                comp.threshold.value = -0.5; // Trigger just before 0 dBFS clipping
                comp.knee.value = 3.0; // Soft knee for clean transparent limiting
                comp.ratio.value = 20.0; // Brickwall ratio
                comp.attack.value = 0.002; // Fast 2ms attack
                comp.release.value = 0.05; // 50ms release
                limiterNodeRef.current = comp;
            }

            const freqs = eqRef.current?.frequencies ?? [];
            if (filtersRef.current.length !== freqs.length) {
                filtersRef.current = rebuildEqFilters(ctx, freqs, eqRef.current);
            }

            connectGraph();
            return gainNodeRef.current;
        } catch (e) {
            console.warn("[useGainBoost] Web Audio API failed:", e);
            setSupported(false);
            return null;
        }
    }, [audioRef, rebuildEqFilters, connectGraph]);

    // Connect graph on audio playback
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handlePlay = () => {
            const node = ensureGraph();
            if (ctxRef.current?.state === "suspended") {
                ctxRef.current.resume().catch(() => {});
            }
            if (node) node.gain.value = gainRef.current;
        };

        audio.addEventListener("play", handlePlay);
        return () => {
            audio.removeEventListener("play", handlePlay);
        };
    }, [audioRef.current, ensureGraph]);

    // Sync GainNode state
    useEffect(() => {
        if (gainNodeRef.current && ctxRef.current) {
            gainNodeRef.current.gain.setTargetAtTime(gain, ctxRef.current.currentTime, 0.015);
        }
        setStoredValue('gain_boost', gain, { debounceMs: 150 });
    }, [gain]);

    // Sync Equalizer & Preamp state live without clicks or pops
    useEffect(() => {
        const ctx = ctxRef.current;
        const eq = equalizer;
        if (!ctx || !eq) return;

        // Calculate auto-preamp headroom protection
        const maxBoost = eq.enabled ? Math.max(0, ...(eq.gains ?? [])) : 0;
        const autoPreamp = eq.autoPreamp !== false;
        const effectivePreampDb = eq.enabled
            ? (autoPreamp ? (eq.preampDb ?? 0) - maxBoost : (eq.preampDb ?? 0))
            : 0;
        const preampLinear = Math.pow(10, effectivePreampDb / 20);

        if (preampNodeRef.current) {
            preampNodeRef.current.gain.setTargetAtTime(preampLinear, ctx.currentTime, 0.015);
        }

        // Rebuild filters if band count changed
        if (filtersRef.current.length !== eq.frequencies.length) {
            filtersRef.current = rebuildEqFilters(ctx, eq.frequencies, eq);
            connectGraph();
        } else {
            // Update filter gains smoothly
            filtersRef.current.forEach((filter, i) => {
                const db = eq.enabled ? (eq.gains[i] ?? 0) : 0;
                filter.gain.setTargetAtTime(db, ctx.currentTime, 0.015);
            });
        }
    }, [equalizer, rebuildEqFilters, connectGraph]);

    // Clean up AudioContext and nodes on unmount
    useEffect(() => {
        return () => {
            try {
                sourceNodeRef.current?.disconnect();
                preampNodeRef.current?.disconnect();
                filtersRef.current.forEach((f) => f.disconnect());
                gainNodeRef.current?.disconnect();
                limiterNodeRef.current?.disconnect();
                ctxRef.current?.close().catch(() => {});
            } catch {
                // ignore
            }
        };
    }, []);

    const setGain = useCallback((newGain: number) => {
        const clamped = Math.max(MIN_GAIN, Math.min(MAX_GAIN, newGain));
        setGainState(clamped);
        setStoredValue('gain_boost', clamped, { debounceMs: 150 });
    }, []);

    return {
        gain,
        setGain,
        minGain: MIN_GAIN,
        maxGain: MAX_GAIN,
        supported,
    };
}
