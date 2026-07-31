"use client";

import { getAccent } from "../../lib/colors";
import { t, type Lang } from "../../lib/translations";

export function NoFolderEmptyState({
  lang,
  onPickFolder,
  accentColor,
}: {
  lang: Lang;
  onPickFolder: () => void;
  accentColor: string;
}) {
  const accent = getAccent(accentColor);
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
      <div className="w-24 h-24 rounded-3xl bg-zinc-900/80 border border-zinc-800/50 flex items-center justify-center mb-6 shadow-2xl shadow-black/50">
        <span className="text-5xl opacity-30">📁</span>
      </div>
      <h2 className="text-2xl font-semibold text-zinc-200 mb-2">
        {t(lang, "empty.welcomeTitle")}
      </h2>
      <p className="text-sm text-zinc-500 max-w-md mb-8 leading-relaxed">
        {t(lang, "empty.welcomeDesc")}
      </p>
      <button
        onClick={onPickFolder}
        className={`flex items-center gap-2.5 px-6 py-3 ${accent.bg500} ${accent.hoverBg400} text-zinc-950 font-semibold rounded-xl cursor-pointer shadow-lg ${accent.shadow20}`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        </svg>
        {t(lang, "empty.pickFolder")}
      </button>
    </div>
  );
}

export function EmptyFolderState({
  lang,
  folder,
}: {
  lang: Lang;
  folder: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center max-w-md">
      <div className="w-20 h-20 rounded-2xl bg-zinc-900/60 border border-zinc-800/50 flex items-center justify-center mb-5">
        <span className="text-4xl opacity-30">🎵</span>
      </div>
      <h3 className="text-lg font-semibold text-zinc-200 mb-1.5">
        {t(lang, "empty.folderEmptyTitle")}
      </h3>
      <p className="text-sm text-zinc-500 leading-relaxed mb-1">
        {t(lang, "empty.folderEmptyDesc")}
      </p>
      <p
        className="text-xs text-zinc-600 font-mono truncate max-w-full px-4"
        title={folder}
      >
        {folder}
      </p>
    </div>
  );
}
