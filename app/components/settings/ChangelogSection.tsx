'use client';

import {type Lang} from '../../lib/translations';

const changelogEn = [
    {version: '0.9.5', items: [
        'Unified animation presets and replaced many inline framer-motion configs with shared contentMotion/backdropMotion for consistent UI transitions.',
        'Added a comprehensive Skeleton system and specialized loading skeletons (PlayerPanel, MetadataPanel, FolderExplorer) to improve initial-load UX.',
        'Improved fullscreen album-art mode: auto-hiding player controls with a configurable delay and UI/animation polish.',
        'Expanded right-click context menus across the app (copy path, save cover image, open devtools, playback and folder actions).',
        'Session persistence for last-played file and position; session restore loads position but defers wallpaper until the user resumes playback.',
        'Major refactor of the audio player (useAudioPlayer): more robust lifecycle, better volume/mute handling, auto-pause/resume on mute/volume 0, and session restore support.',
        'Tighter system/app volume synchronization on Windows (Tauri), added system-mute toggle and stricter volume-limit enforcement.',
        'Performance and polish: motion/animation updates, virtual-list and skeleton usage for FolderExplorer, and metadata/player transition improvements.',
        'Small UX/dev conveniences: blocked browser reload (Ctrl/Cmd+R) inside the app and added a Reload Page context menu entry.'
    ]},
    {version: '0.9.0', items: ["Fixed a small display issue in the alerts box.", "Added right-click menus throughout the app, letting you copy file paths, save album covers, open developer tools, and playback/folder actions.", "New fullscreen album art mode with auto-hiding controls and a persisted preference.", "Windows volume callback + frontend sync to replace polling.", "Added HoverInfoContext for hover descriptions and a hover-status bar.", "Added 'Pause if Muted' setting and auto pause/resume when muted or volume = 0; system mute toggle and refined volume handling."]},
    {version: '0.8.5', items: ['Responsive layout adjustments for narrow viewports', 'Header buttons no longer overlap on small screens', 'Fixed text overflow']},
    {version: '0.8.0', items: ['Pubkey removed from source config, injected via CI env var', 'Pre-build script for CI environment injection', 'Changelog section in Settings']},
    {version: '0.7.5', items: ['Auto-update notification on startup with download progress', 'Remind Later / Stay on Current Version options for updates']},
    {version: '0.7.0', items: ['Bilingual support (English / Indonesia)', 'Persistent language selection in Settings', 'All UI text moved to translation system', 'Non-technical About section with user-facing docs']},
    {version: '0.6.0', items: ['Customizable keyboard shortcuts', 'System volume control with safety limits', 'Modular code architecture (hooks + components)', 'Volume limit enforcement with UI feedback']},
    {version: '0.5.0', items: ['Virtual scrolling for large music libraries', 'Sort by metadata title (not just filename)', 'CI/CD pipeline with GitHub Actions', 'Tauri updater integration']},
    {version: '0.4.0', items: ['Streaming modal with YouTube, Spotify, SoundCloud and more', 'Webview-based streaming with URL monitoring', 'Media URL detection for multiple platforms']},
    {version: '0.3.0', items: ['Settings modal with General, Sort, Style sections', 'Accent color system with 14 presets', 'Default wallpaper picker and persistence', 'Configurable audio format filters']},
    {version: '0.2.0', items: ['Auto wallpaper feature (cover art to desktop wallpaper)', 'Default wallpaper image support', 'Native folder picker dialog', 'Resizable sidebars', 'Playlist state management']},
    {version: '0.1.0', items: ['Initial release', 'Audio player with play/pause/next/prev', 'File explorer for local music folders', 'Volume control and seek bar', 'Support for MP3, FLAC, OGG, WAV']},
];

