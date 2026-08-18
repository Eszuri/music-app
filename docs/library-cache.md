# Dokumentasi Cache Library

## Ringkasan

Symvonia sekarang menggunakan cache untuk daftar folder, subfolder, dan file audio. Cache dirancang untuk mengurangi pembacaan filesystem berulang ketika folder yang sama dibuka kembali, termasuk setelah aplikasi ditutup dan dijalankan ulang.

Implementasi menggunakan pendekatan **lazy per-folder**. Artinya, folder baru dipindai ketika pertama kali dibuka. Aplikasi tidak melakukan pemindaian recursive seluruh library pada saat root dipilih.

## Tujuan

Fitur ini dibuat untuk:

- mempercepat pembukaan folder yang pernah dibuka;
- mengurangi pemanggilan `fs::read_dir` berulang;
- mengurangi pembacaan metadata title audio menggunakan `lofty`;
- mempertahankan cache setelah aplikasi ditutup;
- memperbarui daftar secara otomatis ketika filesystem berubah dari Windows Explorer;
- menjaga playlist tetap sinkron dengan file yang tersedia.

## Arsitektur

```text
FolderExplorer / useAudioPlayer
        |
        | invoke("list_files")
        v
Rust command: list_files
        |
        +--> Cache memory
        |
        +--> Cache disk di AppData
        |
        +--> Scan filesystem jika cache miss/dirty
        |
        +--> Projection: format, nama, sorting
        v
FileEntry[] ke frontend
```

Filesystem watcher berjalan terpisah pada backend Rust:

```text
Windows Explorer
        |
        v
notify watcher recursive
        |
        v
Debounce event
        |
        v
Tandai folder dirty
        |
        v
Emit "library-cache-invalidated"
        |
        v
useAudioPlayer reload folder yang terdampak
```

## Komponen yang diubah

### Backend Rust

- `src-tauri/src/library_cache.rs`
  - State cache memory.
  - Snapshot cache persisten.
  - Validasi signature directory.
  - Atomic write cache.
  - Filesystem watcher recursive.
  - Debounce dan event invalidasi.
  - Command untuk mengganti root, membersihkan cache, dan menginvalidasi folder.

- `src-tauri/src/commands/audio.rs`
  - Mengubah listing menjadi pipeline scan, cache, dan projection.
  - Menyimpan entry filesystem mentah tanpa filter format.
  - Menerapkan filter format, sumber nama, dan sorting setelah snapshot dibaca.
  - Menyimpan title metadata secara lazy.

- `src-tauri/src/lib.rs`
  - Mendaftarkan `LibraryCacheState` dengan Tauri `manage`.
  - Mendaftarkan command cache ke `invoke_handler`.

- `src-tauri/src/commands/config.rs`
  - Membersihkan cache ketika seluruh data aplikasi dibersihkan.

- `src-tauri/Cargo.toml`
  - Menambahkan dependency `notify` untuk filesystem watcher.

### Frontend

- `app/hooks/useAudioPlayer.ts`
  - Menunggu root library aktif sebelum melakukan listing.
  - Menggunakan helper listing yang sama untuk navigasi, session restore, dan playlist.
  - Mendengarkan event invalidasi cache.
  - Reload hanya folder aktif atau folder playlist yang terdampak.
  - Memaksa invalidasi folder saat `refreshFiles()` dipanggil.

- `app/lib/tauri.ts`
  - Menambahkan adapter lazy untuk `listen` event Tauri.
  - Menambahkan tipe payload event invalidasi.

## Format cache

Cache disimpan di bawah AppData aplikasi dengan struktur berikut:

```text
<AppData>/library-cache/<root-hash>/<directory-hash>.json
```

`<root-hash>` dan `<directory-hash>` dibuat menggunakan SHA-256 dari path yang sudah dinormalisasi.

Path asli tetap disimpan di dalam payload agar hash tidak menjadi satu-satunya pemeriksaan identitas cache.

Contoh struktur snapshot:

