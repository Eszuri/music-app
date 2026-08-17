'use client';

import {useEffect, useRef, useState, type ReactNode} from 'react';
import {useHoverDescription} from '../../hooks/useHoverDescription';
import {getAccent} from '../../lib/colors';

export function SettingGroup({
    title,
    children,
}: {
    title: ReactNode;
    children: ReactNode;
}) {
    return (
        <div className="space-y-0">
            <div className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase mb-3 px-0.5">{title}</div>
            <div className="rounded-xl bg-zinc-900/60 border border-zinc-800">
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
    title: string | ReactNode;
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
                <div className="text-sm font-medium text-zinc-100">{title}</div>
                <p className="text-xs text-zinc-500 mt-0.5">{description}</p>
            </div>
            <div className="shrink-0 pt-0.5">{children}</div>
        </div>
    );
}

export function ToggleStub({checked = false, onChange, accent, disabled, ariaLabel}: {checked?: boolean; onChange?: (v: boolean) => void; accent: Record<string, string>; disabled?: boolean; ariaLabel?: string}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={ariaLabel}
            disabled={disabled}
            onClick={() => onChange?.(!checked)}
            className={`w-9 h-5 rounded-full relative transition-colors ${checked ? accent.bg500 : 'bg-zinc-700'
                } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
        >
            <div
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-4.5' : 'translate-x-0.5'
                    }`}
            />
        </button>
    );
}

export function SelectStub({
    options,
    value,
    onChange,
    disabled = false,
    ariaLabel,
    accent,
    accentColor = 'sky',
    fullWidth = false,
    className = '',
}: {
    options: [string, string, boolean?][];
    value: string;
    onChange: (v: string) => void;
    disabled?: boolean;
    ariaLabel?: string;
    accent?: Record<string, string>;
    accentColor?: string;
    fullWidth?: boolean;
    className?: string;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [hoveredValue, setHoveredValue] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const activeAccent = accent || getAccent(accentColor);
    const accentBg = activeAccent.hex500 || 'var(--accent-500)';

    const selectedOption = options.find(([v]) => v === value);
    const displayLabel = selectedOption ? selectedOption[1] : (value || '');

    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e: MouseEvent | TouchEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    return (
        <div ref={containerRef} className={`relative inline-block ${fullWidth ? 'w-full' : ''}`}>
            <button
                type="button"
                aria-label={ariaLabel}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                disabled={disabled}
                onClick={() => setIsOpen((prev) => !prev)}
                className={`min-h-9 px-3.5 py-1.5 rounded-lg border border-zinc-700/60 bg-zinc-800/80 text-xs text-zinc-200 flex items-center justify-between gap-2.5 outline-none transition-all hover:bg-zinc-700/70 hover:border-zinc-600 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40 shadow-xs cursor-pointer ${
                    fullWidth ? 'w-full' : 'min-w-36'
                } ${className}`}
            >
                <span className="truncate font-medium text-left">{displayLabel}</span>
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`shrink-0 text-zinc-400 transition-transform duration-150 ${isOpen ? 'rotate-180 text-zinc-200' : ''}`}
                >
                    <polyline points="6 9 12 15 18 9" />
                </svg>
            </button>

            {isOpen && (
                <div
                    role="listbox"
                    className={`absolute z-60 mt-1.5 py-1 rounded-lg border border-zinc-700/70 bg-zinc-900/98 backdrop-blur-md shadow-2xl shadow-black/80 max-h-60 overflow-y-auto overflow-x-hidden ${
                        fullWidth ? 'w-full left-0 right-0' : 'min-w-full right-0'
                    }`}
                >
                    {options.map(([optVal, optLabel, optDisabled]) => {
                        const isSelected = optVal === value;
                        const isHovered = hoveredValue === optVal;

                        return (
                            <button
                                key={optVal}
                                type="button"
                                role="option"
                                aria-selected={isSelected}
                                disabled={optDisabled}
                                onMouseEnter={() => setHoveredValue(optVal)}
                                onMouseLeave={() => setHoveredValue(null)}
                                onClick={() => {
                                    if (!optDisabled) {
                                        onChange(optVal);
                                        setIsOpen(false);
                                    }
                                }}
                                style={
                                    isHovered && !optDisabled
                                        ? {
                                              backgroundColor: accentBg,
                                              color: '#ffffff',
                                          }
                                        : undefined
                                }
                                className={`w-full px-3.5 py-2 text-xs text-left flex items-center justify-between gap-3 transition-colors ${
                                    optDisabled
                                        ? 'opacity-40 cursor-not-allowed text-zinc-500'
                                        : isHovered
                                            ? 'text-white cursor-pointer'
                                            : isSelected
                                                ? 'bg-zinc-800/80 text-zinc-100'
                                                : 'text-zinc-300 hover:text-white cursor-pointer'
                                }`}
                            >
                                <span className="truncate">{optLabel}</span>
                                {isSelected && (
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="13"
                                        height="13"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className={`shrink-0 ${isHovered ? 'text-white' : activeAccent.text400 || 'text-sky-400'}`}
                                    >
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
