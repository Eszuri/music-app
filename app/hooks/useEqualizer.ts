import {useCallback, useEffect, useRef, useState} from 'react';
import {getStoredValue, setStoredValue} from '../lib/storage';

export type EQBandMode = 5 | 10 | 15 | 31;

const EQ_BAND_FREQUENCIES: Record<EQBandMode, number[]> = {
    5: [60, 230, 910, 3600, 14000],
    10: [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000],
    15: [25, 40, 63, 100, 160, 250, 400, 630, 1000, 1600, 2500, 4000, 6300, 10000, 16000],
    31: [
        20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630,
        800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000,
        12500, 16000, 20000,
    ],
};

export type EQPresetKey =
    | 'flat'
    | 'bassBoost'
    | 'trebleBoost'
    | 'rock'
    | 'pop'
    | 'jazz'
    | 'classical'
    | 'electronic'
    | 'vocal'
    | 'custom';

// Generator for default preset values according to band count
function getPresetGains(bandMode: EQBandMode, presetKey: EQPresetKey): number[] {
    const count = bandMode;
    if (presetKey === 'flat' || presetKey === 'custom') {
        return new Array(count).fill(0);
    }

    return EQ_BAND_FREQUENCIES[bandMode].map((freq) => {
        if (presetKey === 'bassBoost') {
            if (freq <= 100) return 5;
            if (freq <= 250) return 3;
            if (freq <= 500) return 1.5;
            return 0;
        }
        if (presetKey === 'trebleBoost') {
            if (freq >= 8000) return 5.5;
            if (freq >= 4000) return 4;
            if (freq >= 2000) return 2.5;
            if (freq >= 1000) return 1;
            return 0;
        }
        if (presetKey === 'rock') {
            if (freq <= 64) return 4.5;
            if (freq <= 125) return 2.5;
            if (freq <= 500) return 0;
            if (freq <= 2000) return 1;
            if (freq <= 8000) return 3.5;
            return 5;
        }
        if (presetKey === 'pop') {
            if (freq <= 100) return 1.5;
            if (freq <= 500) return 3;
            if (freq <= 2000) return 1.5;
            if (freq <= 8000) return 2.5;
            return 1.5;
        }
        if (presetKey === 'jazz') {
            if (freq <= 100) return 2.5;
            if (freq <= 500) return 1.5;
            if (freq <= 2000) return -1;
            if (freq <= 8000) return 1.5;
            return 3;
        }
        if (presetKey === 'classical') {
            if (freq <= 100) return 3;
            if (freq <= 500) return 1.5;
            if (freq <= 2000) return 0;
            if (freq <= 8000) return 2.5;
            return 3.5;
        }
        if (presetKey === 'electronic') {
            if (freq <= 64) return 5;
            if (freq <= 250) return 3;
            if (freq <= 1000) return -1.5;
            if (freq <= 4000) return 1.5;
            if (freq <= 10000) return 4;
            return 5;
        }
        if (presetKey === 'vocal') {
            if (freq <= 125) return -2.5;
            if (freq <= 500) return 1;
            if (freq <= 4000) return 3.5;
            if (freq <= 8000) return 1.5;
            return 0;
        }
        return 0;
    });
}

export interface EqualizerState {
    enabled: boolean;
    bandMode: EQBandMode;
    preampDb: number; // -12 to +12 dB
    autoPreamp: boolean; // Auto-attenuate preamp to prevent distortion
    preset: EQPresetKey;
    gains: number[]; // N values for current bandMode
    zoomLevel: number; // 1.0 to 2.0
}

const DEFAULT_STATE: EqualizerState = {
    enabled: true,
    bandMode: 10,
    preampDb: 0,
    autoPreamp: true,
    preset: 'flat',
    gains: new Array(10).fill(0),
    zoomLevel: 1,
};

