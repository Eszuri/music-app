"use client";

import { useState } from "react";
import type { FileEntry } from "../FolderExplorer";
import { t, type Lang } from "../../lib/translations";

interface SpotifyLibrarySidebarProps {
    lang: Lang;
    musicFolder: string | null;
    displayPath: string;
    files: FileEntry[];
    selectedSong: FileEntry | null;
    handlePickFolder: () => void;
    setCurrentPath: (path: string) => void;
    playSong: (file: FileEntry) => void;
}

export default function SpotifyLibrarySidebar({
    lang,
    musicFolder,
    displayPath,
    files,
    selectedSong,
    handlePickFolder,
    setCurrentPath,
    playSong,
}: SpotifyLibrarySidebarProps) {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeFilter, setActiveFilter] = useState<"all" | "folders" | "audio">("all");

    const audioFiles = files.filter(f => !f.is_dir);
    const folderFiles = files.filter(f => f.is_dir);

    const filteredFiles = files.filter(file => {
        if (activeFilter === "folders" && !file.is_dir) return false;
        if (activeFilter === "audio" && file.is_dir) return false;
        if (!searchQuery) return true;
        return file.name.toLowerCase().includes(searchQuery.toLowerCase());
    });

    return (
        <aside
            className={`flex flex-col gap-2 transition-all duration-300 select-none shrink-0 ${
                isCollapsed ? "w-16 sm:w-20" : "w-16 sm:w-20 lg:w-60 xl:w-72"
            }`}
        >
            {/* Top Navigation Box */}
            <div className="bg-zinc-900/90 rounded-lg p-2.5 sm:p-3 flex flex-col gap-2.5 sm:gap-3 border border-zinc-800/50">
                <button
                    onClick={() => setCurrentPath(musicFolder || "")}
                    className="flex items-center gap-3.5 text-zinc-300 hover:text-white font-semibold text-sm transition-colors p-2 rounded-md hover:bg-zinc-800/60"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                        <polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                    {!isCollapsed && <span className="max-lg:hidden">Beranda</span>}
                </button>

                <button
                    onClick={handlePickFolder}
                    className="flex items-center gap-3.5 text-zinc-400 hover:text-white font-semibold text-sm transition-colors p-2 rounded-md hover:bg-zinc-800/60"
                    title="Pilih Folder Musik"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                        <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L8.6 3.3A2 2 0 0 0 6.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
                        <line x1="12" y1="10" x2="12" y2="16" />
                        <line x1="9" y1="13" x2="15" y2="13" />
                    </svg>
                    {!isCollapsed && <span className="truncate max-lg:hidden">Folder Musik</span>}
                </button>
            </div>

            {/* Library Container */}
            <div className="flex-1 bg-zinc-900/90 rounded-lg p-2.5 sm:p-3 flex flex-col gap-2.5 sm:gap-3 border border-zinc-800/50 overflow-hidden">
                {/* Library Header */}
                <div className="flex items-center justify-between text-zinc-400">
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="flex items-center gap-3 font-bold text-xs sm:text-sm text-zinc-300 hover:text-white transition-colors p-1.5 rounded-md hover:bg-zinc-800/50"
                        title={isCollapsed ? "Buka Sidebar Library" : "Tutup Sidebar Library"}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                            <rect width="18" height="18" x="3" y="3" rx="2" />
                            <path d="M9 3v18" />
                            <path d="m14 9 3 3-3 3" />
                        </svg>
                        {!isCollapsed && <span className="max-lg:hidden">Koleksi Kamu</span>}
                    </button>

                    {!isCollapsed && (
                        <div className="flex items-center gap-1 max-lg:hidden">
                            <button
                                onClick={handlePickFolder}
                                className="p-1.5 hover:bg-zinc-800 hover:text-white rounded-full transition-colors"
                                title="Buka Folder Musik"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="12" y1="5" x2="12" y2="19" />
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                            </button>
                        </div>
                    )}
                </div>

                {!isCollapsed && (
                    <div className="flex flex-col gap-2.5 max-lg:hidden">
                        {/* Filter Pills */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setActiveFilter("all")}
                                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                                    activeFilter === "all"
                                        ? "bg-white text-black"
                                        : "bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700/80"
                                }`}
                            >
                                Semua
                            </button>
                            <button
                                onClick={() => setActiveFilter("folders")}
                                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                                    activeFilter === "folders"
                                        ? "bg-white text-black"
                                        : "bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700/80"
                                }`}
                            >
                                Folder ({folderFiles.length})
                            </button>
                            <button
                                onClick={() => setActiveFilter("audio")}
                                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                                    activeFilter === "audio"
                                        ? "bg-white text-black"
                                        : "bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700/80"
                                }`}
                            >
                                Musik ({audioFiles.length})
                            </button>
                        </div>

                        {/* Search in Library */}
                        <div className="relative">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Cari di Koleksi..."
                                className="w-full bg-zinc-800/60 border border-zinc-700/40 rounded-md py-1.5 pl-8 pr-3 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60"
                            />
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400"
                            >
                                <circle cx="11" cy="11" r="8" />
                                <path d="m21 21-4.3-4.3" />
                            </svg>
                        </div>
                    </div>
                )}

                {/* Items List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-1 pr-1">
                    {/* Active Folder Card */}
                    {musicFolder && (
                        <div
                            onClick={() => setCurrentPath(musicFolder)}
                            className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${
                                displayPath === musicFolder
                                    ? "bg-zinc-800/90 text-emerald-400"
                                    : "hover:bg-zinc-800/50 text-zinc-200"
                            }`}
                        >
                            <div className="w-11 h-11 rounded-md bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-400">
                                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L8.6 3.3A2 2 0 0 0 6.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
                                </svg>
                            </div>
                            {!isCollapsed && (
                                <div className="flex flex-col min-w-0">
                                    <span className="text-xs font-semibold truncate">
                                        {musicFolder.split(/[/\\]/).pop() || "Folder Musik Utama"}
                                    </span>
                                    <span className="text-[11px] text-zinc-400 truncate">
                                        Root Folder • {audioFiles.length} Lagu
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Directory & Song Items */}
                    {filteredFiles.map((file) => {
                        const isSelected = selectedSong?.path === file.path;
                        return (
                            <div
                                key={file.path}
                                onClick={() => {
                                    if (file.is_dir) {
                                        setCurrentPath(file.path);
                                    } else {
                                        playSong(file);
                                    }
                                }}
                                className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors group ${
                                    isSelected
                                        ? "bg-zinc-800 text-emerald-400"
                                        : "hover:bg-zinc-800/60 text-zinc-300 hover:text-white"
                                }`}
                            >
                                <div className={`w-11 h-11 rounded-md flex items-center justify-center shrink-0 shadow-sm ${
                                    file.is_dir
                                        ? "bg-zinc-800 border border-zinc-700/50 text-amber-400"
                                        : "bg-zinc-850 border border-zinc-800 text-emerald-400"
                                }`}>
                                    {file.is_dir ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L8.6 3.3A2 2 0 0 0 6.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
                                        </svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M9 18V5l12-2v13" />
                                            <circle cx="6" cy="18" r="3" />
                                            <circle cx="18" cy="16" r="3" />
                                        </svg>
                                    )}
                                </div>

                                {!isCollapsed && (
                                    <div className="flex flex-col min-w-0">
                                        <span className={`text-xs font-medium truncate ${isSelected ? "text-emerald-400 font-semibold" : ""}`}>
                                            {file.name}
                                        </span>
                                        <span className="text-[11px] text-zinc-400 truncate">
                                            {file.is_dir ? "Subfolder" : file.ext?.toUpperCase() || "Audio"}
                                        </span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </aside>
    );
}
