import { useCallback } from "react";
import { isBrowserTauri } from "../../lib/homeState";

export function useAudioSrc() {
    const getAudioSrc = useCallback((filePath: string): string => {
        if (isBrowserTauri() && typeof window !== "undefined") {
            const internals = (window as unknown as {
                __TAURI_INTERNALS__?: {
                    convertFileSrc: (p: string, protocol?: string) => string;
                };
            }).__TAURI_INTERNALS__;
            if (internals?.convertFileSrc) {
                return internals.convertFileSrc(filePath, "stream");
            }
        }
        return filePath;
    }, []);

    return { getAudioSrc };
}
