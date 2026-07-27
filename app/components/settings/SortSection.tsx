'use client';

import {useState} from 'react';
import {SelectStub, SettingRow} from './controls';

export default function SortSection({
    folderSort,
    setFolderSort,
    fileSort,
    setFileSort,
    sortDir,
    setSortDir,
    nameSource,
    setNameSource,
    formats,
    setFormats,
}: {
    folderSort: string;
    setFolderSort: (v: string) => void;
    fileSort: string;
    setFileSort: (v: string) => void;
    sortDir: string;
    setSortDir: (v: string) => void;
    nameSource: string;
    setNameSource: (v: string) => void;
    formats: string[];
    setFormats: (v: string[]) => void;
}) {
    const allFormats = ['mp3', 'flac', 'ogg', 'wav', 'm4a', 'wma'];
    const [customInput, setCustomInput] = useState('');
    const toggleFormat = (fmt: string) => {
        if (formats.includes(fmt)) {
            if (formats.length > 1) setFormats(formats.filter(f => f !== fmt));
        } else {
            setFormats([...formats, fmt]);
        }
    };
    const addCustomFormat = () => {
        let ext = customInput.trim().toLowerCase().replace(/^\./, '');
        if (!ext || !/^[a-z0-9]+$/.test(ext)) return;
        if (!formats.includes(ext)) {
            setFormats([...formats, ext]);
        }
        setCustomInput('');
    };
    // Collect all unique formats for display (predefined first, then custom)
    const displayedFormats = [...new Set([...allFormats, ...formats])];
    return (
        <div className="space-y-6">
            <SettingRow
                title="Urutkan Folder"
                description="Susunan folder di file explorer"
            >
                <SelectStub
                    options={[[ 'name', 'Name' ], [ 'mtime', 'Modified Time' ], [ 'ctime', 'Created Time' ]]}
                    value={folderSort}
                    onChange={setFolderSort}
                />
            </SettingRow>
            <SettingRow
                title="Urutkan File"
                description="Susunan file audio di file explorer"
            >
                <SelectStub
                    options={[[ 'name', 'Name' ], [ 'mtime', 'Modified Time' ], [ 'size', 'Size' ], [ 'ext', 'Type' ], [ 'ctime', 'Created Time' ]]}
                    value={fileSort}
                    onChange={setFileSort}
                />
            </SettingRow>
            <SettingRow
                title="Nama-Nama daftar lagu yg ditampilkan"
                description="list lagu yg ditampilkan berdasarkan nama file atau title (metadata)"
                className="pb-20"
            >

                <SelectStub
                    options={[[ 'filename', 'Nama File' ], [ 'title', 'Title (Metadata)' ]]}
                    value={nameSource}
                    onChange={setNameSource}
                />
                <div className='absolute -bottom-16 inset-x-0 w-full h-full'>
                    <div className={`flex items-start gap-2 px-3 py-2 rounded-lg text-[11px] leading-relaxed -mt-3 ${nameSource === 'title' ? 'bg-amber-900/20 text-amber-300/90 border border-amber-700/30' : 'bg-zinc-800/30 text-zinc-500 border border-zinc-700/30'}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                            {nameSource === 'title' ? (
                                <>
                                    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                    <line x1="12" y1="9" x2="12" y2="13" />
                                    <line x1="12" y1="17" x2="12.01" y2="17" />
                                </>
                            ) : (
                                <>
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="16" x2="12" y2="12" />
                                    <line x1="12" y1="8" x2="12.01" y2="8" />
                                </>
                            )}
                        </svg>
                        <span>
                            {nameSource === 'title'
                                ? 'Menggunakan Title (Metadata) akan membaca tag dari setiap file audio, sehingga waktu memuat daftar lagu bisa lebih lama terutama jika folder berisi banyak file. bahkan bisa menyebabkan aplikasi crash'
                                : 'Jika ingin menampilkan judul dari metadata (bukan nama file), waktu memuat daftar lagu akan sedikit lebih lama.'}
                        </span>
                    </div>


                </div>
            </SettingRow>
            <SettingRow
                title="Arah Urutan"
                description="Naik atau turun"
            >
                <SelectStub
                    options={[[ 'asc', 'Ascending' ], [ 'desc', 'Descending' ]]}
                    value={sortDir}
                    onChange={setSortDir}
                />
            </SettingRow>
            <SettingRow
                title="Format File"
                description="Format file audio yang ditampilkan di explorer"
            >
                <div className="space-y-2">
                    <div className="flex flex-wrap gap-1.5 max-w-[260px]">
                        {displayedFormats.map((fmt) => {
                            const active = formats.includes(fmt);
                            const isCustom = !allFormats.includes(fmt);
                            return (
                                <button
                                    key={fmt}
                                    onClick={() => toggleFormat(fmt)}
                                    className={`px-2 py-1 rounded-md text-[11px] font-medium border cursor-pointer transition-all ${active
                                        ? 'bg-zinc-700/80 text-zinc-200 border-zinc-600'
                                        : 'bg-zinc-800/40 text-zinc-500 border-zinc-700/50 hover:bg-zinc-800/70 hover:text-zinc-400'
                                        } ${isCustom ? 'italic' : ''}`}
                                >
                                    .{fmt}
                                </button>
                            );
                        })}
                    </div>
                    <div className="flex items-center gap-1.5">
                        <input
                            type="text"
                            value={customInput}
                            onChange={(e) => setCustomInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && addCustomFormat()}
                            placeholder=".aac"
                            className="w-20 px-2 py-1 rounded-md text-[11px] bg-zinc-800/60 border border-zinc-700/50 text-zinc-300 outline-none focus:border-zinc-500 placeholder:text-zinc-600"
                        />
                        <button
                            onClick={addCustomFormat}
                            className="px-2 py-1 rounded-md text-[11px] font-medium text-zinc-300 bg-zinc-800/60 hover:bg-zinc-700/70 border border-zinc-700/50 transition-colors cursor-pointer"
                        >
                            Tambah
                        </button>
                    </div>
                </div>
            </SettingRow>
        </div >
    );
}
