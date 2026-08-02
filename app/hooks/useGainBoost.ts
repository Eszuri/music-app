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
export function useGainBoost(audioRef: React.RefObject<HTMLAudioElement | null>) {
    const [gain, setGainState] = useState<number>(() => loadSavedGain());
    const [supported, setSupported] = useState(true);

    const ctxRef = useRef<AudioContext | null>(null);
    const gainNodeRef = useRef<GainNode | null>(null);
    const attachedElementRef = useRef<HTMLAudioElement | null>(null);
    const gainRef = useRef(gain);
    gainRef.current = gain;

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
            const gainNode = ctx.createGain();
            gainNode.gain.value = gainRef.current;

            source.connect(gainNode);
            gainNode.connect(ctx.destination);

            gainNodeRef.current = gainNode;
            attachedElementRef.current = audio;
            return gainNode;
        } catch (e) {
            // createMediaElementSource melempar error jika dipanggil dua kali
            // pada elemen yang sama (mis. React StrictMode double-invoke).
            // Anggap saja fitur boost tidak tersedia, jangan sampai crash playback.
            console.warn("useGainBoost: gagal inisialisasi Web Audio graph", e);
            setSupported(false);
            return null;
        }
    }, [audioRef]);

    // Sambungkan graph saat audio mulai diputar (dibutuhkan agar AudioContext
    // resume setelah user gesture, sesuai autoplay policy browser).
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

    // Sinkronkan GainNode setiap kali state gain berubah + simpan ke localStorage.
    useEffect(() => {
        if (gainNodeRef.current) {
            gainNodeRef.current.gain.value = gain;
        }
        safeSetLocalStorage(GAIN_BOOST_KEY, String(gain));
    }, [gain]);

    // Tutup AudioContext saat komponen benar-benar unmount.
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
