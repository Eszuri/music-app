"use client";

import { useState } from "react";
import type { FileEntry } from "../FolderExplorer";
import type { SongMetadata } from "../PlayerPanel";
import { t, type Lang } from "../../lib/translations";

interface SpotifyMainSectionProps {
    lang: Lang;
    files: FileEntry[];
    selectedSong: FileEntry | null;
    metadata: SongMetadata | null;
    displayPath: string;
    musicFolder: string | null;
    isPlaying: boolean;
    goUp: () => void;
    setCurrentPath: (path: string) => void;
    playSong: (file: FileEntry) => void;
    togglePlayPause: () => void;
}

function formatDuration(sec: number): string {
    if (!sec || isNaN(sec)) return "--:--";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
}

export default function SpotifyMainSection({
    lang,
    files,
    selectedSong,
    metadata,
    displayPath,
    musicFolder,
    isPlaying,
    goUp,
    setCurrentPath,
    playSong,
    togglePlayPause,
}: SpotifyMainSectionProps) {
    const [searchFilter, setSearchFilter] = useState("");

    const folderName = displayPath.split(/[/\\]/).pop() || "Folder Musik";
    const audioFiles = files.filter(f => !f.is_dir);
    const displayedFiles = files.filter(file => {
        if (!searchFilter) return true;
        return file.name.toLowerCase().includes(searchFilter.toLowerCase());
    });

    return (
        <main className="flex-1 min-w-0 bg-zinc-900/90 rounded-lg flex flex-col border border-zinc-800/50 overflow-hidden select-none">
            {/* Top Navigation & Header */}
            <div className="bg-gradient-to-b from-emerald-950/40 via-zinc-900/60 to-zinc-900 p-4 sm:p-6 flex flex-col gap-4 sm:gap-6 border-b border-zinc-800/40">
                {/* Header Controls */}
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={goUp}
                            className="w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-zinc-300 hover:text-white flex items-center justify-center transition-colors"
                            title="Ke Folder Induk (Go Up)"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                <path d="m15 18-6-6 6-6" />
                            </svg>
                        </button>
                    </div>

                    {/* Search Field */}
                    <div className="relative max-w-[220px] sm:max-w-xs w-full">
                        <input
                            type="text"
                            value={searchFilter}
                            onChange={(e) => setSearchFilter(e.target.value)}
                            placeholder="Cari lagu atau folder..."
                            className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-full py-1.5 pl-8 sm:pl-9 pr-3 text-xs text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-emerald-500/60"
                        />
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-zinc-400"
                        >
                            <circle cx="11" cy="11" r="8" />
                            <path d="m21 21-4.3-4.3" />
                        </svg>
                    </div>
                </div>

                {/* Banner / Hero Section */}
                <div className="flex items-end gap-4 sm:gap-6 pt-1 sm:pt-2">
                    <div className="w-24 h-24 sm:w-36 sm:h-36 md:w-44 md:h-44 rounded-lg bg-gradient-to-br from-emerald-600 to-zinc-800 shadow-2xl flex items-center justify-center shrink-0 border border-emerald-500/20">
                        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" className="sm:w-16 sm:h-16">
                            <path d="M9 18V5l12-2v13" />
                            <circle cx="6" cy="18" r="3" />
                            <circle cx="18" cy="16" r="3" />
                        </svg>
                    </div>

                    <div className="flex flex-col gap-1 sm:gap-2 min-w-0">
                        <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-emerald-400">Folder Playlist</span>
                        <h1 className="text-xl sm:text-3xl md:text-5xl font-black text-white truncate leading-tight">{folderName}</h1>
                        <div className="flex items-center gap-2 text-[11px] sm:text-xs text-zinc-300 font-medium">
                            <span>{audioFiles.length} Lagu</span>
                            <span>•</span>
                            <span className="truncate text-zinc-400 max-w-[200px] sm:max-w-md">{displayPath}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Action Bar (Play All Button) */}
            <div className="px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-4 border-b border-zinc-850">
                <button
                    onClick={() => {
                        if (audioFiles.length > 0) {
                            if (selectedSong && isPlaying) togglePlayPause();
                            else playSong(audioFiles[0]);
                        }
                    }}
                    disabled={audioFiles.length === 0}
                    className="w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black flex items-center justify-center transition-transform hover:scale-105 active:scale-95 shadow-lg disabled:opacity-40"
                    title="Putar Folder"
                >
                    {isPlaying ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <rect x="6" y="4" width="4" height="16" rx="1" />
                            <rect x="14" y="4" width="4" height="16" rx="1" />
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="ml-0.5">
                            <path d="M8 5v14l11-7z" />
                        </svg>
                    )}
                </button>
            </div>

            {/* Spotify Tracklist Table */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-2">
                <table className="w-full text-left border-collapse text-xs">
                    <thead>
                        <tr className="text-zinc-400 border-b border-zinc-800/60 uppercase font-semibold text-[11px]">
                            <th className="py-3 px-3 w-10 text-center">#</th>
                            <th className="py-3 px-3">Judul</th>
                            <th className="py-3 px-3 hidden md:table-cell">Album / Tipe</th>
                            <th className="py-3 px-3 hidden lg:table-cell">Bitrate / Format</th>
                            <th className="py-3 px-3 text-right w-16">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="ml-auto">
                                    <circle cx="12" cy="12" r="10" />
                                    <polyline points="12 6 12 12 16 14" />
                                </svg>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-850/40">
                        {displayedFiles.map((file, idx) => {
                            const isSelected = selectedSong?.path === file.path;
                            const isTrackPlaying = isSelected && isPlaying;

                            return (
                                <tr
                                    key={file.path}
                                    onClick={() => {
                                        if (file.is_dir) setCurrentPath(file.path);
                                        else playSong(file);
                                    }}
                                    className={`group transition-colors cursor-pointer ${
                                        isSelected
                                            ? "bg-zinc-800/80 text-emerald-400 font-semibold"
                                            : "hover:bg-zinc-800/50 text-zinc-300 hover:text-white"
                                    }`}
                                >
                                    {/* Number / Play Button Column */}
                                    <td className="py-3 px-3 text-center text-zinc-400 group-hover:text-white font-medium">
                                        <div className="flex items-center justify-center">
                                            <span className="group-hover:hidden">
                                                {isTrackPlaying ? (
                                                    <span className="text-emerald-400 font-bold">▶</span>
                                                ) : (
                                                    idx + 1
                                                )}
                                            </span>
                                            <button className="hidden group-hover:block text-white">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M8 5v14l11-7z" />
                                                </svg>
                                            </button>
                                        </div>
                                    </td>

                                    {/* Title Column */}
                                    <td className="py-3 px-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded flex items-center justify-center shrink-0 ${
                                                file.is_dir ? "bg-amber-950/50 text-amber-400 border border-amber-500/30" : "bg-zinc-800 text-emerald-400"
                                            }`}>
                                                {file.is_dir ? (
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L8.6 3.3A2 2 0 0 0 6.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
                                                    </svg>
                                                ) : (
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path d="M9 18V5l12-2v13" />
                                                        <circle cx="6" cy="18" r="3" />
                                                        <circle cx="18" cy="16" r="3" />
                                                    </svg>
                                                )}
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className={`truncate text-xs ${isSelected ? "text-emerald-400 font-bold" : "text-zinc-100"}`}>
                                                    {file.name}
                                                </span>
                                                <span className="text-[11px] text-zinc-400 truncate">
                                                    {file.is_dir ? "Folder" : isSelected && metadata?.artist ? metadata.artist : "Artis Lokal"}
                                                </span>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Album Column */}
                                    <td className="py-3 px-3 hidden md:table-cell text-zinc-400 truncate max-w-[160px]">
                                        {file.is_dir ? "Directory" : isSelected && metadata?.album ? metadata.album : "Local Audio"}
                                    </td>

                                    {/* Format Column */}
                                    <td className="py-3 px-3 hidden lg:table-cell">
                                        <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[10px] uppercase font-mono border border-zinc-700/40">
                                            {file.is_dir ? "FOLDER" : file.ext || "AUDIO"}
                                        </span>
                                    </td>

                                    {/* Duration Column */}
                                    <td className="py-3 px-3 text-right text-zinc-400 font-mono text-[11px]">
                                        {file.is_dir ? "-" : isSelected && metadata?.duration ? formatDuration(metadata.duration) : "Audio"}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </main>
    );
}
