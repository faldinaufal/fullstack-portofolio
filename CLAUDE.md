# Full-Stack Portfolio

Repo portfolio publis milik freelancer Upwork (frontend developer React/Next.js yang sedang beralih ke full-stack). Klien Upwork akan membaca repo ini.

## Aturan
- Jawab user dalam **Bahasa Indonesia**. Kode, komentar, commit, dan README ditulis dalam **bahasa Inggris** (untuk klien).
- Semua proyek dibangun **dari nol dengan data fiktif**. Jangan pernah memasukkan kode, screenshot, nama, atau data dari tempat kerja user atau klien-kliennya.
- User sedang **belajar backend**: jelaskan keputusan backend secara singkat saat menulis kode (kenapa struktur/library ini), dan jangan klaim kemampuan yang belum dibuktikan di README.
- Folder utama hanya `docs/`, `Frontend/`, dan `Backend/` (+ file di root seperti README). Satu subfolder per proyek di masing-masing.
- **Dokumentasi dulu**: tiap proyek punya `docs/<proyek>/PRD.md` (apa & kenapa) dan `FSD.md` (role, layar, alur, skema data, API, aturan bisnis). Tulis/setujui PRD → FSD sebelum coding. Jika implementasi mengubah keputusan, perbarui FSD di commit yang sama.
- Jangan commit secret. Pakai `.env.example`.
- Lisensi: PolyForm Noncommercial 1.0.0 (`LICENSE.md`). Tiap file sumber diawali header SPDX + copyright; dicek `pnpm headers:check` (CI) dan ditambahkan otomatis oleh pre-commit hook / `pnpm headers:fix`.

## Proyek
| # | Proyek | Frontend | Backend |
|---|---|---|---|
| 1 | Booking & Invoicing SaaS: auth & role, booking, invoice, dashboard grafik (dibuat sendiri tanpa library chart), Stripe test mode | `Frontend/booking-saas` (Next.js, TS, Tailwind) | `Backend/booking-api` (Node.js + TS, Express/Fastify, PostgreSQL, Prisma, Docker) |
| 2 | Company Website: landing, layanan, blog, form kontak, admin konten, animasi | `Frontend/company-website` (Next.js, TS, Tailwind, Framer Motion; target Lighthouse 95+) | `Backend/company-website-supabase` (Supabase: migrations, RLS, Storage, Edge Functions) |
| 3 | AI Document Chat (RAG): unggah dokumen, jawaban streaming + sumber, riwayat chat, auto-scroll | `Frontend/ai-chat` (Next.js, TS, Tailwind) | `Backend/ai-chat-api` (Python FastAPI, PostgreSQL + pgvector) |

Urutan pengerjaan: 1 → 2 → 3. Tiap proyek harus berakhir dengan **link live** + screenshot (desktop/mobile, light/dark) di README-nya.

## Sinkron ke upwork-assistant
Status proyek juga dicatat di repo `faldinaufal/upwork-assistant`, file `portfolio/status.md` (dibaca oleh pengecekan lowongan harian). Saat proyek berubah status (Rencana → Dikerjakan → Live) atau dapat link live, ingatkan user untuk memperbaruinya di sana, atau perbarui langsung jika repo itu tersedia di sesi.
