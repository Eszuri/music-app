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

export interface LibraryCacheInvalidatedEvent {
    root_path: string;
    affected_paths: string[];
}

export async function listenTauri<T>(
    eventName: string,
    handler: (payload: T) => void,
): Promise<() => void> {
    const {listen} = await import('@tauri-apps/api/event');
    const unlisten = await listen<T>(eventName, (event) => handler(event.payload));
    return unlisten;
}
