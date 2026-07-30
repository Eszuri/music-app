'use client';

import type {ReactNode} from 'react';
import {useHoverDescription} from '../../hooks/useHoverDescription';

export function SettingGroup({
    title,
    children,
}: {
    title: string;
    children: ReactNode;
}) {
    return (
        <div className="space-y-0">
            <h3 className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase mb-3 px-0.5">{title}</h3>
            <div className="rounded-xl bg-zinc-900/60 border border-zinc-800/60 overflow-hidden">
                {children}
            </div>
        </div>
    );
}

export function SettingRow({
    title,
    description,
    children,
    className = ''
}: {
    title: string;
    description: string;
    children: ReactNode;
    className?: string
}) {
    const hoverProps = useHoverDescription(description);
    return (
        <div 
            {...hoverProps}
            className={`relative flex items-start justify-between gap-4 px-4 py-3.5 border-b border-zinc-800/40 last:border-0 ${className}`}
        >
            <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-zinc-100">{title}</h4>
                <p className="text-xs text-zinc-500 mt-0.5">{description}</p>
            </div>
            <div className="shrink-0 pt-0.5">{children}</div>
        </div>
    );
}

export function ToggleStub({checked = false, onChange, accent, disabled}: {checked?: boolean; onChange?: (v: boolean) => void; accent: Record<string, string>; disabled?: boolean}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => onChange?.(!checked)}
            className={`w-9 h-5 rounded-full relative transition-colors ${checked ? accent.bg500 : 'bg-zinc-700'
                } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
        >
            <div
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-[18px]' : 'translate-x-0.5'
                    }`}
            />
        </button>
    );
}

export function SelectStub({
    options,
    value,
    onChange,
}: {
    options: [string, string][];
    value: string;
    onChange: (v: string) => void;
}) {
    const current = options.find(([v]) => v === value) ?? options[0];
    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-xs text-zinc-300 cursor-pointer min-w-[140px] outline-none hover:bg-zinc-700/70 focus:bg-zinc-700/70 transition-colors"
        >
            {options.map(([v, label]) => (
                <option key={v} value={v} className="bg-zinc-900 text-zinc-200">
                    {label}
                </option>
            ))}
        </select>
    );
}
