'use client';

import {SettingRow} from './controls';
import {t, type Lang} from '../../lib/translations';

export default function StyleSection({
    lang,
    accentColor,
    setAccentColor,
    customAccentHex,
    setCustomAccentHex,
    layoutMode,
    setLayoutMode,
    onResetSidebarWidth,
}: {
    lang: Lang;
    accentColor: string;
    setAccentColor: (v: string) => void;
    customAccentHex: string;
    setCustomAccentHex: (v: string) => void;
    layoutMode?: 'default' | 'spotify';
    setLayoutMode?: (v: 'default' | 'spotify') => void;
    onResetSidebarWidth: () => void;
}) {
    const swatches: {id: string; bg: string}[] = [
        {id: 'sky', bg: 'bg-sky-600'},
        {id: 'zinc', bg: 'bg-zinc-400'},
        {id: 'green', bg: 'bg-green-500'},
        {id: 'emerald', bg: 'bg-emerald-500'},
        {id: 'teal', bg: 'bg-teal-500'},
        {id: 'cyan', bg: 'bg-cyan-500'},
        {id: 'blue', bg: 'bg-blue-500'},
        {id: 'indigo', bg: 'bg-indigo-500'},
        {id: 'purple', bg: 'bg-purple-500'},
        {id: 'pink', bg: 'bg-pink-500'},
        {id: 'rose', bg: 'bg-rose-500'},
        {id: 'red', bg: 'bg-red-500'},
        {id: 'orange', bg: 'bg-orange-500'},
        {id: 'amber', bg: 'bg-amber-500'},
        {id: 'yellow', bg: 'bg-yellow-500'},
        {id: 'lime', bg: 'bg-lime-500'},
    ];
    return (
        <div className="space-y-6">
            <SettingRow
                title={t(lang, 'style.accentColor.title')}
                description={t(lang, 'style.accentColor.desc')}
            >
                <div className="flex flex-wrap gap-2 max-w-[320px]">
                    {swatches.map((s) => {
                        const active = accentColor === s.id;
                        return (
                            <button
                                key={s.id}
                                onClick={() => setAccentColor(s.id)}
                                className={`w-6 h-6 rounded-full ${s.bg} cursor-pointer transition-all ${active
                                    ? 'border-2 border-zinc-100 scale-110'
                                    : 'border-2 border-zinc-700 opacity-50 hover:opacity-80'
                                    }`}
                                aria-label={t(lang, 'style.color.' + s.id)}
                            />
                        );
                    })}
                    <button
                        onClick={() => setAccentColor('custom')}
                        className={`w-6 h-6 rounded-full cursor-pointer transition-all flex items-center justify-center ${accentColor === 'custom'
                            ? 'border-2 border-zinc-100 scale-110'
                            : 'border-2 border-zinc-700 opacity-50 hover:opacity-80'
                            }`}
                        style={{background: customAccentHex}}
                        aria-label={t(lang, 'style.custom')}
                        title={t(lang, 'style.custom')}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-white/80">
                            <path d="M12 5v14M5 12h14" />
                        </svg>
                    </button>
                </div>
                {accentColor === 'custom' && (
                    <div className="flex items-center gap-2 mt-2">
                        <input
                            type="color"
                            value={customAccentHex}
                            onChange={(e) => {
                                setCustomAccentHex(e.target.value);
                            }}
                            className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
                        />
                        <span className="text-xs text-zinc-500 font-mono">{customAccentHex}</span>
                    </div>
                )}
            </SettingRow>
            <SettingRow
                title={t(lang, 'style.layoutMode.title')}
                description={t(lang, 'style.layoutMode.desc')}
            >
                <div className="flex flex-col gap-2">
                    {[
                        { id: 'default', labelKey: 'style.layoutMode.default' },
                        { id: 'spotify', labelKey: 'style.layoutMode.spotify' },
                    ].map((mode) => (
                        <label
                            key={mode.id}
                            className={`flex items-center gap-3 p-2.5 rounded-xl border transition-colors cursor-pointer ${
                                layoutMode === mode.id
                                    ? 'border-emerald-500/60 bg-emerald-950/20'
                                    : 'border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700/50'
                            }`}
                        >
                            <input
                                type="radio"
                                name="layoutMode"
                                value={mode.id}
                                checked={layoutMode === mode.id}
                                onChange={() => setLayoutMode?.(mode.id as 'default' | 'spotify')}
                                className="w-4 h-4 text-emerald-500 bg-zinc-800 border-zinc-600 focus:ring-emerald-500 cursor-pointer"
                            />
                            <span className="text-sm text-zinc-200 font-medium select-none">
                                {t(lang, mode.labelKey)}
                            </span>
                        </label>
                    ))}
                </div>
            </SettingRow>

            <SettingRow
                title={t(lang, 'style.sidebarWidth.title')}
                description={t(lang, 'style.sidebarWidth.desc')}
            >
                <button
                    onClick={onResetSidebarWidth}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-zinc-200 bg-zinc-800 hover:bg-zinc-700 hover:text-white border border-zinc-700/60 shadow-xs transition-all cursor-pointer active:scale-[0.98]"
                >
                    {t(lang, 'style.sidebarWidth.resetBtn')}
                </button>
            </SettingRow>
        </div>
    );
}
