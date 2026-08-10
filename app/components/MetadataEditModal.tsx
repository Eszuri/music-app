'use client';

import React, {memo, useEffect, useState, useRef} from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import {getAccent} from '../lib/colors';
import {t, type Lang} from '../lib/translations';
import {modalContentMotion, backdropMotion} from '../lib/animations';
import {EditIcon, MusicNoteIcon} from './icons';
import type {FileEntry} from './FolderExplorer';
import type {SongMetadata} from './PlayerPanel';

interface MetadataEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedSong: FileEntry | null;
    metadata: SongMetadata | null;
    lang: Lang;
    accentColor: string;
    onSaveSuccess?: () => void;
}

function MetadataEditModal({
    isOpen,
    onClose,
    selectedSong,
    metadata,
    lang,
    accentColor,
    onSaveSuccess,
}: MetadataEditModalProps) {
    const accent = getAccent(accentColor);
    const mouseDownOnBackdropRef = useRef<boolean>(false);

    const [customSong, setCustomSong] = useState<FileEntry | null>(null);

    const [title, setTitle] = useState('');
    const [artist, setArtist] = useState('');
    const [album, setAlbum] = useState('');
    const [genre, setGenre] = useState('');
    const [year, setYear] = useState<string>('');
    const [trackNumber, setTrackNumber] = useState<string>('');
    const [totalTracks, setTotalTracks] = useState<string>('');
    const [discNumber, setDiscNumber] = useState<string>('');
    const [totalDiscs, setTotalDiscs] = useState<string>('');
    const [comment, setComment] = useState('');

    const [coverB64, setCoverB64] = useState<string | null>(null);
    const [coverMime, setCoverMime] = useState<string | null>(null);
    const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const activeSong = customSong || selectedSong;
    const isDisabled = !activeSong || !activeSong.path;

    // Reset custom song when modal opens or closes
    useEffect(() => {
        if (!isOpen) {
            setCustomSong(null);
        }
    }, [isOpen]);

    // Populate form fields when modal opens or selected metadata changes
    useEffect(() => {
        if (!isOpen) return;
        const targetSong = customSong || selectedSong;
        if (!targetSong) {
            setTitle('');
            setArtist('');
            setAlbum('');
            setGenre('');
            setYear('');
            setTrackNumber('');
            setTotalTracks('');
            setDiscNumber('');
            setTotalDiscs('');
            setComment('');
            setCoverB64(null);
            setCoverMime(null);
            setCoverPreviewUrl(null);
            setErrorMessage(null);
            return;
        }

        let isCancelled = false;

        const populateFields = (meta: SongMetadata | null) => {
            if (isCancelled) return;
            const songFileName = targetSong.name || targetSong.display_name || targetSong.path?.split(/[/\\]/).pop() || '';
            const defaultTitle = songFileName ? songFileName.replace(/\.[^/.]+$/, '') : '';
            setTitle(meta?.title ?? defaultTitle);
            setArtist(meta?.artist ?? '');
            setAlbum(meta?.album ?? '');
            setGenre(meta?.genre ?? '');
            setYear(meta?.year ? String(meta.year) : '');
            setTrackNumber(meta?.track_number ? String(meta.track_number) : '');
            setTotalTracks(meta?.total_tracks ? String(meta.total_tracks) : '');
            setDiscNumber(meta?.disc_number ? String(meta.disc_number) : '');
            setTotalDiscs(meta?.total_discs ? String(meta.total_discs) : '');
            setComment(meta?.comment ?? '');

            if (meta?.cover_b64) {
                setCoverB64(meta.cover_b64);
                const mime = meta.cover_mime || 'image/jpeg';
                setCoverMime(mime);
                setCoverPreviewUrl(`data:${mime};base64,${meta.cover_b64}`);
            } else {
                setCoverB64(null);
                setCoverMime(null);
                setCoverPreviewUrl(null);
            }
            setErrorMessage(null);
        };

        if (!customSong && metadata) {
            populateFields(metadata);
        } else {
            (async () => {
                try {
                    const {invoke} = await import('@tauri-apps/api/core');
                    const fetched = await invoke<SongMetadata>('get_metadata', {filePath: targetSong.path});
                    if (!isCancelled) populateFields(fetched);
                } catch {
                    if (!isCancelled) populateFields(null);
                }
            })();
        }

        return () => {
            isCancelled = true;
        };
    }, [isOpen, metadata, selectedSong, customSong]);

    // Handle Escape key
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Image Upload handler
    const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const result = event.target?.result as string;
            if (!result) return;
            const parts = result.split(',');
            if (parts.length === 2) {
                const mimeMatch = result.match(/^data:(image\/[a-zA-Z+]+);base64,/);
                const mime = mimeMatch ? mimeMatch[1] : file.type || 'image/jpeg';
                setCoverB64(parts[1]);
                setCoverMime(mime);
                setCoverPreviewUrl(result);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleRemoveCover = () => {
        setCoverB64(null);
        setCoverMime(null);
        setCoverPreviewUrl(null);
    };

    // Pick another audio file from disk
    const handlePickAnotherFile = async () => {
        try {
            const {invoke} = await import('@tauri-apps/api/core');
            const chosenPath = await invoke<string | null>('pick_audio_file');
            if (chosenPath) {
                const fileName = chosenPath.split(/[/\\]/).pop() || '';
                const newFile: FileEntry = {
                    name: fileName,
                    display_name: fileName,
                    path: chosenPath,
                    is_dir: false,
                    ext: fileName.split('.').pop() || '',
                    mtime: 0,
                    size: 0,
                    ctime: 0,
                    sort_key: fileName.toLowerCase(),
                };
                setCustomSong(newFile);
            }
        } catch (err) {
            console.error('Failed to pick audio file:', err);
        }
    };

    // Save Metadata via Tauri IPC
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const targetSong = customSong || selectedSong;
        if (!targetSong) return;

        setIsSaving(true);
        setErrorMessage(null);

        try {
            const {invoke} = await import('@tauri-apps/api/core');
            await invoke('save_metadata', {
                filePath: targetSong.path,
                title: title.trim() || null,
                artist: artist.trim() || null,
                album: album.trim() || null,
                genre: genre.trim() || null,
                year: year ? parseInt(year, 10) || null : null,
                trackNumber: trackNumber ? parseInt(trackNumber, 10) || null : null,
                totalTracks: totalTracks ? parseInt(totalTracks, 10) || null : null,
                discNumber: discNumber ? parseInt(discNumber, 10) || null : null,
                totalDiscs: totalDiscs ? parseInt(totalDiscs, 10) || null : null,
                comment: comment.trim() || null,
                coverB64: coverB64 || null,
                coverMime: coverMime || null,
            });

            if (onSaveSuccess) {
                onSaveSuccess();
            }
            onClose();
        } catch (err: unknown) {
            console.error('Failed to save metadata:', err);
            const errMsg = err instanceof Error ? err.message : String(err);
            setErrorMessage(errMsg || (lang === 'id' ? 'Gagal menyimpan metadata file' : 'Failed to save metadata'));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    key="metadata-backdrop"
                    {...backdropMotion}
                    onMouseDown={(e) => {
                        mouseDownOnBackdropRef.current = e.target === e.currentTarget;
                    }}
                    onClick={(e) => {
                        if (mouseDownOnBackdropRef.current && e.target === e.currentTarget) {
                            onClose();
                        }
                        mouseDownOnBackdropRef.current = false;
                    }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm cursor-pointer p-4"
                >
                    <motion.div
                        key="metadata-modal"
                        {...modalContentMotion}
                        onClick={(e) => e.stopPropagation()}
                        className="relative w-full max-w-2xl bg-zinc-950/95 border border-zinc-800/90 rounded-2xl shadow-2xl overflow-hidden flex flex-col cursor-default max-h-[90vh]"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/40 gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className={`p-2.5 rounded-xl bg-zinc-800/80 shrink-0 ${accent.text400}`}>
                                    <EditIcon size={18} />
                                </div>
                                <div className="min-w-0">
                                    <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2 truncate">
                                        {t(lang, 'metadataEdit.title')}
                                    </h2>
                                    <p className="text-[11px] text-zinc-400 truncate">
                                        {activeSong
                                            ? (activeSong.display_name || activeSong.name || activeSong.path?.split(/[/\\]/).pop() || 'File audio')
                                            : t(lang, 'metadataEdit.noFileSelectedSub')}
                                    </p>
                                </div>
                            </div>

                            {/* Open Another File Button */}
                            <button
                                type="button"
                                onClick={handlePickAnotherFile}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-semibold border border-zinc-700/60 transition-colors cursor-pointer shrink-0 shadow-sm"
                                title={t(lang, 'metadataEdit.openAnotherHint')}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2z" />
                                    <line x1="12" y1="10" x2="12" y2="16" />
                                    <line x1="9" y1="13" x2="15" y2="13" />
                                </svg>
                                <span>{t(lang, 'metadataEdit.openAnother')}</span>
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5 scrollbar-thin scrollbar-thumb-zinc-800">
                            {/* Disabled Warning Notice when no valid file is selected */}
                            {isDisabled && (
                                <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs">
                                    <svg className="shrink-0 mt-0.5" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10" />
                                        <line x1="12" y1="8" x2="12" y2="12" />
                                        <line x1="12" y1="16" x2="12.01" y2="16" />
                                    </svg>
                                    <div>
                                        <p className="font-semibold mb-0.5">
                                            {t(lang, 'metadataEdit.noFileTitle')}
                                        </p>
                                        <p className="text-[11px] text-amber-300/80 leading-relaxed">
                                            {t(lang, 'metadataEdit.noFileDesc')}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {errorMessage && (
                                <div className="px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                                    {errorMessage}
                                </div>
                            )}

                            {/* Top Section: Cover Artwork + Primary Fields */}
                            <div className="flex flex-col sm:flex-row gap-5">
                                {/* Cover Artwork Picker */}
                                <div className="flex flex-col items-center gap-2 shrink-0">
                                    <div className="relative w-36 h-36 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center overflow-hidden group">
                                        {coverPreviewUrl ? (
                                            <img src={coverPreviewUrl} alt="Cover Preview" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="flex flex-col items-center gap-1.5 text-zinc-500">
                                                <MusicNoteIcon size={32} />
                                                <span className="text-[10px]">{t(lang, 'metadataEdit.noCover')}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <label className={`px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-200 text-xs font-medium border border-zinc-700/60 transition-colors ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-zinc-700 cursor-pointer'}`}>
                                            <span>{t(lang, 'metadataEdit.chooseImage')}</span>
                                            <input
                                                type="file"
                                                accept="image/png, image/jpeg, image/jpg"
                                                disabled={isDisabled || isSaving}
                                                onChange={handleCoverChange}
                                                className="hidden"
                                            />
                                        </label>
                                        {coverPreviewUrl && !isDisabled && (
                                            <button
                                                type="button"
                                                onClick={handleRemoveCover}
                                                disabled={isDisabled || isSaving}
                                                className="px-2.5 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 text-xs border border-rose-800/40 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {t(lang, 'metadataEdit.removeImage')}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Primary Text Fields */}
                                <div className="flex-1 space-y-3">
                                    <div>
                                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                                            {t(lang, 'metadataEdit.songTitle')}
                                        </label>
                                        <input
                                            type="text"
                                            disabled={isDisabled || isSaving}
                                            value={title}
                                            onChange={(e) => setTitle(e.target.value)}
                                            placeholder={t(lang, 'metadataEdit.songTitle')}
                                            className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 text-sm focus:outline-none focus:border-zinc-500 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                                            {t(lang, 'metadataEdit.artist')}
                                        </label>
                                        <input
                                            type="text"
                                            disabled={isDisabled || isSaving}
                                            value={artist}
                                            onChange={(e) => setArtist(e.target.value)}
                                            placeholder={t(lang, 'metadataEdit.artist')}
                                            className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 text-sm focus:outline-none focus:border-zinc-500 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                                            {t(lang, 'metadataEdit.album')}
                                        </label>
                                        <input
                                            type="text"
                                            disabled={isDisabled || isSaving}
                                            value={album}
                                            onChange={(e) => setAlbum(e.target.value)}
                                            placeholder={t(lang, 'metadataEdit.album')}
                                            className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 text-sm focus:outline-none focus:border-zinc-500 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Secondary Fields Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                                        {t(lang, 'metadataEdit.genre')}
                                    </label>
                                    <input
                                        type="text"
                                        disabled={isDisabled || isSaving}
                                        value={genre}
                                        onChange={(e) => setGenre(e.target.value)}
                                        placeholder="Pop, Rock, Jazz..."
                                        className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-zinc-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                                        {t(lang, 'metadataEdit.year')}
                                    </label>
                                    <input
                                        type="number"
                                        disabled={isDisabled || isSaving}
                                        value={year}
                                        onChange={(e) => setYear(e.target.value)}
                                        placeholder="2026"
                                        className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-zinc-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                                        {t(lang, 'metadataEdit.trackTotal')}
                                    </label>
                                    <div className="flex items-center gap-1.5">
                                        <input
                                            type="number"
                                            disabled={isDisabled || isSaving}
                                            value={trackNumber}
                                            onChange={(e) => setTrackNumber(e.target.value)}
                                            placeholder="1"
                                            className="w-full px-2.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-zinc-500 text-center disabled:opacity-50 disabled:cursor-not-allowed"
                                        />
                                        <span className="text-zinc-500 font-bold">/</span>
                                        <input
                                            type="number"
                                            disabled={isDisabled || isSaving}
                                            value={totalTracks}
                                            onChange={(e) => setTotalTracks(e.target.value)}
                                            placeholder="12"
                                            className="w-full px-2.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-zinc-500 text-center disabled:opacity-50 disabled:cursor-not-allowed"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                                        {t(lang, 'metadataEdit.discTotal')}
                                    </label>
                                    <div className="flex items-center gap-1.5">
                                        <input
                                            type="number"
                                            disabled={isDisabled || isSaving}
                                            value={discNumber}
                                            onChange={(e) => setDiscNumber(e.target.value)}
                                            placeholder="1"
                                            className="w-full px-2.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-zinc-500 text-center disabled:opacity-50 disabled:cursor-not-allowed"
                                        />
                                        <span className="text-zinc-500 font-bold">/</span>
                                        <input
                                            type="number"
                                            disabled={isDisabled || isSaving}
                                            value={totalDiscs}
                                            onChange={(e) => setTotalDiscs(e.target.value)}
                                            placeholder="1"
                                            className="w-full px-2.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-zinc-500 text-center disabled:opacity-50 disabled:cursor-not-allowed"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Comment / Lyrics */}
                            <div>
                                <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                                    {t(lang, 'metadataEdit.comment')}
                                </label>
                                <textarea
                                    rows={2}
                                    disabled={isDisabled || isSaving}
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    placeholder={t(lang, 'metadataEdit.comment')}
                                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-zinc-500 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                            </div>

                            {/* Footer Buttons */}
                            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800/80">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold border border-zinc-800 transition-colors cursor-pointer"
                                >
                                    {t(lang, 'metadataEdit.cancel')}
                                </button>
                                <button
                                    type="submit"
                                    disabled={isDisabled || isSaving}
                                    className={`px-5 py-2 rounded-xl text-xs font-semibold text-white transition-all cursor-pointer shadow-md ${accent.bg500} ${accent.bg600Hover} disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                    {isSaving
                                        ? t(lang, 'metadataEdit.saving')
                                        : t(lang, 'metadataEdit.save')}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

export default memo(MetadataEditModal);
