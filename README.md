# RembuganAI

> **Saka obrolan dadi tindakan.**

RembuganAI membantu tim produk melompat dari diskusi rapat menjadi spesifikasi produk yang siap dibagikan. Unggah transkrip, kurasi ringkasan AI, lalu ekspor draft PRD dalam sekali alur.

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-0f1d38?style=for-the-badge&logo=vercel)](https://vercel.com/daffa-akbars-projects/v0-meeting-transcript-to-spec)
[![Made with Next.js](https://img.shields.io/badge/Next.js-15-102347?style=for-the-badge&logo=nextdotjs)](https://nextjs.org/)

## ✨ Fitur Utama

- **Ringkasan dua bahasa** – AI memahami bahasa Indonesia dan Inggris untuk menangkap highlight rapat.
- **Stepper lintas tahap** – alur terstruktur: input rapat → review ringkasan → finalisasi spesifikasi.
- **Editor spesifikasi interaktif** – susun objective, requirement, risiko, hingga user story secara modular.
- **Ekspor instan** – download PDF/DOCX atau salin sebagai Markdown untuk masuk ke tool kolaborasi Anda.
- **Integrasi Outline** – kirim spesifikasi langsung ke koleksi Outline hanya dengan memasukkan nama proyek.

## 🧭 Positioning

- **Audience**: Tim produk, PM, dan analis yang menangani banyak diskusi lintas fungsi.
- **Value**: Menghemat waktu dokumentasi dan menjaga konteks keputusan rapat tetap rapi.
- **Tagline**: *“Saka obrolan dadi tindakan.”*

## 🖌️ Palet Warna

| Token | Warna |
| --- | --- |
| Primary | `#102347` (navy)
| Secondary | `#F2B705` (emas)
| Accent | `#D4A843` |
| Background | `#F7F8FC` |

## 🚀 Menjalankan Secara Lokal

```bash
pnpm install
pnpm dev
```

Akses aplikasi melalui `http://localhost:3000`.

### Konfigurasi Outline (Opsional)

Tambahkan variabel berikut ke `.env.local` bila ingin mengaktifkan migrasi ke Outline:

```bash
OUTLINE_API_TOKEN="token_personal_outline"
# (Opsional) Sesuaikan bila menggunakan custom domain Outline
OUTLINE_API_BASE_URL="https://app.getoutline.com"
```

Token dapat diperoleh dari menu **Settings → API Tokens** di Outline. Nama proyek yang dimasukkan pengguna akan digunakan sebagai nama koleksi tujuan.

### Google Speech-to-Text (Audio Transcription)

To enable audio file transcription, configure Google Cloud Speech-to-Text:

1. Create a Google Cloud project and enable the [Speech-to-Text API](https://console.cloud.google.com/apis/library/speech.googleapis.com)
2. Create a service account with Speech-to-Text permissions
3. Download the JSON key file
4. **Create a Google Cloud Storage bucket** for audio uploads (required for files >1MB)
5. Grant the service account **Storage Object Admin** role on the bucket
6. Configure environment variables:

```bash
# Option 1: Path to credentials file
GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"

# Option 2: JSON content directly (useful for deployments)
GOOGLE_CREDENTIALS_JSON='{"type":"service_account","project_id":"...","private_key":"..."}'

# GCS Bucket for audio files (required for files >1MB)
GCS_BUCKET_NAME="your-audio-transcripts-bucket"
# or
GOOGLE_CLOUD_BUCKET="your-audio-transcripts-bucket"
```

**Supported audio formats:** `.wav`, `.mp3`, `.flac`, `.ogg`, `.webm`, `.m4a` (max 100MB)

**Features:**
- Automatic punctuation
- Speaker diarization (identifies different speakers)
- Indonesian (`id-ID`) and English support
- **Smart processing:**
  - Files <500KB: Synchronous transcription (~instant)
  - Files 500KB-1MB: Asynchronous inline transcription
  - Files >1MB: Automatic GCS upload + async transcription (no duration limit!)

**How it works:**
1. Small files (<1MB) are sent directly as base64 content
2. Large files (>1MB) are uploaded to your GCS bucket
3. Google Speech-to-Text processes the file from GCS URI
4. Files are stored in `audio-transcripts/` folder with timestamp prefix

### Audio Transcription Task Management

- View transcription status in real-time (Pending → Processing → Ready/Failed)
- Click "Add to Transcript" to insert completed transcriptions into the text area
- Delete individual completed or failed transcriptions
- **"Clear Logs" button** to remove all completed and failed tasks at once
- Automatic 7-day retention for audio files (configurable via lifecycle policy)

**Setup GCS Retention Policy (7 days):**

```bash
# Run the setup script to configure automatic cleanup
npx ts-node scripts/setup-gcs-retention.ts
```

This will:
- Set lifecycle policy on `audio-transcripts/` folder
- Automatically delete files older than 7 days
- Save storage costs by avoiding unnecessary retention

## 🧱 Teknologi

- [Next.js 15](https://nextjs.org/) + App Router
- Tailwind CSS 4 (dengan preset shadcn/ui)
- AI pipeline via `/api/ai`
- Editor spesifikasi kustom (`components/spec-editor.tsx`)

## 📁 Struktur Penting

- `app/page.tsx` – alur utama input → ringkasan → spesifikasi.
- `components/ui/stepper.tsx` – stepper dengan konektor timelines.
- `public/rembuganai-logo.svg` – logo gelembung percakapan beraksen batik.

## 🤝 Kontribusi

Saran dan issue sangat diterima! Buka pull request atau diskusi bila ingin memperluas fitur RembuganAI.

---

© 2025 RembuganAI. Semua hak cipta dilindungi.