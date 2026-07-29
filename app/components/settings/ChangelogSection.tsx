'use client';

import {type Lang} from '../../lib/translations';

const changelogEn = [
    {version: '0.8.0', items: ['Pubkey removed from source config, injected via CI env var', 'Pre-build script for CI environment injection', 'Changelog section in Settings']},
    {version: '0.7.5', items: ['Auto-update notification on startup with download progress', 'Remind Later / Stay on Current Version options for updates']},
    {version: '0.7.0', items: ['Bilingual support (English / Indonesia)', 'Persistent language selection in Settings', 'All UI text moved to translation system', 'Non-technical About section with app description', 'Public-facing README rewrite']},
    {version: '0.6.0', items: ['Customizable keyboard shortcuts', 'System volume control with safety limits', 'Modular code architecture (hooks + components)', 'Volume limit enforcement with UI feedback', 'Configurable volume step size']},
    {version: '0.5.0', items: ['Virtual scrolling for large music libraries', 'Sort by metadata title (not just filename)', 'CI/CD pipeline with GitHub Actions', 'Tauri updater integration']},
    {version: '0.4.0', items: ['Streaming modal with YouTube, Spotify, SoundCloud and more', 'Webview-based streaming with URL monitoring', 'Media URL detection for multiple platforms', 'Streaming history with auto-save']},
    {version: '0.3.0', items: ['Settings modal with General, Sort, Style sections', 'Accent color system with 14 presets', 'Default wallpaper picker and persistence', 'Configurable audio format filters', 'File sorting by name, size, extension, and date', 'Metadata panel with song details', 'Framer Motion animations']},
    {version: '0.2.0', items: ['Auto wallpaper feature (cover art to desktop wallpaper)', 'Default wallpaper image support', 'Native folder picker dialog', 'Resizable sidebars', 'Playlist state management', 'Folder navigation (go up, root lock)']},
    {version: '0.1.0', items: ['Initial release', 'Audio player with play/pause/next/prev', 'File explorer for local music folders', 'Volume control and seek bar', 'Support for MP3, FLAC, OGG, WAV, M4A, WMA', 'Tauri 2 desktop shell']},
];

const changelogId = [
    {version: '0.8.0', items: ['Pubkey dihapus dari source config, diinjeksi via env var CI', 'Script pre-build untuk injeksi environment CI', 'Bagian Changelog di Settings']},
    {version: '0.7.5', items: ['Notifikasi update otomatis saat startup dengan progress download', 'Opsi Ingatkan Nanti / Tetap di Versi Saat Ini untuk update']},
    {version: '0.7.0', items: ['Dukungan bilingual (English / Indonesia)', 'Pemilihan bahasa persisten di Settings', 'Semua teks UI dipindahkan ke sistem translasi', 'Bagian About non-teknis dengan deskripsi aplikasi', 'Penulisan ulang README untuk publik']},
    {version: '0.6.0', items: ['Pintasan keyboard yang dapat dikustomisasi', 'Kontrol volume sistem dengan batas aman', 'Arsitektur kode modular (hooks + komponen)', 'Penegakan batas volume dengan umpan balik UI', 'Ukuran step volume yang dapat diatur']},
    {version: '0.5.0', items: ['Virtual scrolling untuk koleksi musik besar', 'Urutkan berdasarkan judul metadata (bukan hanya nama file)', 'Pipeline CI/CD dengan GitHub Actions', 'Integrasi Tauri updater']},
    {version: '0.4.0', items: ['Modal streaming dengan YouTube, Spotify, SoundCloud dan lainnya', 'Streaming berbasis Webview dengan pemantauan URL', 'Deteksi URL media untuk berbagai platform', 'Riwayat streaming dengan auto-save']},
    {version: '0.3.0', items: ['Modal Settings dengan bagian General, Sort, Style', 'Sistem warna aksen dengan 14 preset', 'Pemilih wallpaper default dan persistensi', 'Filter format audio yang dapat diatur', 'Pengurutan file berdasarkan nama, ukuran, ekstensi, dan tanggal', 'Panel metadata dengan detail lagu', 'Animasi Framer Motion']},
    {version: '0.2.0', items: ['Fitur wallpaper otomatis (cover art ke wallpaper desktop)', 'Dukungan gambar wallpaper default', 'Dialog pemilih folder native', 'Sidebar yang dapat diatur ukurannya', 'Manajemen status playlist', 'Navigasi folder (naik, kunci root)']},
    {version: '0.1.0', items: ['Rilis awal', 'Pemutar audio dengan play/pause/next/prev', 'Penjelajah file untuk folder musik lokal', 'Kontrol volume dan seek bar', 'Dukungan MP3, FLAC, OGG, WAV, M4A, WMA', 'Shell desktop Tauri 2']},
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
