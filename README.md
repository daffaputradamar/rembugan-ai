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