// M2: Dedicated Tauri module — breaks circular dependency between homeState.ts and storage.ts
// M3: Caches the import Promise itself to prevent multiple concurrent dynamic imports

export interface TauriCore {
    invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
    convertFileSrc: (path: string, protocol?: string) => string;
}

let tauriPromise: Promise<TauriCore> | null = null;

export async function getTauri(): Promise<TauriCore> {
    if (!tauriPromise) {
        tauriPromise = import('@tauri-apps/api/core').then(
            (mod) => mod as unknown as TauriCore
        );
    }
    return tauriPromise;
}
