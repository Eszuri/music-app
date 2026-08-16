import { useCallback, useRef } from "react";

export function useVolumeFade(
    audioRef: React.RefObject<HTMLAudioElement | null>,
    fadeAudio: boolean,
    fadeDuration: number,
) {
    const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const fadeTokenRef = useRef(0);
    const fadeAudioRef = useRef(fadeAudio);
    const fadeDurationRef = useRef(fadeDuration);

    fadeAudioRef.current = fadeAudio;
    fadeDurationRef.current = fadeDuration;

    const fadeVolumeTo = useCallback(
        (targetVol: number, durationMs?: number, onComplete?: () => void) => {
            const audio = audioRef.current;
            const currentToken = ++fadeTokenRef.current;
            const dur = durationMs !== undefined ? durationMs : fadeDurationRef.current;

            if (fadeTimerRef.current) {
                clearTimeout(fadeTimerRef.current);
                fadeTimerRef.current = null;
            }

            const clampedTarget = Math.max(0, Math.min(1, targetVol));

            if (!audio || !fadeAudioRef.current || dur <= 0) {
                if (audio) audio.volume = clampedTarget;
                if (currentToken === fadeTokenRef.current) {
                    onComplete?.();
                }
                return;
            }

            const startVol = audio.volume;
            const startTime = performance.now();
            // H3: Use setTimeout instead of requestAnimationFrame to ensure
            // fade works reliably in background tabs
            const TICK_MS = 16;

            const step = () => {
                if (currentToken !== fadeTokenRef.current) return;

                const elapsed = performance.now() - startTime;
                const progress = Math.min(1, elapsed / dur);
                const current = startVol + (clampedTarget - startVol) * progress;
                if (audio) audio.volume = Math.max(0, Math.min(1, current));

                if (progress < 1) {
                    fadeTimerRef.current = setTimeout(step, TICK_MS);
                } else {
                    fadeTimerRef.current = null;
                    if (audio) audio.volume = clampedTarget;
                    if (currentToken === fadeTokenRef.current) {
                        onComplete?.();
                    }
                }
            };

            fadeTimerRef.current = setTimeout(step, TICK_MS);
        },
        [audioRef],
    );

    const cancelFade = useCallback(() => {
        fadeTokenRef.current++;
        if (fadeTimerRef.current) {
            clearTimeout(fadeTimerRef.current);
            fadeTimerRef.current = null;
        }
    }, []);

    return {
        fadeVolumeTo,
        cancelFade,
        fadeTokenRef,
        fadeAudioRef,
        fadeDurationRef,
    };
}
