'use client';

import {type Lang} from '../../lib/translations';


const changelogEn = [
    {
        version: '0.9.5',
        items: [
            'Smoother, more consistent animations throughout the app.',
            'Added loading screens for a better experience while content loads.',
            'Improved fullscreen album art view with auto-hiding controls.',
            'More options in the right-click menu, including saving cover images and folder actions.',
            'The app now remembers the last song and playback position.',
            'Major improvements to the audio player for smoother playback and better volume control.',
            'Better volume syncing with Windows.',
            'General performance and visual improvements.',
            'Small improvements to prevent accidental page reloads.',
        ],
    },
    {
        version: '0.9.0',
        items: [
            'Fixed a small display issue in the alerts box.',
            'Added right-click menus throughout the app.',
            'New fullscreen album art mode with auto-hiding controls.',
            'Smoother volume syncing with Windows.',
            'Added hover descriptions and a status bar.',
            'Added automatic pause when muted or volume is at zero.',
        ],
    },
    {
        version: '0.8.5',
        items: [
            'Improved layout for smaller screens.',
            'Fixed overlapping header buttons.',
            'Fixed text display issues.',
        ],
    },
    {
        version: '0.8.0',
        items: [
            'Improved app security.',
            'Behind-the-scenes build improvements.',
            'Added a changelog section in Settings.',
        ],
    },
    {
        version: '0.7.5',
        items: [
            'Added update notifications with download progress.',
            'Added an option to postpone updates.',
        ],
    },
    {
        version: '0.7.0',
        items: [
            'Added bilingual support (English/Indonesian).',
            'Language preference is now remembered.',
            'Improved translation support throughout the app.',
            'Added an easy-to-understand About section.',
        ],
    },
    {
        version: '0.6.0',
        items: [
            'Added customizable keyboard shortcuts.',
            'Added system volume control with safety limits.',
            'General stability improvements.',
            'Added volume limit warnings.',
        ],
    },
    {
        version: '0.5.0',
        items: [
            'Smoother scrolling for large music libraries.',
            'Songs can now be sorted by title.',
            'Behind-the-scenes release improvements.',
            'Added automatic update support.',
        ],
    },
    {
        version: '0.4.0',
        items: [
            'Added streaming support for YouTube, Spotify, SoundCloud, and more.',
            'Streaming now works directly inside the app.',
            'Added recognition of links from various platforms.',
        ],
    },
    {
        version: '0.3.0',
        items: [
            'Added a Settings window with General, Sort, and Style options.',
            'Added 14 accent color themes.',
            'Added a default wallpaper option.',
            'Added audio format filtering.',
        ],
    },
    {
        version: '0.2.0',
        items: [
            'Added automatic wallpaper using album cover art.',
            'Added default wallpaper support.',
            'Improved folder selection.',
            'Added resizable sidebars.',
            'Playlist state is now remembered.',
        ],
    },
    {
        version: '0.1.0',
        items: [
            'Initial release.',
            'Basic audio player with play, pause, next, and previous.',
            'Added local music folder browsing.',
            'Added volume control and seek bar.',
            'Added support for MP3, FLAC, OGG, and WAV.',
        ],
    },
];

const changelogId = [
    {
        version: '0.9.5',
        items: [
            'Animasi di seluruh aplikasi menjadi lebih halus dan konsisten.',
            'Menambahkan tampilan pemuatan agar pengalaman lebih nyaman saat konten dimuat.',
            'Peningkatan mode fullscreen cover album dengan kontrol yang tersembunyi otomatis.',
            'Penambahan pilihan pada menu klik-kanan, termasuk simpan gambar sampul dan aksi folder.',
            'Aplikasi kini mengingat lagu dan posisi pemutaran terakhir.',
            'Perbaikan besar pada pemutar audio untuk pemutaran lebih lancar dan kontrol volume lebih baik.',
            'Sinkronisasi volume dengan Windows menjadi lebih baik.',
            'Peningkatan performa dan tampilan secara umum.',
            'Perbaikan kecil untuk mencegah reload halaman secara tidak sengaja.',
        ],
    },
    {
        version: '0.9.0',
        items: [
            'Memperbaiki tampilan kecil pada kotak peringatan.',
            'Menambahkan menu klik-kanan di seluruh aplikasi.',
            'Mode fullscreen album art baru dengan kontrol tersembunyi otomatis.',
            'Sinkronisasi volume dengan Windows lebih baik.',
            'Menambahkan deskripsi saat kursor diarahkan dan bilah status.',
            'Menambahkan jeda otomatis saat mute atau volume nol.',
        ],
    },
    {
        version: '0.8.5',
        items: [
            'Tampilan lebih baik untuk layar kecil.',
            'Memperbaiki tombol header yang bertumpuk.',
            'Memperbaiki masalah tampilan teks.',
        ],
    },
    {
        version: '0.8.0',
        items: [
            'Peningkatan keamanan aplikasi.',
            'Perbaikan di balik layar untuk proses build.',
            'Menambahkan bagian Changelog di Settings.',
        ],
    },
    {
        version: '0.7.5',
        items: [
            'Menambahkan notifikasi update dengan progres unduhan.',
            'Menambahkan opsi untuk menunda pembaruan.',
        ],
    },
    {
        version: '0.7.0',
        items: [
            'Menambahkan dukungan dwibahasa (Inggris/Indonesia).',
            'Pilihan bahasa kini diingat aplikasi.',
            'Peningkatan dukungan terjemahan di seluruh aplikasi.',
            'Menambahkan bagian About yang mudah dipahami.',
        ],
    },
    {
        version: '0.6.0',
        items: [
            'Menambahkan pintasan keyboard yang dapat disesuaikan.',
            'Menambahkan kontrol volume sistem dengan batas aman.',
            'Peningkatan stabilitas secara umum.',
            'Menambahkan peringatan batas volume.',
        ],
    },
    {
        version: '0.5.0',
        items: [
            'Scrolling lebih lancar untuk koleksi musik besar.',
            'Lagu kini dapat diurutkan berdasarkan judul.',
            'Perbaikan di balik layar untuk proses rilis.',
            'Menambahkan dukungan pembaruan otomatis.',
        ],
    },
    {
        version: '0.4.0',
        items: [
            'Menambahkan dukungan streaming untuk YouTube, Spotify, SoundCloud, dan lainnya.',
            'Streaming kini berjalan langsung di dalam aplikasi.',
            'Menambahkan pengenalan tautan dari berbagai platform.',
        ],
    },
    {
        version: '0.3.0',
        items: [
            'Menambahkan jendela Settings dengan pilihan General, Sort, dan Style.',
            'Menambahkan 14 tema warna aksen.',
            'Menambahkan pilihan wallpaper default.',
            'Menambahkan filter format audio.',
        ],
    },
    {
        version: '0.2.0',
        items: [
            'Menambahkan fitur wallpaper otomatis dari gambar sampul album.',
            'Menambahkan dukungan gambar wallpaper default.',
            'Peningkatan pemilihan folder.',
            'Menambahkan sidebar yang dapat diubah ukurannya.',
            'Status playlist kini diingat aplikasi.',
        ],
    },
    {
        version: '0.1.0',
        items: [
            'Rilis awal.',
            'Pemutar audio dasar dengan play, pause, next, dan previous.',
            'Menambahkan penjelajahan folder musik lokal.',
            'Menambahkan kontrol volume dan seek bar.',
            'Menambahkan dukungan MP3, FLAC, OGG, dan WAV.',
        ],
    },
];

export {changelogEn, changelogId};

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
