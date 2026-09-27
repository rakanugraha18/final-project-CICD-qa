import {
  test,
  expect,
  request as playwrightRequest,
  APIRequestContext,
} from "@playwright/test";
declare const require: any;
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
});
