# Final Assignment - QA Automation API Testing (Script Labs)

Repository ini berisi implementasi **API Test Automation** untuk endpoint `/api/labs` pada **Script Labs** menggunakan **Playwright** dengan **TypeScript**, lengkap dengan **CI/CD pipeline** menggunakan **GitHub Actions**.

Proyek ini dibuat untuk memenuhi Final Assignment _Intensive QA Manual Testing Batch #3_ yang mencakup: CRUD API testing, alur autentikasi token (JWT), test assertion, data-driven testing dengan CSV, serta CI/CD integration dengan GitHub Actions sebagai pipeline otomatis.

---

## 📋 Daftar Isi

- [🚀 Fitur Utama](#-fitur-utama)
- [🧪 Skenario Pengujian](#-skenario-pengujian)
  - [Autentikasi (Register & Login)](#1-autentikasi-register--login)
  - [POST /api/labs](#2-post-apilabs)
  - [GET /api/labs/{id}](#3-get-apilabsid)
  - [PUT /api/labs/{id}](#4-put-apilabsid)
  - [DELETE /api/labs/{id}](#5-delete-apilabsid)
  - [Data-Driven Testing (CSV)](#6-data-driven-testing-csv)
- [📁 Struktur Folder](#-struktur-folder)
- [🛠 Teknologi & Tools](#-teknologi--tools)
- [⚙️ Prasyarat](#-prasyarat)
- [📦 Instalasi](#-instalasi)
- [▶️ Cara Menjalankan Test](#️-cara-menjalankan-test)
- [🔄 CI/CD Pipeline (GitHub Actions)](#-cicd-pipeline-github-actions)
- [🚧 Gatekeeper Pipeline](#-gatekeeper-pipeline)
- [🧩 Troubleshooting](#-troubleshooting)
- [👤 Author](#-author)

---

## 🚀 Fitur Utama

| Fitur                       | Implementasi                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------- |
| **CRUD API Testing**        | GET, POST, PUT, DELETE lengkap dengan positive & negative case                                          |
| **Token Handling Otomatis** | Register → Login → JWT disimpan ke variabel, dipakai semua request (`beforeAll`) — tanpa hardcode token |
| **Test Assertion**          | Setiap request memvalidasi status code + isi response body                                              |
| **Data-Driven Testing**     | 3 skenario (valid, invalid, edge case) dari file `data/labs.csv`                                        |
| **CI/CD Integration**       | GitHub Actions berjalan otomatis setiap push & pull request ke `main`                                   |
| **Gatekeeper**              | Pipeline memblokir kode yang membuat test gagal (terbukti via skenario gagal disengaja)                 |

---

## 🧪 Skenario Pengujian

Semua test berjalan **secara berurutan** (`test.describe.serial`) karena ada ketergantungan antar test: lab harus dibuat (POST) dulu → diambil (GET) → diupdate (PUT) → dihapus (DELETE). Seluruh test menggunakan token JWT yang diperoleh otomatis dari proses login.

### 1. Autentikasi (Register & Login)

Hook `beforeAll` melakukan:

1. **Register** user baru ke `/api/auth/register` — email unik berbasis timestamp agar tidak bentrok saat test dijalankan berulang.
2. **Login** ke `/api/auth/login` untuk mendapatkan JWT token.
3. Token disimpan ke variabel `authToken` dan dipakai di **semua** request `/api/labs` via header `Authorization: Bearer <token>`.

### 2. POST /api/labs

| Skenario                       | Expected                                      |
| ------------------------------ | --------------------------------------------- |
| ✅ Positive — membuat lab baru | `200`/`201`, ID terbuat, title sesuai payload |
| ❌ Negative — title kosong     | `400`/`422`                                   |
| ❌ Negative — tanpa token      | `401`                                         |

### 3. GET /api/labs/{id}

| Skenario                                   | Expected                        |
| ------------------------------------------ | ------------------------------- |
| ✅ Positive — ambil detail lab by ID valid | `200`, ID response = ID request |
| ❌ Negative — ID tidak ada / invalid       | `404`/`400`                     |

### 4. PUT /api/labs/{id}

| Skenario                                 | Expected                            |
| ---------------------------------------- | ----------------------------------- |
| ✅ Positive — update title & description | `200`, title berubah sesuai payload |
| ❌ Negative — update ID yang tidak ada   | `404`/`400`                         |

### 5. DELETE /api/labs/{id}

| Skenario                                    | Expected                                                        |
| ------------------------------------------- | --------------------------------------------------------------- |
| ❌ Negative — delete tanpa token            | `401`                                                           |
| ✅ Positive — delete lab by ID valid        | `200`/`204`, lalu verifikasi GET → `404` (benar-benar terhapus) |
| ❌ Negative — delete lab yang sudah dihapus | `404`/`400`                                                     |

### 6. Data-Driven Testing (CSV)

Test dijalankan berulang (iterasi) berdasarkan baris pada `data/labs.csv`:

| title           | description                       | expected_status | Kategori  |
| --------------- | --------------------------------- | --------------- | --------- |
| `CSV Valid Lab` | `Data dari CSV - skenario valid`  | `201`           | Valid     |
| _(kosong)_      | `Title kosong - skenario invalid` | `400`           | Invalid   |
| `Edge`          | `x`                               | `201`           | Edge case |

Setiap baris CSV menjadi 1 test case tersendiri yang mengirim POST `/api/labs` dan memvalidasi status code sesuai kolom `expected_status`.

---

## 📁 Struktur Folder

```text
final-project-CICD-qa/
│
├── .github/
│   └── workflows/
│       └── playwright.yml        # Workflow CI/CD (GitHub Actions)
│
├── data/
│   └── labs.csv                  # Data skenario data-driven testing
│
├── tests/
│   └── api/
│       └── labs-crud.spec.ts     # Test suite: auth + CRUD + CSV + gatekeeper
│
├── playwright.config.ts          # Konfigurasi global Playwright
├── package.json                  # Dependencies project
├── .gitignore                    # Mengabaikan node_modules, report, test-user.json
├── test-user.json                # Data user dinamis hasil register API
└── README.md                     # Dokumentasi ini
```

---

## 🛠 Teknologi & Tools

| Tool                | Penggunaan                                    |
| ------------------- | --------------------------------------------- |
| **Playwright Test** | Framework API testing                         |
| **TypeScript**      | Bahasa pemrograman                            |
| **csv-parse**       | Parser CSV untuk data-driven testing          |
| **Node.js (fs)**    | Membaca file CSV & menyimpan `test-user.json` |
| **GitHub Actions**  | CI/CD pipeline                                |
| **Ubuntu Runner**   | Environment eksekusi pipeline                 |

---

## ⚙️ Prasyarat

- Node.js `18.x` atau lebih baru
- NPM `9.x` atau lebih baru
- Koneksi internet (mengakses API `https://api-script-labs.hendri.me`)

---

## 📦 Instalasi

```bash
# 1. Clone repository
git clone https://github.com/rakanugraha18/final-project-CICD-qa.git
cd final-project-CICD-qa

# 2. Install dependencies
npm install

# 3. Install khusus untuk data-driven testing (CSV)
npm install csv-parse

# 4. Install browser Playwright
npx playwright install
```

---

## ▶️ Cara Menjalankan Test

```bash
# Jalankan seluruh test API
npx playwright test tests/api

# Jalankan test tertentu saja (misal data-driven CSV)
npx playwright test -g "CSV"

# Lihat hasil dalam format HTML report
npx playwright show-report
```

> Setelah test dijalankan, file `test-user.json` dibuat otomatis berisi kredensial & token user tester. File ini sudah masuk `.gitignore` sehingga **tidak ikut ter-commit** ke repository.

---

## 🔄 CI/CD Pipeline (GitHub Actions)

Workflow: `.github/workflows/playwright.yml`

Pipeline berjalan **otomatis** pada event:

- `push` ke branch `main`
- `pull_request` ke branch `main`

Urutan step di pipeline:

```text
checkout code → setup Node.js 20 → npm install → install Playwright
→ npx playwright test tests/api → ✅ hijau / ❌ merah
```

---

## 🚧 Gatekeeper Pipeline

Pipeline ini berfungsi sebagai **gatekeeper** — kode yang membuat test gagal tidak bisa lolos dengan status hijau. Buktinya terlihat dari history Actions:

1. Commit _"Tambah pengujian gagal di sengaja sebagai bukti gatekeeper"_ → pipeline **❌ merah** (test sengaja dibuat gagal).
2. Commit _"Perbaiki skenario pengujian gagal untuk gatekeeper sebelumnya, pipeline kembali hijau"_ → pipeline **✅ hijau** (test diperbaiki).

Lihat buktinya di tab **Actions** repository ini.

---

## 🧩 Troubleshooting

| Masalah                                 | Solusi                                                     |
| --------------------------------------- | ---------------------------------------------------------- |
| Error `Cannot find module 'csv-parse'`  | Jalankan `npm install csv-parse`                           |
| Test gagal karena email sudah terdaftar | Sudah ditangani otomatis — email dibuat unik via timestamp |
| Browser belum terinstall                | Jalankan `npx playwright install`                          |
| Test butuh token manual                 | Tidak perlu — `beforeAll` register & login otomatis        |

---

## 👤 Author

**Raka Nugraha** — Intensive QA Manual Testing Batch #3 (AfterOffice)
