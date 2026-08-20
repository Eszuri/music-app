import { useState, useCallback, useEffect } from "react";
import type { FileEntry } from "../components/FolderExplorer";

function closeModalPath(path: string) {
    if (typeof window !== 'undefined' && window.location.pathname.includes(path)) {
        window.history.replaceState(null, '', '/');
    }
}

export function useModalRouter() {
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [streamingOpen, setStreamingOpen] = useState(false);
    const [equalizerOpen, setEqualizerOpen] = useState(false);
    const [metadataEditOpen, setMetadataEditOpen] = useState(false);
    const [lyricsSearchOpen, setLyricsSearchOpen] = useState(false);
    const [aiLyricsModalOpen, setAiLyricsModalOpen] = useState(false);
    const [toolbarEditOpen, setToolbarEditOpen] = useState(false);
    const [editingTargetFile, setEditingTargetFile] = useState<FileEntry | null>(null);

    const openToolbarEdit = useCallback(() => {
        setToolbarEditOpen(true);
        if (typeof window !== 'undefined' && window.location.pathname !== '/toolbar-edit') {
            window.history.pushState({modal: 'toolbar-edit'}, '', '/toolbar-edit');
        }
    }, []);

    const closeToolbarEdit = useCallback(() => {
        setToolbarEditOpen(false);
        closeModalPath('/toolbar-edit');
    }, []);

    const openEqualizer = useCallback(() => {
        setEqualizerOpen(true);
        if (typeof window !== 'undefined' && window.location.pathname !== '/equalizer') {
            window.history.pushState({modal: 'equalizer'}, '', '/equalizer');
        }
    }, []);

    const closeEqualizer = useCallback(() => {
        setEqualizerOpen(false);
        closeModalPath('/equalizer');
    }, []);

    const openSettings = useCallback(() => {
        setSettingsOpen(true);
        if (typeof window !== 'undefined' && window.location.pathname !== '/setting') {
            window.history.pushState({modal: 'setting'}, '', '/setting');
        }
    }, []);

    const closeSettings = useCallback(() => {
        setSettingsOpen(false);
        closeModalPath('/setting');
    }, []);

    const openStreaming = useCallback(() => {
        setStreamingOpen(true);
        if (typeof window !== 'undefined' && window.location.pathname !== '/streaming') {
            window.history.pushState({modal: 'streaming'}, '', '/streaming');
        }
    }, []);

    const closeStreaming = useCallback(() => {
        setStreamingOpen(false);
        closeModalPath('/streaming');
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
        closeModalPath('/metadata');
    }, []);

    const openLyricsSearch = useCallback(() => {
        setLyricsSearchOpen(true);
        if (typeof window !== 'undefined' && window.location.pathname !== '/lyrics-search') {
            window.history.pushState({modal: 'lyrics-search'}, '', '/lyrics-search');
        }
    }, []);

    const closeLyricsSearch = useCallback(() => {
        setLyricsSearchOpen(false);
        closeModalPath('/lyrics-search');
    }, []);

    const openAiLyricsModal = useCallback(() => {
        setAiLyricsModalOpen(true);
        if (typeof window !== 'undefined' && window.location.pathname !== '/ai-lyrics') {
            window.history.pushState({modal: 'ai-lyrics'}, '', '/ai-lyrics');
        }
    }, []);

    const closeAiLyricsModal = useCallback(() => {
        setAiLyricsModalOpen(false);
        closeModalPath('/ai-lyrics');
    }, []);

    useEffect(() => {
        const syncModalFromUrl = () => {
            const path = window.location.pathname.toLowerCase();
            if (path.includes('/toolbar-edit')) {
                setToolbarEditOpen(true);
                setEqualizerOpen(false);
                setSettingsOpen(false);
                setStreamingOpen(false);
                setMetadataEditOpen(false);
                setLyricsSearchOpen(false);
                setAiLyricsModalOpen(false);
            } else if (path.includes('/equalizer')) {
                setEqualizerOpen(true);
                setToolbarEditOpen(false);
                setSettingsOpen(false);
                setStreamingOpen(false);
                setMetadataEditOpen(false);
                setLyricsSearchOpen(false);
                setAiLyricsModalOpen(false);
            } else if (path.includes('/setting')) {
                setSettingsOpen(true);
                setToolbarEditOpen(false);
                setEqualizerOpen(false);
                setStreamingOpen(false);
                setMetadataEditOpen(false);
                setLyricsSearchOpen(false);
                setAiLyricsModalOpen(false);
            } else if (path.includes('/streaming')) {
                setStreamingOpen(true);
                setToolbarEditOpen(false);
                setEqualizerOpen(false);
                setSettingsOpen(false);
                setMetadataEditOpen(false);
                setLyricsSearchOpen(false);
                setAiLyricsModalOpen(false);
            } else if (path.includes('/metadata')) {
                setMetadataEditOpen(true);
                setToolbarEditOpen(false);
                setEqualizerOpen(false);
                setSettingsOpen(false);
                setStreamingOpen(false);
                setLyricsSearchOpen(false);
                setAiLyricsModalOpen(false);
            } else if (path.includes('/lyrics-search')) {
                setLyricsSearchOpen(true);
                setToolbarEditOpen(false);
                setEqualizerOpen(false);
                setSettingsOpen(false);
                setStreamingOpen(false);
                setMetadataEditOpen(false);
                setAiLyricsModalOpen(false);
            } else if (path.includes('/ai-lyrics')) {
                setAiLyricsModalOpen(true);
                setToolbarEditOpen(false);
                setEqualizerOpen(false);
                setSettingsOpen(false);
                setStreamingOpen(false);
                setMetadataEditOpen(false);
                setLyricsSearchOpen(false);
            } else if (path === '/' || path === '') {
                setToolbarEditOpen(false);
                setEqualizerOpen(false);
                setSettingsOpen(false);
                setStreamingOpen(false);
                setMetadataEditOpen(false);
                setLyricsSearchOpen(false);
                setAiLyricsModalOpen(false);
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
        aiLyricsModalOpen,
        setAiLyricsModalOpen,
        toolbarEditOpen,
        setToolbarEditOpen,
        editingTargetFile,
        setEditingTargetFile,
        openToolbarEdit,
        closeToolbarEdit,
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
        openAiLyricsModal,
        closeAiLyricsModal,
    };
}

