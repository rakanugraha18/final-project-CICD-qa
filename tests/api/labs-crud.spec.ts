import {
  test,
  expect,
  request as playwrightRequest,
  APIRequestContext,
} from "@playwright/test";
declare const require: any;
const { parse } = require("csv-parse/sync");
const fs = require("fs");

// Eksekusi Berurutan
// - Pengujian CRUD memiliki ketergantungan urutan (dependency): data harus dibuat terlebih dahulu (POST), diambil detailnya (GET), diperbarui (PUT), lalu dihapus (DELETE).
// - Secara default, Playwright menjalankan test secara paralel. Penggunaan .serial memaksa semua test case di dalam blok berjalan satu per satu sesuai urutan dari atas ke bawah.
test.describe.serial("API Automation Testing - /api/labs", () => {
  // State Management & Dinamisasi Data
  // Variabel penampung di level suite
  let apiContext: APIRequestContext; //Menyimpan konfigurasi network client Playwright agar bisa dipakai bersama.
  let authToken: string; // Menyimpan token autentikasi yang diperoleh dari proses login
  let createdLabId: string | number; // Menyimpan ID lab yang terbentuk saat test POST berhasil, sehingga ID tersebut langsung diteruskan ke test GET, PUT, dan DELETE tanpa perlu di hardcode.

  const timestamp = Date.now(); //Digunakan pada email saat registrasi (tester_17...) untuk mencegah kegagalan test akibat duplicate key / email sudah terdaftar ketika script dijalankan berkali-kali.
  const testUser = {
    email: `tester_${timestamp}@example.com`,
    password: "Password123!",
  };

  // ==========================================
  // Autentikasi Otomatis (beforeAll) >> Lifecycle Hook Otomatis (beforeAll & afterAll))
  // ==========================================
  test.beforeAll(async ({ playwright }) => {
    // Inisialisasi request context tersendiri
    //Membuat instance request.newContext() dengan base URL dan header default JSON.
    apiContext = await playwright.request.newContext({
      baseURL: "https://api-script-labs.hendri.me",
      extraHTTPHeaders: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    // 1. Registrasi user baru >> Mengirim request registrasi akun baru ke /api/auth/register berdasarkan data testUser yang sudah dibuat di atas. Jika registrasi berhasil, maka akun baru akan dibuat di database.
    const regRes = await apiContext.post("/api/auth/register", {
      data: testUser,
    });
    expect([200, 201]).toContain(regRes.status()); // Expected registrasi berhasil (200 OK atau 201 Created)

    // 2. Login untuk mengambil JWT Token >> Langsung melakukan login ke /api/auth/login menggunakan kredensial yang baru dibuat.
    const loginRes = await apiContext.post("/api/auth/login", {
      data: {
        email: testUser.email,
        password: testUser.password,
      },
    });
    expect(loginRes.status()).toBe(200); // Expected login berhasil (200 OK)

    //Mengambil token dari response JSON (loginData.token) dan menyimpannya ke variabel authToken.
    const loginData = await loginRes.json();
    authToken =
      loginData.token || loginData.access_token || loginData?.data?.token;
    expect(authToken).toBeTruthy(); // Expected token tidak kosong/null/undefined

    // 3. Simpan ke test-user.json setelah akun terbukti valid dan berhasil login
    fs.writeFileSync(
      "test-user.json",
      JSON.stringify(
        {
          email: testUser.email,
          password: testUser.password,
          token: authToken,
        },
        null,
        2,
      ),
    );
  });

  test.afterAll(async () => {
    await apiContext.dispose();
  });

  test("[Auth] Token berhasil didapatkan dari login", async () => {
    expect(authToken).toBeTruthy();
  });

  // ==========================================
  // 1. POST METHOD (/api/labs)
  // ==========================================
  test.describe("POST /api/labs", () => {
    //Positive: Mengirim data lab baru dengan header Authorization: Bearer <token>. Memvalidasi status code 201/200, memastikan ID terbuat, lalu menyimpannya ke createdLabId.
    test("[Positive] Berhasil membuat lab baru", async () => {
      const payload = {
        title: `Automation Test Lab ${timestamp}`,
        description: "Lab created by automated test suite",
      };

      const response = await apiContext.post("/api/labs", {
        headers: { Authorization: `Bearer ${authToken}` },
        data: payload,
      });

      expect([200, 201]).toContain(response.status()); //Expected status code 200 OK atau 201 Created
      const body = await response.json();

      createdLabId = body.id || body.data?.id || body._id;
      expect(createdLabId).toBeDefined(); // Expected ID lab baru tidak kosong/null/undefined

      const createdTitle = body.title || body.data?.title;
      expect(createdTitle).toBe(payload.title); // Expected title pada respons sama dengan title yang dikirim
    });

    //Negative (Validation Error): Menguji skenario gagal membuat lab jika title kosong, dan memverifikasi bahwa server mengembalikan status code 400/422.
    test("[Negative] Gagal membuat lab jika title kosong (Validation Error 400)", async () => {
      const invalidPayload = {
        title: "", // Title kosong
        description: "Missing title test",
      };

      const response = await apiContext.post("/api/labs", {
        headers: { Authorization: `Bearer ${authToken}` },
        data: invalidPayload,
      });

      // Validasi status code error
      expect([400, 422]).toContain(response.status()); //Expected status code 400 Bad Request atau 422 Unprocessable Entity
    });

    //Negative (Unauthorized): Menguji skenario gagal membuat lab tanpa menyertakan Authorization Token, dan memverifikasi bahwa server mengembalikan status code 401 Unauthorized.
    test("[Negative] Gagal membuat lab tanpa Authorization Token (401 Unauthorized)", async () => {
      const response = await apiContext.post("/api/labs", {
        data: {
          title: "Unauthorized Test Lab",
          description: "Should fail with 401",
        },
      });

      expect(response.status()).toBe(401); //Expected status code 401 Unauthorized
    });
  });

  // ==========================================
  // 2. GET METHOD (/api/labs & /api/labs/{id})
  // ==========================================
  test.describe("GET /api/labs", () => {
    //Positive: Memanggil endpoint detail dengan ID yang valid (createdLabId) dan token. Memvalidasi status code 200 dan mencocokkan ID respons dengan ID yang diminta.
    test("[Positive] Berhasil mengambil detail lab berdasarkan ID yang valid", async () => {
      const response = await apiContext.get(`/api/labs/${createdLabId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.status()).toBe(200); //Expected status code 200 OK
      const body = await response.json();
      const labId = body.id || body.data?.id || body._id;
      expect(String(labId)).toBe(String(createdLabId)); //Expected ID pada respons sama dengan ID yang diminta
    });

    //Memanggil endpoint dengan ID acak/tidak valid (99999999-invalid-id). Memvalidasi bahwa sistem mengembalikan error 404 Not Found (atau 400 Bad Request).
    test("[Negative] Gagal mengambil lab dengan ID yang tidak ada / invalid (404 Not Found)", async () => {
      const invalidLabId = "99999999-invalid-id";

      const response = await apiContext.get(`/api/labs/${invalidLabId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect([404, 400]).toContain(response.status()); //Expected status code 404 Not Found atau 400 Bad Request
    });
  });

  // ==========================================
  // 3. PUT METHOD (/api/labs/{id}) >> Update
  // ==========================================

  //Positive: Mengirim payload perubahan data pada createdLabId. Memvalidasi status code 200 dan memastikan data title pada respons sudah berubah sesuai data baru.
  test.describe("PUT /api/labs/{id}", () => {
    test("[Positive] Berhasil mengupdate data lab", async () => {
      const updatePayload = {
        title: `Updated Lab Title ${timestamp}`,
        description: "Updated lab description",
      };

      const response = await apiContext.put(`/api/labs/${createdLabId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
        data: updatePayload,
      });

      expect(response.status()).toBe(200); //Expected status code 200 OK
      const body = await response.json();
      const updatedTitle = body.title || body.data?.title;
      expect(updatedTitle).toBe(updatePayload.title); //Expected title pada respons sama dengan title yang dikirim untuk update
    });

    //Negative: Mencoba memperbarui lab dengan ID yang tidak terdaftar di database. Memvalidasi respons penolakan dari server (404 / 400).
    test("[Negative] Gagal update jika ID tidak ditemukan (404 Not Found)", async () => {
      const nonExistentId = "99999999-invalid-id";

      const response = await apiContext.put(`/api/labs/${nonExistentId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
        data: {
          title: "Update non existent",
          description: "Should return 404",
        },
      });

      expect([404, 400]).toContain(response.status()); //Expected status code 404 Not Found atau 400 Bad Request
    });
  });

  // ==========================================
  // 4. DELETE METHOD (/api/labs/{id})
  // ==========================================

  //Negative (Unauthorized): Mencoba menghapus resource tanpa menyertakan header token. Memvalidasi server memblokir aksi dengan respons 401 Unauthorized.
  test.describe("DELETE /api/labs/{id}", () => {
    test("[Negative] Gagal delete lab tanpa Token / Unauthorized (401)", async () => {
      const response = await apiContext.delete(`/api/labs/${createdLabId}`);
      expect(response.status()).toBe(401); //Expected status code 401 Unauthorized
    });

    //Positive: Menghapus resource menggunakan ID yang valid dan token yang sah. Memvalidasi status penghapusan (200 atau 204 No Content). Diikuti verifikasi lanjutan: melakukan GET kembali ke ID tersebut untuk memastikan data benar-benar sudah berstatus 404 Not Found.
    test("[Positive] Berhasil menghapus lab berdasarkan ID", async () => {
      const response = await apiContext.delete(`/api/labs/${createdLabId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect([200, 204]).toContain(response.status()); //Expected status code 200 OK atau 204 No Content

      // Verifikasi item benar-benar sudah hilang
      const verifyResponse = await apiContext.get(`/api/labs/${createdLabId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      expect([404, 400]).toContain(verifyResponse.status()); //Expected status code 404 Not Found atau 400 Bad Request
    });

    //Negative (Not Found): Mencoba menghapus kembali ID yang barusan sudah sukses dihapus. Memvalidasi bahwa server menolak karena resource sudah tidak ada (404 / 400).
    test("[Negative] Gagal delete lab yang sudah dihapus / tidak ada (404 Not Found)", async () => {
      const response = await apiContext.delete(`/api/labs/${createdLabId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect([404, 400]).toContain(response.status()); //Expected status code 404 Not Found atau 400 Bad Request
    });
  });

  // ==========================================
  // 5. DATA-DRIVEN TESTING (CSV)
  // ==========================================
  test.describe("Data-Driven dari CSV", () => {
    const csvPath = "data/labs.csv";
    const csvData = parse(fs.readFileSync(csvPath, "utf-8"), {
      columns: true,
      skip_empty_lines: true,
    });

    for (const row of csvData) {
      test(`[CSV] title="${row.title || "(kosong)"}" → expect ${row.expected_status}`, async () => {
        const response = await apiContext.post("/api/labs", {
          headers: { Authorization: `Bearer ${authToken}` },
          data: { title: row.title, description: row.description },
        });
        expect(response.status()).toBe(Number(row.expected_status));
      });
    }
  });

  // ==========================================
  // BUKTI GATEKEEPER / SKENARIO GAGAL SENGAJA
  // ==========================================
  test("[Gatekeeper] Sengaja gagal untuk membuktikan pipeline CI aktif", async () => {
    const response = await apiContext.post("/api/labs", {
      headers: { Authorization: `Bearer ${authToken}` },
      data: {
        title: "", // Title kosong
        description: "Test gatekeeper",
      },
    });

    // Server aslinya mengembalikan status 400 atau 422 untuk title kosong.
    // Kita sengaja pasang expect(200) agar tes ini PASTI GAGAL (Merah) untuk bukti Gatekeeper.
    expect(response.status()).toBe(200);
  });
});
