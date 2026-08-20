'use client';

import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

interface ContextMenuActionItem {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
    active?: boolean;
    badge?: string;
}

interface ContextMenuSeparator {
    separator: true;
}

interface ContextMenuLabel {
    heading: string;
}

export type ContextMenuItem = ContextMenuActionItem | ContextMenuSeparator | ContextMenuLabel;

interface ContextMenuProps {
    x: number;
    y: number;
    items: ContextMenuItem[];
    onClose: () => void;
}

export default function ContextMenu({x, y, items, onClose}: ContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState({left: x, top: y});

    useEffect(() => {
        const el = menuRef.current;
        if (!el) return;

        const handleClick = (e: MouseEvent) => {
            if (el && !el.contains(e.target as Node)) {
                onClose();
            }
        };
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        document.addEventListener('mousedown', handleClick);
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('mousedown', handleClick);
            document.removeEventListener('keydown', handleKey);
        };
    }, [onClose]);

    useIsomorphicLayoutEffect(() => {
        const el = menuRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        let newLeft = x;
        let newTop = y;
        if (rect.right > window.innerWidth) {
            newLeft = Math.max(8, window.innerWidth - rect.width - 8);
        }
        if (rect.bottom > window.innerHeight) {
            newTop = Math.max(8, window.innerHeight - rect.height - 8);
        }
        setPos({left: newLeft, top: newTop});
    }, [x, y]);

    if (typeof document === 'undefined') return null;

    return createPortal(
        <div
            ref={menuRef}
            style={{left: pos.left, top: pos.top, position: 'fixed', width: 'max-content', minWidth: '180px', maxWidth: 'calc(100vw - 32px)'}}
            className="z-[99999] py-1 rounded-xl bg-zinc-900/98 border border-zinc-700/60 shadow-2xl shadow-black/80 backdrop-blur-md select-none"
        >
            {items.map((item, idx) => {
                if ('separator' in item && item.separator) {
                    return <div key={idx} className="mx-2 my-1 h-px bg-zinc-700/50" />;
                }
                if ('heading' in item) {
                    return (
                        <div key={idx} className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-500 select-none">
                            {item.heading}
                        </div>
                    );
                }
                const action = item as ContextMenuActionItem;
                const isActive = !!action.active;
                return (
                    <button
                        key={idx}
                        onClick={() => {
                            if (!action.disabled) {
                                action.onClick();
                                onClose();
                            }
                        }}
                        disabled={action.disabled}
                        className={`w-full flex items-center gap-2.5 text-left px-3 py-1.5 text-sm transition-colors cursor-pointer whitespace-nowrap
              ${action.disabled
                                ? 'text-zinc-600 cursor-default'
                                : isActive
                                    ? 'text-zinc-100 bg-zinc-700/40 hover:bg-zinc-700/60'
                                    : 'text-zinc-200 hover:bg-zinc-700/60 hover:text-zinc-100 active:bg-zinc-600/60'
                            }`}
                    >
                        {action.icon && (
                            <span className={`shrink-0 w-4 h-4 flex items-center justify-center
                ${action.disabled ? 'text-zinc-600' : isActive ? 'text-zinc-300' : 'text-zinc-400'}`}>
                                {action.icon}
                            </span>
                        )}
                        <span className={`flex-1 ${isActive ? 'font-medium' : ''}`}>{action.label}</span>
                        {action.badge && (
                            <span className={`ml-3 text-[11px] font-semibold px-1.5 py-0.5 rounded-md shrink-0
                ${isActive
                                    ? 'bg-zinc-600/60 text-zinc-200'
                                    : 'bg-zinc-800/60 text-zinc-500'
                                }`}>
                                {action.badge}
                            </span>
                        )}
                        {isActive && !action.icon && (
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 shrink-0 order-first" />
                        )}
                    </button>
                );
            })}
        </div>,
        document.body,
    );
}
