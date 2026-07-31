'use client';

import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { getAccent } from '../lib/colors';
import {t, type Lang} from '../lib/translations';
import { contentMotion, backdropMotion } from '../lib/animations';

interface ConfirmDialogProps {
    lang?: Lang;
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
    accentColor: string;
}

export default function ConfirmDialog({
    lang = 'en',
    open,
    title,
    message,
    confirmLabel,
    cancelLabel,
    onConfirm,
    onCancel,
    accentColor,
}: ConfirmDialogProps) {
    const resolvedConfirm = confirmLabel ?? t(lang, 'confirm.defaultConfirm');
    const resolvedCancel = cancelLabel ?? t(lang, 'confirm.defaultCancel');
    const accent = getAccent(accentColor);
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onCancel();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onCancel]);

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    key="confirm-backdrop"
                    {...backdropMotion}
                    className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm"
                    onClick={onCancel}
                >
                    <motion.div
                        key="confirm-modal"
                        {...contentMotion}
                        className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl shadow-black/50 p-6 max-w-md w-[90%] flex flex-col gap-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 className="text-lg font-bold text-zinc-100">{title}</h2>
                        <p className="text-sm text-zinc-400 leading-relaxed">{message}</p>
                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                onClick={onCancel}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-300 bg-zinc-800/60 hover:bg-zinc-700/70 border border-zinc-700/50 cursor-pointer"
                            >
                                {resolvedCancel}
                            </button>
                            <button
                                onClick={onConfirm}
                                className={`px-4 py-2 rounded-lg text-sm font-medium text-white ${accent.bg600} ${accent.hoverBg400} border ${accent.border500_30} cursor-pointer`}
                            >
                                {resolvedConfirm}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
