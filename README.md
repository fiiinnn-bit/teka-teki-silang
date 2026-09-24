# Website Teka-Teki Silang (TTS) Bahasa Arab Interaktif

Aplikasi TTS Bahasa Arab interaktif berbasis web tanpa framework, terintegrasi dengan Supabase Backend dan siap di-deploy ke Vercel.

---

## Panduan Langkah demi Langkah

### 1. Membuat Project Supabase
1. Buka [Supabase Dashboard](https://supabase.com/).
2. Klik **New Project**, isi nama project dan database password.
3. Tunggu hingga proses provisi database selesai.

### 2. Membuat Tabel & Menjalankan SQL
1. Buka menu **SQL Editor** pada sidebar kiri Supabase.
2. Klik **New Query**.
3. *Copy-Paste* seluruh isi dari file `supabase.sql`.
4. Klik tombol **RUN**. Seluruh tabel (`profiles`, `puzzles`, `puzzle_attempts`, `puzzle_answers`), RLS Policy, dan Stored Procedure `check_puzzle_answers` akan dibuat otomatis.

### 3. Mengaktifkan Authentication
1. Buka menu **Authentication** -> **Providers**.
2. Pastikan **Email** aktif (Enabled).
3. Matikan opsi *Confirm Email* jika ingin pengguna langsung login setelah daftar tanpa verifikasi email.

### 4. Menyiapkan User Admin
Secara *default*, pengguna yang mendaftar via `register.html` akan memiliki role `student`. Untuk membuat akun Admin:
1. Daftar satu akun melalui form pendaftaran di website.
2. Buka Supabase -> **Table Editor** -> `profiles`.
3. Ubah nilai kolom `role` pada baris pengguna tersebut dari `student` menjadi `admin`.

### 5. Mengambil Supabase URL & Anon Key
1. Buka **Project Settings** -> **API**.
2. Salin **Project URL** dan **anon public key**.
3. Buka file `js/supabase.js`, lalu ganti nilai variabel `SUPABASE_URL` dan `SUPABASE_ANON_KEY`.

---

## Konfigurasi Supabase Auth Redirect untuk Vercel

Agar sesi login/logout berjalan normal pada domain Vercel Anda:
1. Buka Supabase -> **Authentication** -> **URL Configuration**.
2. Di bagian **Site URL**, masukkan URL Vercel Anda (contoh: `https://tts-bahasa-arab.vercel.app`).
3. Di bagian **Redirect URLs**, tambahkan:
   - `https://tts-bahasa-arab.vercel.app/**`
   - `http://localhost:3000/**` (untuk pengujian lokal)

---

## Deploy ke Vercel via GitHub

1. **Upload ke GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial Commit TTS Bahasa Arab"
   git branch -M main
   git remote add origin [https://github.com/USERNAME/REPO-NAME.git](https://github.com/USERNAME/REPO-NAME.git)
   git push -u origin main