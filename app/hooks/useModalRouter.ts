import { useState, useCallback, useEffect } from "react";
import type { FileEntry } from "../components/FolderExplorer";

export function useModalRouter() {
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [streamingOpen, setStreamingOpen] = useState(false);
    const [equalizerOpen, setEqualizerOpen] = useState(false);
    const [metadataEditOpen, setMetadataEditOpen] = useState(false);
    const [lyricsSearchOpen, setLyricsSearchOpen] = useState(false);
    const [editingTargetFile, setEditingTargetFile] = useState<FileEntry | null>(null);

    const openEqualizer = useCallback(() => {
        setEqualizerOpen(true);
        if (typeof window !== 'undefined' && window.location.pathname !== '/equalizer') {
            window.history.pushState({modal: 'equalizer'}, '', '/equalizer');
        }
    }, []);

    const closeEqualizer = useCallback(() => {
        setEqualizerOpen(false);
        if (typeof window !== 'undefined' && window.location.pathname.includes('/equalizer')) {
            window.history.pushState(null, '', '/');
        }
    }, []);

    const openSettings = useCallback(() => {
        setSettingsOpen(true);
        if (typeof window !== 'undefined' && window.location.pathname !== '/setting') {
            window.history.pushState({modal: 'setting'}, '', '/setting');
        }
    }, []);

    const closeSettings = useCallback(() => {
        setSettingsOpen(false);
        if (typeof window !== 'undefined' && window.location.pathname.includes('/setting')) {
            window.history.pushState(null, '', '/');
        }
    }, []);

    const openStreaming = useCallback(() => {
        setStreamingOpen(true);
        if (typeof window !== 'undefined' && window.location.pathname !== '/streaming') {
            window.history.pushState({modal: 'streaming'}, '', '/streaming');
        }
    }, []);

    const closeStreaming = useCallback(() => {
        setStreamingOpen(false);
        if (typeof window !== 'undefined' && window.location.pathname.includes('/streaming')) {
            window.history.pushState(null, '', '/');
        }
    }, []);

    const openMetadataEdit = useCallback((targetFile?: FileEntry) => {
        setEditingTargetFile(targetFile || null);
        setMetadataEditOpen(true);
        if (typeof window !== 'undefined' && window.location.pathname !== '/metadata') {
            window.history.pushState({modal: 'metadata'}, '', '/metadata');
        }
    }, []);

    const closeMetadataEdit = useCallback(() => {
        setMetadataEditOpen(false);
        setEditingTargetFile(null);
        if (typeof window !== 'undefined' && window.location.pathname.includes('/metadata')) {
            window.history.pushState(null, '', '/');
        }
    }, []);

    const openLyricsSearch = useCallback(() => {
        setLyricsSearchOpen(true);
        if (typeof window !== 'undefined' && window.location.pathname !== '/lyrics-search') {
            window.history.pushState({modal: 'lyrics-search'}, '', '/lyrics-search');
        }
    }, []);

    const closeLyricsSearch = useCallback(() => {
        setLyricsSearchOpen(false);
        if (typeof window !== 'undefined' && window.location.pathname.includes('/lyrics-search')) {
            window.history.pushState(null, '', '/');
        }
    }, []);

    useEffect(() => {
        const syncModalFromUrl = () => {
            const path = window.location.pathname.toLowerCase();
            if (path.includes('/equalizer')) {
                setEqualizerOpen(true);
                setSettingsOpen(false);
                setStreamingOpen(false);
                setMetadataEditOpen(false);
                setLyricsSearchOpen(false);
            } else if (path.includes('/setting')) {
                setSettingsOpen(true);
                setEqualizerOpen(false);
                setStreamingOpen(false);
                setMetadataEditOpen(false);
                setLyricsSearchOpen(false);
            } else if (path.includes('/streaming')) {
                setStreamingOpen(true);
                setEqualizerOpen(false);
                setSettingsOpen(false);
                setMetadataEditOpen(false);
                setLyricsSearchOpen(false);
            } else if (path.includes('/metadata')) {
                setMetadataEditOpen(true);
                setEqualizerOpen(false);
                setSettingsOpen(false);
                setStreamingOpen(false);
                setLyricsSearchOpen(false);
            } else if (path.includes('/lyrics-search')) {
                setLyricsSearchOpen(true);
                setEqualizerOpen(false);
                setSettingsOpen(false);
                setStreamingOpen(false);
                setMetadataEditOpen(false);
            } else if (path === '/' || path === '') {
                setEqualizerOpen(false);
                setSettingsOpen(false);
                setStreamingOpen(false);
                setMetadataEditOpen(false);
                setLyricsSearchOpen(false);
            }
        };

        syncModalFromUrl();

        window.addEventListener('popstate', syncModalFromUrl);
        return () => window.removeEventListener('popstate', syncModalFromUrl);
    }, []);

    return {
        settingsOpen,
        setSettingsOpen,
        streamingOpen,
        setStreamingOpen,
        equalizerOpen,
        setEqualizerOpen,
        metadataEditOpen,
        setMetadataEditOpen,
        lyricsSearchOpen,
        setLyricsSearchOpen,
        editingTargetFile,
        setEditingTargetFile,
        openEqualizer,
        closeEqualizer,
        openSettings,
        closeSettings,
        openStreaming,
        closeStreaming,
        openMetadataEdit,
        closeMetadataEdit,
        openLyricsSearch,
        closeLyricsSearch,
    };
}