```json
{
  "schema_version": 1,
  "root_path": "C:/Music",
  "directory_path": "C:/Music/Album",
  "signature": {
    "mtime": 0,
    "entry_count": 12,
    "fingerprint": 0
  },
  "cached_at": 0,
  "entries": [
    {
      "name": "01-song.flac",
      "path": "C:/Music/Album/01-song.flac",
      "is_dir": false,
      "ext": "flac",
      "mtime": 0,
      "size": 123456,
      "ctime": 0,
      "title": "Song Title",
      "title_loaded": true
    }
  ]
}
```

Nilai numerik pada contoh hanya ilustrasi.

## Alur `list_files`

1. Frontend memanggil `list_files` dengan path folder dan konfigurasi listing.
2. Backend menentukan root library aktif.
3. Backend memeriksa cache memory.
4. Jika tidak ada di memory, backend memeriksa cache disk.
5. Cache disk divalidasi berdasarkan:
   - `schema_version`;
   - root path;
   - directory path;
   - signature directory;
   - jumlah dan fingerprint entry.
6. Jika cache valid, snapshot digunakan.
7. Jika cache tidak ada, rusak, stale, atau ditandai dirty, backend membaca folder dari filesystem.
8. Snapshot baru ditulis ke disk secara atomic.
9. Projection diterapkan:
   - folder selalu ditampilkan;
   - file difilter berdasarkan `formats`;
   - nama file atau title dipilih berdasarkan `name_source`;
   - folder dan file diurutkan berdasarkan setting sorting.
10. Backend mengembalikan `FileEntry[]` dengan bentuk yang sama seperti sebelum fitur cache.

## Lazy title metadata

Entry file tidak langsung membaca title audio ketika snapshot pertama dibuat. Title dibaca hanya ketika `name_source` menggunakan `title` dan entry tersebut belum memiliki title cache.

Setelah title dibaca:

- `title` disimpan pada snapshot memory;
- snapshot diperbarui di disk;
- request berikutnya dapat menggunakan title cache.

Jika title tidak tersedia, frontend tetap menggunakan nama file tanpa ekstensi sebagai fallback.

## Filesystem watcher

Watcher dipasang secara recursive pada root library aktif menggunakan crate `notify`.

Watcher dimulai ketika command berikut dipanggil:

```text
set_library_root(path)
```

Ketika root berubah:

1. watcher root sebelumnya dihentikan;
2. cache memory root sebelumnya dibersihkan;
3. root baru disimpan sebagai root aktif;
4. watcher recursive baru dipasang.

Perubahan filesystem yang dipantau meliputi:

- file dibuat;
- file diubah;
- file dihapus;
- folder dibuat;
- folder dihapus;
- rename atau pemindahan entry.

Event dikumpulkan selama window debounce sekitar 350 ms. Tujuannya agar operasi seperti copy atau rename tidak menghasilkan banyak refresh UI berturut-turut.

## Event invalidasi

Backend mengirim event:

```text
library-cache-invalidated
```

Payload event:

```json
{
  "root_path": "C:/Music",
  "affected_paths": [
    "C:/Music",
    "C:/Music/Album"
  ]
}
```

Path yang terdampak mencakup entry yang berubah dan parent directory-nya. Frontend hanya memproses event jika `root_path` sesuai dengan root library aktif.

## Perilaku frontend

### Folder aktif

Jika folder yang sedang ditampilkan terdampak, `useAudioPlayer` memanggil ulang `loadFiles` untuk folder tersebut.

### Playlist

Jika folder asal playlist terdampak:

- playlist dibaca ulang;
- file yang tidak lagi tersedia dikeluarkan dari playlist;
- jika lagu terpilih sudah dihapus, selected song dan metadata dibersihkan.

### Folder lain

Jika perubahan terjadi pada folder yang tidak sedang ditampilkan dan tidak menjadi sumber playlist, UI tidak melakukan reload yang tidak diperlukan.

## Refresh manual

`refreshFiles()` tetap tersedia dan sekarang melakukan invalidasi eksplisit terhadap folder aktif melalui command:

```text
invalidate_library_directory(path)
```

