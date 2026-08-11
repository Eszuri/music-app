# Symvonia Plugins Directory

Direktori ini berisi kode sumber untuk plugin eksternal berbasis **.NET 8 (C#)** yang digunakan oleh **Symvonia Player** sebagai *headless sidecar background engines* via komunikasi **Stdio JSON IPC**.

---

## 🧩 Daftar Plugin

### 1. `src-audio-engine` — WASAPI Exclusive Bit-Perfect Audio Engine
Engine audio performa tinggi untuk pemutaran audio lossless bit-perfect secara eksklusif.

- **Teknologi**: .NET 8.0, NAudio (WASAPI Exclusive Mode)
- **Nama Executable**: `symvonia-audio-engine.exe`
- **Fitur**:
  - Pemutaran audio 100% bit-perfect Bypass System Mixer Windows (WASAPI Exclusive)
  - Pengaturan *output device* (Soundcard / DAC)
  - Kontrol *playback*: Play, Pause, Resume, Stop, Seek, Volume
  - Pelaporan *real-time progress* & posisi audio via Stdio JSON IPC

#### Perintah Build:
```bash
dotnet publish plugin/src-audio-engine/AudioEngine.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o plugin/src-audio-engine/publish
```

---

### 2. `src-ai-lyrics` — Local AI Lyrics Generator Engine
Engine transkripsi lirik otomatis offline menggunakan model kecerdasan buatan (AI) Speech-to-Text lokal.

- **Teknologi**: .NET 8.0, `Whisper.net` (v1.9.1), NAudio
- **Nama Executable**: `symvonia-ai-lyrics.exe`
- **Fitur**:
  - Transkripsi lirik otomatis dengan timestamp format LRC (`[mm:ss.xx]`)
  - 100% Offline & Lokal tanpa ketergantungan koneksi internet
  - Mendukung 12+ pilihan bahasa (`auto`, `id`, `en`, `ja`, `ko`, `zh`, `es`, `fr`, `de`, `ru`, `pt`, `it`)
  - Mendukung berbagai ukuran model Whisper (`base`, `tiny`, `small`)
  - Pengunduhan model otomatis dari HuggingFace jika belum tersedia

#### Struktur Berkas & Dependency Native:
Agar engine `Whisper.net` dapat memuat *native C++ library*, struktur output publish harus menyertakan berkas DLL berikut di folder utama dan di subdirektori `runtimes/win-x64/`:
- `symvonia-ai-lyrics.exe`
- `whisper.dll`
- `ggml-whisper.dll`
- `ggml-base-whisper.dll`
- `ggml-cpu-whisper.dll`
- `runtimes/win-x64/*.dll`

#### Perintah Build:
```bash
dotnet publish plugin/src-ai-lyrics/AiLyricsPlugin.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o plugin/src-ai-lyrics/publish
```
*Atau gunakan skrip otomatis:* `.\build-plugin-lyrics.bat`

---

## 📡 Protokol Komunikasi (Stdio JSON IPC)

Setiap plugin berjalan sebagai *standalone headless console application* yang menerima perintah JSON per baris melalui `stdin` dan mengirim respons/event JSON per baris melalui `stdout`.

### Contoh Format Perintah (`stdin`):
```json
{
  "command": "transcribe",
  "path": "C:\\Music\\song.flac",
  "modelName": "base",
  "language": "id",
  "modelsDir": "C:\\Users\\...\\AppData\\...\\plugins\\ai-lyrics\\models"
}
```

### Contoh Format Event (`stdout`):
```json
{
  "event": "progress",
  "percent": 45,
  "segmentText": "Aku ingin mencintaimu dengan sederhana",
  "timestamp": "[01:23.45]"
}
```

---

## 📂 Lokasi Instalasi Runtime pada Symvonia Player

Saat diunduh atau diimpor oleh Symvonia Player, plugin dipasang pada direktori `AppData` pengguna:
- **Audio Engine**: `%APPDATA%\com.symvonia.player\plugins\audio-engine\`
- **AI Lyrics Plugin**: `%APPDATA%\com.symvonia.player\plugins\ai-lyrics\`