const changelogId = [
    {version: '0.9.5', items: [
        'Preset animasi terpusat: mengganti banyak konfigurasi framer-motion inline dengan contentMotion/backdropMotion untuk transisi UI yang konsisten.',
        'Menambahkan sistem Skeleton lengkap dan skeleton pemuatan khusus (PlayerPanel, MetadataPanel, FolderExplorer) untuk meningkatkan UX saat pemuatan awal.',
        'Peningkatan mode fullscreen cover-art: kontrol pemutar yang otomatis disembunyikan dengan delay yang dapat dikonfigurasi dan polish tata letak/animasi.',
        'Perluasan menu klik-kanan di seluruh aplikasi (salin path, simpan gambar sampul, buka devtools, kontrol playback dan operasi folder).',
        'Persistensi sesi untuk file terakhir yang diputar dan posisi; pemulihan sesi memuat posisi tetapi menunda pengaturan wallpaper sampai pengguna melanjutkan pemutaran.',
        'Refactor besar pada audio player (useAudioPlayer): lifecycle lebih kuat, penanganan volume/mute lebih baik, auto-pause/resume saat mute/volume 0, dan dukungan pemulihan sesi.',
        'Sinkronisasi volume system/app yang lebih ketat di Windows (Tauri), tambah toggle system-mute dan penegakan batas volume yang lebih ketat.',
        'Performa dan polish: pembaruan motion/animasi, penggunaan virtual-list dan skeleton pada FolderExplorer, serta perbaikan transisi metadata/player.',
        'Kenikmatan kecil untuk pengembang/UX: memblokir reload browser (Ctrl/Cmd+R) di dalam aplikasi dan menambahkan entri Reload Page pada context menu.'
    ]},
    {version: '0.9.0', items: ["Memperbaiki tampilan kecil pada notifikasi peringatan.", "Menambahkan menu klik-kanan di seluruh aplikasi, jadi bisa menyalin lokasi file, menyimpan gambar sampul, membuka developer tools, dan aksi playback/folder.", "Mode fullscreen album art baru dengan kontrol yang auto-hide dan preferensi yang dipersist.", "Callback volume Windows + sinkronisasi frontend menggantikan polling.", "Menambahkan HoverInfoContext untuk deskripsi hover dan hover-status bar.", "Menambahkan pengaturan 'Pause if Muted' dan auto pause/resume saat mute atau volume = 0; toggle system-mute dan perbaikan handling volume."]},
    {version: '0.8.5', items: ['Penyesuaian layout responsif untuk viewport sempit', 'Tombol header tidak lagi bertumpuk di layar kecil', 'Perbaikan overflow teks ']},
    {version: '0.8.0', items: ['Pubkey dihapus dari source config, diinjeksi via env var CI', 'Script pre-build untuk injeksi environment CI', 'Bagian Changelog di Settings']},
    {version: '0.7.5', items: ['Notifikasi update otomatis saat startup dengan progress download', 'Opsi Ingatkan Nanti / Tetap di Versi Saat Ini untuk update']},
    {version: '0.7.0', items: ['Dukungan bilingual (English / Indonesia)', 'Pemilihan bahasa persisten di Settings', 'Semua teks UI dipindahkan ke sistem translasi', 'Bagian About non-teknis dengan dokumentasi pengguna']},
    {version: '0.6.0', items: ['Pintasan keyboard yang dapat dikustomisasi', 'Kontrol volume sistem dengan batas aman', 'Arsitektur kode modular (hooks + komponen)', 'Penegakan batas volume dengan umpan balik UI']},
    {version: '0.5.0', items: ['Virtual scrolling untuk koleksi musik besar', 'Urutkan berdasarkan judul metadata (bukan hanya nama file)', 'Pipeline CI/CD dengan GitHub Actions', 'Integrasi Tauri updater']},
    {version: '0.4.0', items: ['Modal streaming dengan YouTube, Spotify, SoundCloud dan lainnya', 'Streaming berbasis Webview dengan pemantauan URL', 'Deteksi URL media untuk berbagai platform']},
    {version: '0.3.0', items: ['Modal Settings dengan bagian General, Sort, Style', 'Sistem warna aksen dengan 14 preset', 'Pemilih wallpaper default dan persistensi', 'Filter format audio yang dapat dikonfigurasi']},
    {version: '0.2.0', items: ['Fitur wallpaper otomatis (cover art ke wallpaper desktop)', 'Dukungan gambar wallpaper default', 'Dialog pemilih folder native', 'Sidebar yang dapat diubah ukurannya', 'Manajemen status playlist']},
    {version: '0.1.0', items: ['Rilis awal', 'Pemutar audio dengan play/pause/next/prev', 'Penjelajah file untuk folder musik lokal', 'Kontrol volume dan seek bar', 'Dukungan MP3, FLAC, OGG, WAV']},
];

export default function ChangelogSection({lang}: {lang: Lang}) {
    const data = lang === 'id' ? changelogId : changelogEn;
    return (
        <div className="space-y-5">
            {data.map((release) => (
                <div key={release.version} className="bg-zinc-900/60 rounded-xl border border-zinc-800/60 p-4">
                    <h4 className="text-sm font-semibold text-green-400 mb-2">v{release.version}</h4>
                    <ul className="space-y-1.5">
                        {release.items.map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-zinc-300">
                                <span className="text-green-500/70 mt-0.5 shrink-0">•</span>
                                <span>{item}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
        </div>
    );
}
