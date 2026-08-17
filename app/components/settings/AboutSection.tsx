'use client';

import { t, type Lang } from '../../lib/translations';
import { getTauri, isBrowserTauri } from '../../lib/homeState';

export default function AboutSection({ lang }: { lang: Lang }) {
    const handleOpenLink = async (e: React.MouseEvent) => {
        e.preventDefault();
        const url = 'https://github.com/Eszuri/symvonia';
        if (isBrowserTauri()) {
            try {
                const mod = await getTauri();
                await mod.invoke('open_external_url', { url });
                return;
            } catch (err) {
                console.error('Failed to open external url:', err);
            }
        }
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    return (
        <div className="space-y-5">
            <div className="flex flex-col items-center text-center py-4">
                <div className="w-16 h-16 rounded-2xl bg-zinc-800/60 border border-zinc-700/50 flex items-center justify-center mb-3 overflow-hidden">
                    <img src="/icon.png" alt={t(lang, 'about.title')} className="w-12 h-12 object-contain" />
                </div>
                <h3 className="text-lg font-semibold text-zinc-100">{t(lang, 'about.title')}</h3>
                <p className="text-xs text-zinc-500 mt-0.5">{t(lang, 'about.version')}</p>
                <div className="flex flex-col items-center gap-1 mt-6 text-xs text-zinc-500">
                    <span>{t(lang, 'about.by')} <span className="text-zinc-400">{t(lang, 'about.author')}</span></span>
                    <a
                        href="https://github.com/Eszuri/symvonia"
                        onClick={handleOpenLink}
                        className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
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

            <div className="bg-zinc-900/60 rounded-xl border border-zinc-800/60 p-5 text-center">
                <p className="text-sm text-zinc-300 leading-relaxed">
                    {t(lang, 'about.desc')}
                </p>
            </div>

            <p className="text-[11px] text-zinc-600 text-center pt-1">
                {t(lang, 'about.footer')}
            </p>
        </div>
    );
}