Setelah invalidasi, folder aktif dimuat ulang dari filesystem dan snapshot cache diperbarui.

Alur ini digunakan setelah penyimpanan metadata audio agar perubahan title langsung terlihat pada daftar.

## Command Tauri

### `list_files`

Memuat daftar entry folder menggunakan cache atau scan filesystem jika diperlukan.

Kontrak parameter tetap sama:

- `path`;
- `folderSort`;
- `fileSort`;
- `sortDir`;
- `nameSource`;
- `formats`.

### `set_library_root`

Mengatur root library aktif dan lifecycle filesystem watcher.

Parameter:

```json
{
  "path": "C:/Music"
}
```

Nilai `path` dapat `null` untuk menghentikan watcher dan mengosongkan root aktif.

### `invalidate_library_directory`

Menandai satu folder sebagai dirty sehingga request berikutnya melakukan scan ulang.

Parameter:

```json
{
  "path": "C:/Music/Album"
}
```

### `clear_library_cache`

Menghentikan watcher, menghapus cache disk, dan mengosongkan cache memory.

## Penanganan error

Cache bukan sumber data utama. Jika terjadi masalah pada cache:

- file cache rusak diperlakukan sebagai cache miss;
- schema cache yang tidak dikenal diabaikan;
- kegagalan membaca cache dilanjutkan dengan scan filesystem;
- kegagalan menulis cache tidak menggagalkan hasil listing;
- kegagalan memasang watcher dicatat sebagai error nonfatal;
- listing tetap dapat berjalan dengan refresh atau validasi berikutnya.

Cache ditulis menggunakan temporary file unik dan rename. Pada Windows, jika target cache sudah ada dan rename gagal, target lama dihapus lalu file temporary dipindahkan ke lokasi target.

## Cleanup dan reset data

Command `clean_all_app_data` sekarang membersihkan cache sebelum menghapus isi AppData. Prosesnya:

1. hentikan watcher;
2. hapus folder `library-cache`;
3. kosongkan cache memory;
4. kosongkan root aktif;
5. hapus data AppData lainnya;
6. tulis ulang konfigurasi default.

## Kompatibilitas konfigurasi

Isi cache tidak disimpan di `config.json` dan tidak ditambahkan ke `SymvoniaConfig`.

`config.json` tetap menyimpan konfigurasi seperti:

- root folder musik;
- format audio;
- sorting;
- sumber nama file;
- session playback.

Cache menggunakan schema version terpisah. Perubahan schema dapat menginvalidasi cache lama tanpa mengubah konfigurasi pengguna.

## Pengujian

Test yang ditambahkan mencakup:

### `library_cache::tests`

- normalisasi path Windows dengan slash berbeda;
- hash path yang konsisten;
- serialization dan deserialization snapshot;
- pemetaan perubahan file ke parent directory yang terdampak.

### `commands::audio::tests`

- folder tetap ditampilkan walaupun filter format audio aktif;
- file dengan extension yang tidak dipilih tidak ditampilkan;
- title yang sudah ada di cache digunakan tanpa scan metadata ulang.

Validasi yang telah dijalankan:

- `cargo check` berhasil;
- test cache berhasil;
- test projection audio berhasil;
- `npm run build` berhasil;
- `npm run lint` berhasil dengan warning lint yang sudah ada di codebase.

Full test suite sebelumnya masih memiliki satu kegagalan pada test binary DSP lama:

```text
unified_engine_manager::tests::test_real_binary_get_curve_execution
```

Kegagalan tersebut terjadi karena binary DSP mengembalikan output kosong dan tidak terkait dengan fitur cache library.

## Batasan saat ini

- Index dibuat lazy; folder yang belum pernah dibuka belum memiliki snapshot cache.
- Watcher bergantung pada kemampuan OS dan permission filesystem.
- Jika watcher gagal dipasang, perubahan eksternal baru terdeteksi ketika folder dibuka ulang atau di-refresh.
- Cache menyimpan daftar satu level per folder, bukan satu dokumen recursive untuk seluruh tree.
- Belum ada UI khusus untuk menampilkan ukuran atau status cache library.
