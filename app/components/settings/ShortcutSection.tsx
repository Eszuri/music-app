'use client';

import {useState} from 'react';
import type {KeyboardEvent} from 'react';
import {getAccent} from '../../lib/colors';
import {t, type Lang} from '../../lib/translations';
import ConfirmDialog from '../ConfirmDialog';

export default function ShortcutSection({
    lang,
    shortcuts,
    updateShortcut,
    resetShortcuts,
    accentColor,
}: {
    lang: Lang;
    shortcuts: Record<string, string>;
    updateShortcut: (action: string, key: string) => void;
    resetShortcuts: () => void;
    accentColor: string;
}) {
    const accent = getAccent(accentColor);
    const actions: {id: string; label: string; defaultKey: string; description: string}[] = [
        {id: 'playPause', label: t(lang, 'shortcut.playPause'), defaultKey: ' ', description: t(lang, 'shortcut.playPauseDesc')},
        {id: 'next', label: t(lang, 'shortcut.next'), defaultKey: 'n', description: t(lang, 'shortcut.nextDesc')},
        {id: 'prev', label: t(lang, 'shortcut.prev'), defaultKey: 'p', description: t(lang, 'shortcut.prevDesc')},
        {id: 'volumeUp', label: t(lang, 'shortcut.volumeUp'), defaultKey: 'ArrowRight', description: t(lang, 'shortcut.volumeUpDesc')},
        {id: 'volumeDown', label: t(lang, 'shortcut.volumeDown'), defaultKey: 'ArrowLeft', description: t(lang, 'shortcut.volumeDownDesc')},
    ];

    const formatKey = (key: string) => {
        const mapping: Record<string, string> = {
            ' ': t(lang, 'shortcut.display.Space'),
            'ArrowRight': t(lang, 'shortcut.display.ArrowRight'),
            'ArrowLeft': t(lang, 'shortcut.display.ArrowLeft'),
            'ArrowUp': t(lang, 'shortcut.display.ArrowUp'),
            'ArrowDown': t(lang, 'shortcut.display.ArrowDown'),
        };
        if (mapping[key]) return mapping[key];
        if (key.length === 1) return key.toUpperCase();
        return key;
    };

    const [confirmResetOpen, setConfirmResetOpen] = useState(false);

    // Reset button is meaningful only when at least one shortcut has been
    // customised. While everything is at default, disable the button so
    // the user doesn't waste a click (and confirm) on a no-op.
    const hasCustom = actions.some(
        (a) => (shortcuts[a.id] ?? a.defaultKey) !== a.defaultKey
    );

    const requestReset = () => {
        if (!hasCustom) return;
        setConfirmResetOpen(true);
    };

    const performReset = () => {
        resetShortcuts();
        setConfirmResetOpen(false);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800/60">
                <div>
                    <h4 className="text-sm font-medium text-zinc-100">{t(lang, 'shortcut.heading')}</h4>
                    <p className="text-xs text-zinc-500 mt-0.5">{t(lang, 'shortcut.desc')}</p>
                </div>
                <button
                    onClick={requestReset}
                    disabled={!hasCustom}
                    title={hasCustom ? t(lang, 'shortcut.resetTitle') : t(lang, 'shortcut.resetDefaultTitle')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${hasCustom
                            ? 'text-zinc-300 bg-zinc-800/60 hover:bg-zinc-700/70 border-zinc-700/50 cursor-pointer'
                            : 'text-zinc-600 bg-zinc-900/60 border-zinc-800/40 cursor-not-allowed'
                        }`}
                >
                    {t(lang, 'shortcut.resetAll')}
                </button>
            </div>
            {actions.map((action) => (
                <ShortcutRow
                    key={action.id}
                    accent={accent}
                    lang={lang}
                    label={action.label}
                    description={action.description}
                    currentKey={shortcuts[action.id] ?? action.defaultKey}
                    defaultKey={action.defaultKey}
                    isCustom={(shortcuts[action.id] ?? action.defaultKey) !== action.defaultKey}
                    formatKey={formatKey}
                    onChange={(newKey) => updateShortcut(action.id, newKey)}
                    onReset={() => updateShortcut(action.id, action.defaultKey)}
                />
            ))}
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg text-[11px] leading-relaxed bg-zinc-800/30 text-zinc-500 border border-zinc-700/30 mt-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <span>{t(lang, 'shortcut.note')}</span>
            </div>
            <ConfirmDialog
                open={confirmResetOpen}
                title={t(lang, 'shortcut.confirmResetTitle')}
                message={t(lang, 'shortcut.confirmResetMessage')}
                confirmLabel={t(lang, 'shortcut.confirmReset')}
                cancelLabel={t(lang, 'shortcut.cancel')}
                onConfirm={performReset}
                onCancel={() => setConfirmResetOpen(false)}
                accentColor={accentColor}
                lang={lang}
            />
        </div>
    );
}

function ShortcutRow({
    accent,
    label,
    description,
    currentKey,
    defaultKey,
    isCustom,
    formatKey,
    lang,
    onChange,
    onReset,
}: {
    accent: Record<string, string>;
    label: string;
    description: string;
    currentKey: string;
    defaultKey: string;
    isCustom: boolean;
    formatKey: (key: string) => string;
    lang: Lang;
    onChange: (newKey: string) => void;
    onReset: () => void;
}) {
    const [capturing, setCapturing] = useState(false);

    const handleCapture = (e: KeyboardEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.stopPropagation();
        // Allow Escape to cancel without saving
        if (e.key === 'Escape') {
            setCapturing(false);
            return;
        }
        // Normalise: single chars -> lowercase, special keys kept as-is
        let key: string;
        if (e.key === ' ') key = ' ';
        else if (e.key.length === 1) key = e.key.toLowerCase();
        else key = e.key;
        // Block modifier-only presses
        if (['Shift', 'Control', 'Alt', 'Meta'].includes(key)) return;
        onChange(key);
        setCapturing(false);
    };

    return (
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-zinc-800/60 last:border-0">
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <h5 className="text-sm font-medium text-zinc-100">{label}</h5>
                    {isCustom && (
                        <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400 border border-zinc-700/40">
                            {t(lang, 'shortcut.custom')}
                        </span>
                    )}
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">{description}</p>
                <p className="text-[10px] text-zinc-600 mt-0.5">
                    {t(lang, 'shortcut.defaultKey')} <span className="font-mono">{formatKey(defaultKey)}</span>
                </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
                <button
                    onClick={() => setCapturing(true)}
                    onKeyDown={capturing ? handleCapture : undefined}
                    onBlur={() => setCapturing(false)}
                    className={`min-w-[64px] px-3 py-1.5 rounded-lg text-xs font-mono font-medium border transition-colors cursor-pointer text-center ${capturing
                            ? `${accent.bg10} ${accent.text400} ${accent.border500_20} animate-pulse`
                            : isCustom
                                ? `bg-amber-900/15 text-amber-300 border-amber-700/30 hover:bg-amber-900/25`
                                : 'bg-zinc-800/60 text-zinc-300 border-zinc-700/50 hover:bg-zinc-700/70'
                        }`}
                    title={capturing ? t(lang, 'shortcut.pressKeyTitle') : t(lang, 'shortcut.clickToChange')}
                >
                    {capturing ? t(lang, 'shortcut.pressKey') : formatKey(currentKey)}
                </button>
                {isCustom && (
                    <button
                        onClick={onReset}
                        title={`${t(lang, 'shortcut.resetToDefault')} (${formatKey(defaultKey)})`}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-200 bg-zinc-800/40 hover:bg-zinc-700/60 border border-zinc-700/40 cursor-pointer"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                            <path d="M3 3v5h5" />
                        </svg>
                    </button>
                )}
            </div>
        </div>
    );
}
