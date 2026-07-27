'use client';

import {useState} from 'react';
import {motion} from 'framer-motion';
import type {KeyboardEvent} from 'react';
import {getAccent} from '../../lib/colors';
import ConfirmDialog from '../ConfirmDialog';

export default function ShortcutSection({
    shortcuts,
    updateShortcut,
    resetShortcuts,
    accentColor,
}: {
    shortcuts: Record<string, string>;
    updateShortcut: (action: string, key: string) => void;
    resetShortcuts: () => void;
    accentColor: string;
}) {
    const accent = getAccent(accentColor);
    // Action metadata: id, label, default key, description. Keep in sync
    // with the canonical list in app/page.tsx (DEFAULT_SHORTCUTS).
    const actions: {id: string; label: string; defaultKey: string; description: string}[] = [
        {id: 'playPause', label: 'Play / Pause', defaultKey: ' ', description: 'Putar atau jeda lagu yang sedang diputar'},
        {id: 'next', label: 'Next Track', defaultKey: 'n', description: 'Lanjut ke lagu berikutnya'},
        {id: 'prev', label: 'Previous Track', defaultKey: 'p', description: 'Kembali ke lagu sebelumnya'},
        {id: 'volumeUp', label: 'Volume Up', defaultKey: 'ArrowRight', description: 'Naikkan volume (+5%)'},
        {id: 'volumeDown', label: 'Volume Down', defaultKey: 'ArrowLeft', description: 'Turunkan volume (-5%)'},
    ];

    const formatKey = (key: string) => {
        if (key === ' ') return 'Space';
        if (key === 'ArrowRight') return '→';
        if (key === 'ArrowLeft') return '←';
        if (key === 'ArrowUp') return '↑';
        if (key === 'ArrowDown') return '↓';
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
                    <h4 className="text-sm font-medium text-zinc-100">Keyboard Shortcut</h4>
                    <p className="text-xs text-zinc-500 mt-0.5">Klik tombol di kanan untuk mengganti. Klik tombol Reset untuk mengembalikan.</p>
                </div>
                <button
                    onClick={requestReset}
                    disabled={!hasCustom}
                    title={hasCustom ? 'Kembalikan semua shortcut ke default' : 'Semua shortcut masih default'}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${hasCustom
                            ? 'text-zinc-300 bg-zinc-800/60 hover:bg-zinc-700/70 border-zinc-700/50 cursor-pointer'
                            : 'text-zinc-600 bg-zinc-900/60 border-zinc-800/40 cursor-not-allowed'
                        }`}
                >
                    Reset Semua
                </button>
            </div>
            {actions.map((action) => (
                <ShortcutRow
                    key={action.id}
                    accent={accent}
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
                <span>Shortcut tidak aktif saat mengetik di input/textarea atau saat modal terbuka.</span>
            </div>
            <ConfirmDialog
                open={confirmResetOpen}
                title="Reset Semua Shortcut?"
                message="Semua shortcut akan dikembalikan ke tombol bawaan (default)."
                confirmLabel="Reset"
                cancelLabel="Batal"
                onConfirm={performReset}
                onCancel={() => setConfirmResetOpen(false)}
                accentColor={accentColor}
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
                            Custom
                        </span>
                    )}
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">{description}</p>
                <p className="text-[10px] text-zinc-600 mt-0.5">
                    Default: <span className="font-mono">{formatKey(defaultKey)}</span>
                </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
                <motion.button
                    onClick={() => setCapturing(true)}
                    onKeyDown={capturing ? handleCapture : undefined}
                    onBlur={() => setCapturing(false)}
                    whileTap={{scale: 0.97}}
                    className={`min-w-[64px] px-3 py-1.5 rounded-lg text-xs font-mono font-medium border transition-colors cursor-pointer text-center ${capturing
                            ? `${accent.bg10} ${accent.text400} ${accent.border500_20} animate-pulse`
                            : isCustom
                                ? `bg-amber-900/15 text-amber-300 border-amber-700/30 hover:bg-amber-900/25`
                                : 'bg-zinc-800/60 text-zinc-300 border-zinc-700/50 hover:bg-zinc-700/70'
                        }`}
                    title={capturing ? 'Tekan tombol baru, atau Esc untuk batal' : 'Klik untuk mengubah'}
                >
                    {capturing ? 'Tekan tombol...' : formatKey(currentKey)}
                </motion.button>
                {isCustom && (
                    <motion.button
                        onClick={onReset}
                        whileHover={{scale: 1.05}}
                        whileTap={{scale: 0.95}}
                        title={`Reset ke default (${formatKey(defaultKey)})`}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-200 bg-zinc-800/40 hover:bg-zinc-700/60 border border-zinc-700/40 cursor-pointer"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                            <path d="M3 3v5h5" />
                        </svg>
                    </motion.button>
                )}
            </div>
        </div>
    );
}
