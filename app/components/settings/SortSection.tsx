'use client';

import {useState} from 'react';
import {SelectStub, SettingRow} from './controls';
import {t, type Lang} from '../../lib/translations';

export default function SortSection({
    lang,
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
    accentColor = 'sky',
}: {
    lang: Lang;
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
    accentColor?: string;
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
        const ext = customInput.trim().toLowerCase().replace(/^\./, '');
        if (!ext || !/^[a-z0-9]+$/.test(ext)) return;
        if (!formats.includes(ext)) {
            setFormats([...formats, ext]);
        }
        setCustomInput('');
    };
    const displayedFormats = [...new Set([...allFormats, ...formats])];
    return (
        <div className="space-y-6">
            <SettingRow
                title={t(lang, 'sort.folderSort.title')}
                description={t(lang, 'sort.folderSort.desc')}
            >
                <SelectStub
                    options={[['name', t(lang, 'sort.folder.name')], ['mtime', t(lang, 'sort.folder.mtime')], ['ctime', t(lang, 'sort.folder.ctime')]]}
                    value={folderSort}
                    onChange={setFolderSort}
                    accentColor={accentColor}
                />
            </SettingRow>
            <SettingRow
                title={t(lang, 'sort.fileSort.title')}
                description={t(lang, 'sort.fileSort.desc')}
            >
                <SelectStub
                    options={[
                        ['name', t(lang, 'sort.file.name')],
                        ['artist', t(lang, 'sort.file.artist')],
                        ['album', t(lang, 'sort.file.album')],
                        ['track', t(lang, 'sort.file.track')],
                        ['year', t(lang, 'sort.file.year')],
                        ['genre', t(lang, 'sort.file.genre')],
                        ['duration', t(lang, 'sort.file.duration')],
                        ['size', t(lang, 'sort.file.size')],
                        ['ext', t(lang, 'sort.file.ext')],
                        ['mtime', t(lang, 'sort.file.mtime')],
                        ['ctime', t(lang, 'sort.file.ctime')],
                    ]}
                    value={fileSort}
                    onChange={setFileSort}
                    accentColor={accentColor}
                />
            </SettingRow>
            <SettingRow
                title={t(lang, 'sort.nameSource.title')}
                description={t(lang, 'sort.nameSource.desc')}
                className="pb-22"
            >

                <SelectStub
                    options={[['filename', t(lang, 'sort.name.filenameLabel')], ['title', t(lang, 'sort.name.titleLabel')]]}
                    value={nameSource}
                    onChange={setNameSource}
                    accentColor={accentColor}
                />
                <div className='absolute -bottom-16 inset-x-0 w-full h-full'>
                    <div className={`flex items-start gap-2 px-3 py-2 rounded-lg text-[11px] leading-relaxed mt-3 ${nameSource === 'title' ? 'bg-amber-900/20 text-amber-300/90 border border-amber-700/30' : 'bg-zinc-800/30 text-zinc-500 border border-zinc-700/30'}`}>
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
                                ? t(lang, 'sort.nameSource.titleWarning')
                                : t(lang, 'sort.nameSource.filenameInfo')}
                        </span>
                    </div>


                </div>
            </SettingRow>
            <SettingRow
                title={t(lang, 'sort.sortDir.title')}
                description={t(lang, 'sort.sortDir.desc')}
            >
                <SelectStub
                    options={[['asc', t(lang, 'sort.dir.asc')], ['desc', t(lang, 'sort.dir.desc')]]}
                    value={sortDir}
                    onChange={setSortDir}
                    accentColor={accentColor}
                />
            </SettingRow>
            <SettingRow
                title={t(lang, 'sort.format.title')}
                description={t(lang, 'sort.format.desc')}
            >
                <div className="space-y-2">
                    <div className="flex flex-wrap gap-1.5 max-w-65">
                        {displayedFormats.map((fmt) => {
                            const active = formats.includes(fmt);
                            const isCustom = !allFormats.includes(fmt);
                            return (
                                <button
                                    key={fmt}
                                    onClick={() => toggleFormat(fmt)}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border cursor-pointer transition-all shadow-xs active:scale-[0.98] ${active
                                        ? 'bg-zinc-700 text-zinc-100 border-zinc-500 font-semibold'
                                        : 'bg-zinc-800/80 text-zinc-400 border-zinc-700/60 hover:bg-zinc-700/80 hover:text-zinc-200'
                                        } ${isCustom ? 'italic' : ''}`}
                                >
                                    .{fmt}
                                </button>
                            );
                        })}
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            value={customInput}
                            onChange={(e) => setCustomInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && addCustomFormat()}
                            placeholder={t(lang, 'sort.format.placeholder')}
                            className="w-24 px-3 py-1.5 rounded-lg text-xs bg-zinc-800/80 border border-zinc-700/60 text-zinc-200 outline-none focus:border-zinc-500 placeholder:text-zinc-500 shadow-xs"
                        />
                        <button
                            onClick={addCustomFormat}
                            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-zinc-200 bg-zinc-800 hover:bg-zinc-700 hover:text-white border border-zinc-700/60 shadow-xs transition-all cursor-pointer active:scale-[0.98]"
                        >
                            {t(lang, 'sort.format.add')}
                        </button>
                    </div>
                </div>
            </SettingRow>
        </div >
    );
}
