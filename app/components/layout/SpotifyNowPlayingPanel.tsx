"use client";

import type { FileEntry } from "../FolderExplorer";
import type { SongMetadata } from "../PlayerPanel";
import { t, type Lang } from "../../lib/translations";

interface SpotifyNowPlayingPanelProps {
    lang: Lang;
    selectedSong: FileEntry | null;
    metadata: SongMetadata | null;
    coverDataUrl: string | null;
    files: FileEntry[];
    onClose: () => void;
    onOpenEditMetadata?: (file?: FileEntry) => void;
}

export default function SpotifyNowPlayingPanel({
    lang,
    selectedSong,
    metadata,
    coverDataUrl,
    files,
    onClose,
    onOpenEditMetadata,
}: SpotifyNowPlayingPanelProps) {
    const title = metadata?.title || selectedSong?.name.replace(/\.[^/.]+$/, "") || t(lang, "player.noTrackSelected");
    const artist = metadata?.artist || (selectedSong ? t(lang, "player.unknownArtist") : "Symvonia");
    const album = metadata?.album || (selectedSong ? t(lang, "player.unknownAlbum") : "Local Collection");

    // Find next track in current folder files list
    const currentIndex = selectedSong ? files.findIndex(f => f.path === selectedSong.path) : -1;
    const nextSong = currentIndex >= 0 && currentIndex < files.length - 1 ? files[currentIndex + 1] : null;

    return (
        <aside className="w-72 sm:w-80 h-full bg-zinc-900/95 rounded-lg p-3.5 sm:p-4 flex flex-col gap-3.5 sm:gap-4 border border-zinc-800/80 select-none shrink-0 overflow-y-auto custom-scrollbar shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between text-zinc-200">
                <span className="font-bold text-sm">{t(lang, 'spotify.nowPlaying')}</span>
                <button
                    onClick={onClose}
                    className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                    title={t(lang, 'spotify.closePanel')}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
            </div>

            {/* High Res Artwork */}
            <div className="w-full aspect-square rounded-lg overflow-hidden bg-zinc-800 border border-zinc-700/40 shadow-xl relative group">
                {coverDataUrl ? (
                    <img
                        src={coverDataUrl}
                        alt="Cover"
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-850 text-zinc-600 gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <circle cx="12" cy="12" r="10" />
                            <circle cx="12" cy="12" r="3" />
                        </svg>
                        <span className="text-xs text-zinc-500 font-medium">{t(lang, 'spotify.noCoverArt')}</span>
                    </div>
                )}
            </div>

            {/* Title & Artist */}
            <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                    <h3 className="font-bold text-lg text-zinc-100 truncate hover:underline cursor-pointer" title={title}>
                        {title}
                    </h3>
                    {onOpenEditMetadata && (
                        <button
                            onClick={() => onOpenEditMetadata(selectedSong || undefined)}
                            className="text-xs text-zinc-400 hover:text-white p-1 rounded hover:bg-zinc-800 transition-colors shrink-0"
                            title={t(lang, 'spotify.editMetadata')}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 20h9" />
                                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                            </svg>
                        </button>
                    )}
                </div>
                <p className="text-sm font-medium text-zinc-300 truncate">{artist}</p>
                <p className="text-xs text-zinc-400 truncate">{album}</p>
            </div>

            {/* Technical Audio Card */}
            <div className="bg-zinc-950/60 rounded-lg p-3 border border-zinc-800/60 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs text-zinc-400 font-medium">
                    <span>{t(lang, 'spotify.audioQuality')}</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 text-[10px] font-bold border border-emerald-500/30 uppercase">
                        {selectedSong?.ext || "AUDIO"}
                    </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-zinc-800/40">
                    <div>
                        <span className="text-zinc-500 text-[11px] block">{t(lang, 'spotify.bitrate')}</span>
                        <span className="text-zinc-200 font-semibold">{metadata?.bitrate ? `${metadata.bitrate} kbps` : "-"}</span>
                    </div>
                    <div>
                        <span className="text-zinc-500 text-[11px] block">{t(lang, 'spotify.sampleRate')}</span>
                        <span className="text-zinc-200 font-semibold">{metadata?.sample_rate ? `${metadata.sample_rate} Hz` : "-"}</span>
                    </div>
                </div>
            </div>

            {/* Next Track in Queue Preview Card */}
            {nextSong && (
                <div className="bg-zinc-850/80 rounded-lg p-3 border border-zinc-800/50 flex flex-col gap-2">
                    <span className="text-xs font-bold text-zinc-300">{t(lang, 'spotify.nextInQueue')}</span>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded bg-zinc-800 flex items-center justify-center shrink-0 text-emerald-400 border border-zinc-700/50">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M9 18V5l12-2v13" />
                                <circle cx="6" cy="18" r="3" />
                                <circle cx="18" cy="16" r="3" />
                            </svg>
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-xs font-semibold text-zinc-200 truncate">{nextSong.name}</span>
                            <span className="text-[11px] text-zinc-400">{t(lang, 'spotify.audioTrack')}</span>
                        </div>
                    </div>
                </div>
            )}
        </aside>
    );
}
