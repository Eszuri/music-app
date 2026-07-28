'use client';

import {t, type Lang} from '../../lib/translations';

export default function AboutSection({lang}: {lang: Lang}) {
    return (
        <div className="space-y-5">
            <div className="flex flex-col items-center text-center py-4">
                <div className="w-16 h-16 rounded-2xl bg-zinc-800/60 border border-zinc-700/50 flex items-center justify-center mb-3 overflow-hidden">
                    <img src="/icon.png" alt={t(lang, 'about.title')} className="w-12 h-12 object-contain" />
                </div>
                <h3 className="text-lg font-semibold text-zinc-100">{t(lang, 'about.title')}</h3>
                <p className="text-xs text-zinc-500 mt-0.5">{t(lang, 'about.version')}</p>
                <div className="flex items-center justify-center gap-3 mt-2 text-xs text-zinc-500">
                    <span>{t(lang, 'about.by')} <span className="text-zinc-400">{t(lang, 'about.author')}</span></span>
                    <span className="text-zinc-700">{t(lang, 'about.separator')}</span>
                    <a
                        href="https://github.com/Eszuri/symvonia"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
                    >
                        {t(lang, 'about.repo')}
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <polyline points="15 3 21 3 21 9" />
                            <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                    </a>
                </div>
            </div>

            <div className="bg-zinc-900/60 rounded-xl border border-zinc-800/60 p-4">
                <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">{t(lang, 'about.frontend')}</h4>
                <div className="flex flex-wrap gap-1.5">
                    <TechBadge label="Next.js" version="16.2" />
                    <TechBadge label="React" version="19.2" />
                    <TechBadge label="TypeScript" version="5" />
                    <TechBadge label="Tailwind CSS" version="v4" />
                    <TechBadge label="Framer Motion" version="12.4" />
                </div>
            </div>

            <div className="bg-zinc-900/60 rounded-xl border border-zinc-800/60 p-4">
                <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">{t(lang, 'about.backend')}</h4>
                <div className="flex flex-wrap gap-1.5">
                    <TechBadge label="Tauri" version="2.11" />
                    <TechBadge label="Lofty" version="0.22" />
                    <TechBadge label="image" version="0.25" />
                    <TechBadge label="rfd" version="0.15" />
                    <TechBadge label="base64" version="0.22" />
                    <TechBadge label="serde" version="1.0" />
                </div>
            </div>

            <p className="text-[11px] text-zinc-600 text-center pt-1">
                {t(lang, 'about.footer')}
            </p>
        </div>
    );
}

function TechBadge({label, version}: {label: string; version: string}) {
    return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-800/70 border border-zinc-700/40 text-[11px] text-zinc-300">
            {label}
            <span className="text-[10px] text-zinc-500">{version}</span>
        </span>
    );
}