function loadSavedEqualizer(): EqualizerState {
    const eq = getStoredValue('equalizer');
    if (eq && typeof eq === 'object') {
        const enabled = typeof eq.enabled === 'boolean' ? eq.enabled : false;
        const preset = typeof eq.preset === 'string' ? (eq.preset as EQPresetKey) : 'flat';
        const preampDb = Math.max(-12, Math.min(12, Number(eq.pre_amp) || 0));
        // H2: Infer bandMode from saved bands length, fallback to 10
        const savedBandCount = Array.isArray(eq.bands) ? eq.bands.length : 0;
        const validBandModes: EQBandMode[] = [5, 10, 15, 31];
        const bandMode: EQBandMode = validBandModes.includes(savedBandCount as EQBandMode)
            ? (savedBandCount as EQBandMode)
            : 10;
        const gains = Array.isArray(eq.bands) && eq.bands.length === bandMode
            ? eq.bands.map((v: number) => Math.max(-12, Math.min(12, Number(v) || 0)))
            : getPresetGains(bandMode, preset);
        return {
            enabled,
            bandMode,
            preampDb,
            autoPreamp: true,
            preset,
            gains,
            zoomLevel: 1,
        };
    }
    return DEFAULT_STATE;
}

export function useEqualizer() {
    const [state, setState] = useState<EqualizerState>(() => loadSavedEqualizer());
    const stateRef = useRef(state);
    stateRef.current = state;

    useEffect(() => {
        setStoredValue('equalizer', {
            enabled: state.enabled,
            preset: state.preset,
            bands: state.gains,
            pre_amp: state.preampDb,
        }, { debounceMs: 200 });
    }, [state]);

    const setEnabled = useCallback((enabled: boolean) => {
        setState((prev) => ({...prev, enabled}));
    }, []);

    const toggleEnabled = useCallback(() => {
        setState((prev) => ({...prev, enabled: !prev.enabled}));
    }, []);

    const setAutoPreamp = useCallback((autoPreamp: boolean) => {
        setState((prev) => ({...prev, autoPreamp}));
    }, []);

    const toggleAutoPreamp = useCallback(() => {
        setState((prev) => ({...prev, autoPreamp: !prev.autoPreamp}));
    }, []);

    const setBandMode = useCallback((bandMode: EQBandMode) => {
        setState((prev) => {
            if (prev.bandMode === bandMode) return prev;
            const newGains = getPresetGains(bandMode, prev.preset);
            return {
                ...prev,
                bandMode,
                gains: newGains,
            };
        });
    }, []);

    const setPreampDb = useCallback((db: number) => {
        const clamped = Math.max(-12, Math.min(12, db));
        setState((prev) => ({...prev, preampDb: clamped}));
    }, []);

    const setPreset = useCallback((presetKey: EQPresetKey) => {
        setState((prev) => {
            if (presetKey === 'custom') {
                return {...prev, preset: 'custom'};
            }
            const newGains = getPresetGains(prev.bandMode, presetKey);
            return {
                ...prev,
                preset: presetKey,
                gains: newGains,
            };
        });
    }, []);

    const setBandGain = useCallback((index: number, gainDb: number) => {
        const clamped = Math.max(-12, Math.min(12, gainDb));
        setState((prev) => {
            const nextGains = [...prev.gains];
            nextGains[index] = clamped;
            return {
                ...prev,
                preset: 'custom',
                gains: nextGains,
            };
        });
    }, []);

    const setZoomLevel = useCallback((zoomLevel: number) => {
        const clamped = Math.max(1, Math.min(2, zoomLevel));
        setState((prev) => ({...prev, zoomLevel: clamped}));
    }, []);

    const resetFlat = useCallback(() => {
        setState((prev) => ({
            ...prev,
            preampDb: 0,
            preset: 'flat',
            gains: getPresetGains(prev.bandMode, 'flat'),
        }));
    }, []);

    return {
        enabled: state.enabled,
        bandMode: state.bandMode,
        preampDb: state.preampDb,
        autoPreamp: state.autoPreamp,
        preset: state.preset,
        gains: state.gains,
        zoomLevel: state.zoomLevel,
        frequencies: EQ_BAND_FREQUENCIES[state.bandMode],
        setEnabled,
        toggleEnabled,
        setAutoPreamp,
        toggleAutoPreamp,
        setBandMode,
        setPreampDb,
        setPreset,
        setBandGain,
        setZoomLevel,
        resetFlat,
        stateRef,
    };
}
