'use client';

import {motion} from 'framer-motion';
import {getAccent} from '../../lib/colors';

export function NoFolderEmptyState({onPickFolder, accentColor}: {onPickFolder: () => void; accentColor: string}) {
    const accent = getAccent(accentColor);
    return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-24 h-24 rounded-3xl bg-zinc-900/80 border border-zinc-800/50 flex items-center justify-center mb-6 shadow-2xl shadow-black/50">
                <span className="text-5xl opacity-30">📁</span>
            </div>
            <h2 className="text-2xl font-semibold text-zinc-200 mb-2">Selamat Datang di Symvonia</h2>
            <p className="text-sm text-zinc-500 max-w-md mb-8 leading-relaxed">
                Pilih folder tempat kamu menyimpan koleksi musik untuk mulai memutar. Aplikasi akan membaca metadata
                dan cover art dari file audio secara otomatis.
            </p>
            <motion.button
                onClick={onPickFolder}
                whileHover={{scale: 1.04, y: -1}}
                whileTap={{scale: 0.96}}
                transition={{duration: 0.15}}
                className={`flex items-center gap-2.5 px-6 py-3 ${accent.bg500} ${accent.hoverBg400} text-zinc-950 font-semibold rounded-xl cursor-pointer shadow-lg ${accent.shadow20}`}
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                </svg>
                Pilih Folder Musik
            </motion.button>
        </div>
    );
}

export function EmptyFolderState({folder}: {folder: string}) {
    return (
        <div className="flex flex-col items-center justify-center text-center max-w-md">
            <div className="w-20 h-20 rounded-2xl bg-zinc-900/60 border border-zinc-800/50 flex items-center justify-center mb-5">
                <span className="text-4xl opacity-30">🎵</span>
            </div>
            <h3 className="text-lg font-semibold text-zinc-200 mb-1.5">Folder Kosong</h3>
            <p className="text-sm text-zinc-500 leading-relaxed mb-1">
                Tidak ada file audio di folder ini.
            </p>
            <p className="text-xs text-zinc-600 font-mono truncate max-w-full px-4" title={folder}>
                {folder}
            </p>
        </div>
    );
}

export function InitSkeleton() {
    return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <motion.div
                className="flex flex-col items-center gap-6"
                initial={{opacity: 0}}
                animate={{opacity: 1}}
                transition={{duration: 0.2}}
            >
                {/* App icon placeholder */}
                <div className="w-16 h-16 rounded-2xl bg-zinc-800/50 border border-zinc-700/30 flex items-center justify-center">
                    <motion.div
                        className="w-8 h-8 rounded-full bg-zinc-700/50"
                        animate={{scale: [1, 1.15, 1]}}
                        transition={{duration: 1.8, repeat: Infinity, ease: 'easeInOut'}}
                    />
                </div>
                {/* Title placeholder */}
                <div className="w-40 h-5 rounded bg-zinc-800/50" />
                {/* Subtitle placeholder */}
                <div className="w-56 h-3 rounded bg-zinc-800/30" />
            </motion.div>
        </div>
    );
}
