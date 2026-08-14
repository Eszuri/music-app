import { useCallback, useRef } from "react";

export function useVolumeFade(
    audioRef: React.RefObject<HTMLAudioElement | null>,
    fadeAudio: boolean,
    fadeDuration: number,
) {
    const fadeAnimationRef = useRef<number | null>(null);
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

            if (fadeAnimationRef.current) {
                cancelAnimationFrame(fadeAnimationRef.current);
                fadeAnimationRef.current = null;
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

            const step = (now: number) => {
                if (currentToken !== fadeTokenRef.current) return;

                const elapsed = now - startTime;
                const progress = Math.min(1, elapsed / dur);
                const current = startVol + (clampedTarget - startVol) * progress;
                if (audio) audio.volume = Math.max(0, Math.min(1, current));

                if (progress < 1) {
                    fadeAnimationRef.current = requestAnimationFrame(step);
                } else {
                    fadeAnimationRef.current = null;
                    if (audio) audio.volume = clampedTarget;
                    if (currentToken === fadeTokenRef.current) {
                        onComplete?.();
                    }
                }
            };

            fadeAnimationRef.current = requestAnimationFrame(step);
        },
        [audioRef],
    );

    const cancelFade = useCallback(() => {
        fadeTokenRef.current++;
        if (fadeAnimationRef.current) {
            cancelAnimationFrame(fadeAnimationRef.current);
            fadeAnimationRef.current = null;
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
