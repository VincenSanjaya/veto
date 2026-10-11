# Audit kesiapan submission Veto — Crypto World’s Fair

Tanggal: 11 Oktober 2026. Basis repository: `55357aa` (`Add a logo`). Audit membaca source terbaru dan menjalankan pemeriksaan baru; laporan graph/audit lama serta jumlah tes sebelumnya tidak dijadikan bukti kelulusan.

## Kesimpulan

**Veto layak dipresentasikan sebagai prototipe Base Sepolia dengan Demo yang berfungsi. Kesiapan submission masih bersyarat.** R1 dan R2 telah diperbaiki berdasarkan reproduksi source terbaru: status receipt/verification terpisah dan manual check tidak dibatalkan oleh update pasangan lain. Diferensiasi produk, bukti kebutuhan pengguna, dan kelengkapan materi submission belum kuat atau belum terverifikasi.

Desain hijau, logo, liquid-glass landing, shader, animasi masuk/scroll dan reduced motion dipertahankan; file desain tidak diubah. Tahap lanjutan mengubah enam file source terkait R1/R2 dan dua file tes, serta laporan ini. Tidak ada perubahan dependencies/config deployment, signing/transaksi nyata oleh auditor, commit, push atau deploy.

Hasil verifikasi R1/R2: **focused suite 35/35 dan suite penuh 48/48 lulus; typecheck dan production build lulus.** AUDIT-M1/M2 lulus tanpa skip, expected failure atau pelonggaran assertion. Lint tidak tersedia. Audit awal menemukan 0 advisory; pemeriksaan registry itu tidak diulang pada patch ini karena dependencies tidak berubah. Hasil gagal audit awal disimpan sebagai bukti historis di bawah.

## Kondisi repository dan metode

- `AGENTS.md` tidak ditemukan di root maupun direktori ancestor yang diperiksa. Instruksi AGENTS dari percakapan tetap dipakai, termasuk Context7 untuk dokumentasi library/cloud.
- Dibaca: README, package.json/lockfile, git status/history, seluruh struktur `src/`, konfigurasi Vite/TypeScript/Playwright/Vercel, implementasi Demo/Live, serta tes terkait.
- Status awal: `?? brag-output/` dan `?? graphify-out/`. Tidak ada perubahan tracked atau staged. Kedua direktori lokal tersebut tidak ditimpa atau dimasukkan dalam bukti submission.
- Pada tahap audit awal source tracked identik dengan HEAD. Tahap implementasi R1/R2 mengubah enam file source dan `tests/live-write.spec.ts`; laporan serta `tests/hackathon-audit.spec.ts` tetap untracked. `brag-output/` dan `graphify-out/` tidak ditimpa.
- Lingkungan: Node `v23.7.0`, npm `10.9.2`, Chrome terpasang. Ini berbeda dari Node `22.x` yang direkomendasikan README untuk Vercel; build di Node 22/Vercel belum dilakukan.
- Pemeriksaan menggunakan skill investigate-first, verify-and-stop, playwright-cli dan Context7. Browser dijalankan melalui API Playwright lokal karena paket dan Chrome sudah tersedia.
- Laporan graph yang sudah ada tidak digunakan untuk membuktikan perilaku atau menghitung tes.

## Implementasi dan verifikasi lanjutan R1/R2

Source dibaca ulang sebelum perubahan. Command `PLAYWRIGHT_CHANNEL=chrome npm run test:browser -- tests/hackathon-audit.spec.ts` pada baseline kembali menghasilkan **1 lulus, 2 gagal, exit 1**: AUDIT-M1 mendeteksi phase failed setelah receipt sukses; AUDIT-M2 mendeteksi hilangnya pasangan A. Deskripsi laporan tidak dijadikan satu-satunya dasar patch. Skill surgical-patch dipakai untuk perubahan terbatas dan regression proof.

### Perubahan R1

- `src/lib/allowanceWrites.ts:68`: record transaksi memiliki `verification` terpisah dari status receipt. Receipt sukses tetap `confirmed`; read allowance/balance yang gagal menghasilkan `unavailable`, bukan transaksi failed. `pending`, `matched`, dan `mismatch` menyatakan hasil verifikasi, bukan outcome jaringan.
- `src/lib/allowanceWrites.ts:495`: requested dibandingkan dengan actual pada receipt block. Revoke actual nonzero menyatakan permission belum dihapus; reset nonzero tidak membuka Continue. Decimals reset yang berubah/tidak tersedia memakai reset-blocked. Zero terverifikasi tetap memerlukan klik Continue eksplisit; tidak ada submit otomatis.
- `src/components/AllowanceChangeDialog.tsx:96` dan `src/components/LiveActivity.tsx`: requested dan actual ditampilkan terpisah dengan unit/decimals; actual yang belum terbaca dinyatakan belum terverifikasi. Badge menyatakan **Transaction confirmed / Verification unavailable** atau mismatch/matched. Target finite akhir dibedakan dari requested zero transaksi reset.
- `src/lib/allowanceWrites.ts:573`: Refresh verification hanya menjalankan read untuk hash/receipt yang sudah ada; tidak simulation, signing, submit ulang atau membuat hash baru. `transactionId` menghubungkan dialog dengan transaksi tepat, termasuk recovery reset/set.
- Unknown dengan hash menyediakan Check receipt untuk observation; tanpa hash tidak menyediakan tombol itu. Lock tetap konservatif. `src/hooks/useAllowanceWrites.ts:41` dan `src/components/WalletUI.tsx:241` mengekspos akun/jaringan asal blocker lintas akun serta hash bila ada.
- Dialog dan panel wallet menjelaskan history/guard hanya dalam sesi dan dapat hilang saat reload/keluar dashboard. Ini disclosure, **bukan recovery tahan reload**. Validasi wallet/account/chain, duplicate lock, current read sebelum simulation, reject handling dan reset-to-zero dipertahankan.

### Perubahan R2

- `src/lib/liveAllowances.ts:217`: menerima hasil B tidak menaikkan generation scope atau menyelesaikan pending A. Manual result digabung melalui `accept()` dan aturan block-order yang sama.
- `setScope()` tetap menginvalidasi request ketika disconnect atau akun/jaringan berubah, termasuk A → B → A. Hasil block lama untuk pasangan sama tidak menimpa snapshot lebih baru; refresh mengganti satu row dengan key sama sehingga summary tidak menggandakan pasangan.
- Pending manual check tetap satu per sesi sesuai perilaku sebelumnya. Coverage konkurensi menguji read manual A bersama hasil B, bukan menjanjikan beberapa form manual check paralel.

### Perintah akhir dan bukti

| Perintah | Hasil | Cakupan |
| --- | --- | --- |
| `PLAYWRIGHT_CHANNEL=chrome npm run test:browser -- tests/hackathon-audit.spec.ts tests/allowance-writes.spec.ts tests/allowances.spec.ts tests/approval-scan.spec.ts tests/live-write.spec.ts` | 35/35 lulus, 8,6 detik, exit 0 | Domain writes/reads/scanner dan browser live mock; M1/M2 tidak skip/expected failure dan assertion asli tetap ada. |
| `PLAYWRIGHT_CHANNEL=chrome npm run test:browser` | 48/48 lulus, 16,6 detik, exit 0 | Seluruh suite, termasuk landing/motion, Demo, wallet/session races, scan, dialog dan Activity. |
| `npm run typecheck` | Exit 0 | Source dan TypeScript tests. |
| `npm run build` | Exit 0; 3.318 modul, Vite 2,54 detik | CSS 48,50 kB; entry JS 254,86 kB; DashboardRoot 426,86 kB (gzip 126,14). |
| `git diff --check` | Exit 0 | Tidak ada whitespace error. |
| Lint | Tidak tersedia | Tidak ada script/config lint; tidak diklaim lulus. |

Focused dan full suite diulang setelah perbaikan posisi screenshot; hasil akhir tetap dicatat berdasarkan eksekusi tersebut. Log: `/tmp/veto-r1-r2-focused-final.log`, `/tmp/veto-suite-final.log`; artifacts browser: `test-results/` (ignored dan dapat ditimpa test run berikutnya).

Regression coverage baru: mismatch revoke/finite/reset; unavailable → read-only recovery dengan counters prepare/submit/receipt, wallet calls serta hash tetap; hashless unknown lock lintas akun; timeout unknown dengan hash → Check receipt tanpa resubmit; hasil B saat A pending; stale manual A tidak mengganti verification A block lebih baru; row unik setelah refresh. Tes scope disconnect/account/network dan A → B → A yang sudah ada tetap lulus. Satu assertion UI lama berubah dari label `Verified allowance` ke `Actual allowance`, sesuai copy baru; assertion perilaku AUDIT-M1/M2 tidak dilonggarkan.

Browser Chrome lokal memakai adapter viem/wagmi aktual dengan wallet dan RPC **mock**, pada desktop 1440×900 dan mobile emulation 320×740. Dialog unavailable, explicit Continue setelah zero, Activity requested/actual/mismatch, tombol recovery dan reachability diuji. Screenshot diperiksa; desain hijau tetap ada. Clock mock mempercepat timeout receipt untuk menguji unknown dengan hash. Kegagalan sementara selama penyusunan tes berasal dari setup Show revoked yang remount, pemasangan clock setelah timer dibuat dan route mock block belum lengkap; diperbaiki pada fixture tanpa melemahkan assertion. Tidak ada RPC nyata/signing baru pada tahap patch ini.

### Risiko tersisa dan langkah manual

H1 tetap terbuka: history/lock tidak persisten. Unknown tanpa hash tetap memerlukan inspeksi wallet/explorer asal dan tidak bisa dipulihkan otomatis dalam aplikasi. Verification menggabungkan allowance dan balance, sehingga kegagalan salah satu tetap unavailable. Snapshot receipt block bukan janji allowance tidak akan berubah kemudian. Dukungan approve false/no-return/custom token tetap terbatas seperti audit awal; mismatch diperjelas, bukan perluasan kompatibilitas.

Sebelum presentasi, tim perlu memeriksa build pada Node 22 dan URL deployment yang sudah ada, refresh `/app`, wallet extension/perangkat sasaran, serta kelengkapan form/video/reviewer access. Tinjau bukti transaksi testnet nyata yang sebelumnya dilakukan pengguna secara terpisah; jika tim kemudian memilih uji manual tambahan, konfirmasi reject, reset → stop/Continue dan account/network change dengan wallet sasaran. Audit ini tidak mengirim transaksi atau mengotorisasi signing tambahan.

R1/R2 siap ditinjau untuk submission prototipe Base Sepolia. Kesiapan materi submission/demand tetap bersyarat; tidak ada klaim siap produksi atau recovery tahan reload.

## Arsitektur aktual

Veto adalah SPA React/TypeScript/Vite tanpa backend atau kontrak sendiri. `/` merender `Landing`; `/app` dan `/app/` lazy-load `DashboardRoot`. Provider wagmi dan TanStack Query hanya berada di dashboard (`src/main.tsx:7`, `src/DashboardRoot.tsx:7`).

`App` mengelola mode Demo/Live, Overview/Activity, modal, filter, dan sampel (`src/App.tsx:125`). Demo menyimpan allowance dan activity di state React, terpisah dari data onchain. Koneksi wallet secara eksplisit mengaktifkan Live; Return to demo memutus koneksi dan mempertahankan sampel lokal sebelumnya.

Lapisan domain menggunakan dependency injection dan `useSyncExternalStore`: `AllowanceSession` menyimpan pasangan terverifikasi, `ApprovalScan` menemukan spender, dan `AllowanceWrites` mengendalikan transaksi. Adapter viem mengakses RPC publik; wallet injected hanya menjadi pengirim transaksi. `liveWriteStore` adalah singleton dalam memori, bertahan pada navigasi Overview/Activity tetapi hilang saat reload penuh.

## Hasil pengujian audit awal — historis, sebelum R1/R2

| Perintah | Hasil aktual | Interpretasi |
| --- | --- | --- |
| `npm run test:browser` di sandbox | Exit 1: server gagal bind `127.0.0.1:5174`, `EPERM` | Pembatasan lingkungan; tes belum berjalan. |
| `npm run test:browser` dengan izin localhost | 21 lulus, 17 gagal, exit 1 | Semua 17 gagal karena executable Chromium bawaan tidak tersedia; bukan assertion produk. |
| `PLAYWRIGHT_CHANNEL=chrome npm run test:browser` sebelum tes audit | 38 lulus, 20,4 detik, exit 0 | Suite repository asli, dijalankan ulang pada source saat ini. |
| `PLAYWRIGHT_CHANNEL=chrome npm run test:browser -- tests/hackathon-audit.spec.ts` saat dua tes awal ditambahkan | 2 gagal, exit 1 | Mengonfirmasi M1 dan M2. |
| `PLAYWRIGHT_CHANNEL=chrome npm run test:browser` setelah ketiga tes audit | 39 lulus, 2 gagal, 15,0 detik, exit 1 | 38 tes asli tetap lulus; tes compatibility no-return lulus; M1/M2 tetap gagal. |
| `npm run typecheck` | Exit 0, termasuk file tes baru | TypeScript lulus. |
| `npm run build` | Exit 0 setelah tes audit lengkap; 3.318 modul, build Vite 2,51 detik | Production build lulus. |
| Lint | Tidak dijalankan: tidak ada script/config lint repository | Tidak disebut lulus. |
| `npm audit --json > /tmp/veto-npm-audit.json` | Percobaan sandbox gagal DNS; ulang dengan akses registry: exit 0, 0 info/low/moderate/high/critical | Tidak ada advisory yang dilaporkan registry untuk lockfile saat audit; bukan jaminan keamanan. |
| `npm ls --depth=0` | Exit 0 | Dependency utama terpasang dan konsisten. |
| `npm run preview -- --host 127.0.0.1 --port 5175 --strictPort` | Server production lokal berjalan | Dipakai untuk smoke test tambahan. |
| `node /tmp/veto-audit-browser.cjs` | Exit 0 | Browser production desktop/mobile, tanpa wallet. |
| `node /tmp/veto-audit-live-read.cjs` | Exit 0 | Browser production, wallet sintetis, RPC Base Sepolia nyata, read-only. |
| `curl` POST read-only ke `https://sepolia.base.org` | Chain/head dan pinned ERC-20 reads berhasil; request log 2.000 blok ditolak | Bukti RPC nyata; tidak memakai `eth_sendTransaction` atau signing. |

Output build audit awal: CSS 48,50 kB (gzip 11,10); entry JS 254,86 kB (gzip 79,62); DashboardRoot 423,45 kB (gzip 125,38). Lazy loading memisahkan dashboard dari landing. Ukuran ini bukan hasil pengukuran Core Web Vitals atau jaringan mobile nyata.

Log sementara: `/tmp/veto-suite-chrome.log`, `/tmp/veto-suite-final.log`, `/tmp/veto-audit-regressions.log`, `/tmp/veto-browser-evidence.json`, `/tmp/veto-live-read-evidence.json`, dan `/tmp/veto-npm-audit.json`. Artifact `/tmp` bersifat sementara; laporan dan tes regresi adalah bukti yang disimpan di repository.

## Bukti browser dan batasnya

### Browser production lokal

Chrome headless diuji pada desktop 1440×900 dengan motion normal dan mobile emulation 390×844 dengan reduced motion. Screenshot desktop landing dan mobile dashboard juga diperiksa secara visual.

- Landing terbuka dan animasi selesai; CTA tetap dapat dipakai. Suite asli juga membuktikan Skip animation, satu entrance per session, fallback WebGL, resize canvas, offscreen/hidden-tab pause, dan cleanup saat unmount.
- Launch App, Try Demo, direct `/app`, `/app/`, refresh, Back to Veto, serta Overview/Activity berfungsi pada production preview.
- FAQ dapat difokuskan dan dibuka melalui Enter. Suite asli mencakup keyboard dialog dan mobile reachability.
- Tidak ada document horizontal overflow pada viewport smoke test. Tabel memakai scroll tersendiri.
- Tidak ada `pageerror`, request RPC Base Sepolia, atau isi localStorage selama alur landing/Demo smoke test.
- Demo awal: 6 baris, Unlimited 2, Above balance 4. Setelah revoke Orbit Swap: active 5, unlimited 1, above balance 3, activity 1. Semua konsisten; baris revoked tetap ada pada Demo All, yang memang berbeda dari default Live.
- Edit Demo, precision invalid, revoke, reset Demo, disconnect, explicit chain switch, dan pemisahan Demo/Live juga lulus dalam suite asli.
- `Show revoked` merupakan fitur Live. Search dan filter All/Unlimited/Above adalah fitur Demo; Live saat ini tidak memiliki filter/search setara. Jangan menjual paritas fitur kedua mode.

Ini adalah browser lokal dan mobile emulation, bukan pengujian Safari, iPhone/Android fisik, GPU pengguna, atau extension wallet sungguhan.

### Pembacaan RPC nyata

RPC mengembalikan chain `84532`. Pinned batch pada blok **47.975.489** memverifikasi kode USDC 1.798 byte, `name/symbol = USDC`, `decimals = 6`, balance owner uji **465.080153 USDC**, dan allowance owner ke dirinya **0**. Owner adalah alamat publik fixture; hasil ini bukan saldo pengguna atau bukti kepemilikan tim.

Browser production dengan injected wallet sintetis dan RPC nyata menampilkan pasangan yang sama pada blok **47.975.567**. Scan berikutnya meminta **47.925.569–47.975.568**. Setelah empat penolakan range, berhasil membaca **47.925.569–47.925.693**, yaitu **125/50.000 blok**, lalu dibatalkan. Cancel mempertahankan label cancelled/partial. Retry memulai scan baru dan dapat dibatalkan lagi.

Endpoint nyata memberikan error `-32614`, `eth_getLogs is limited to a 200 range` untuk request 2.000 blok. Implementasi turun 2.000 → 1.000 → 500 → 250 → 125, sehingga berhasil pada percobaan kelima. **Tidak ada full-range scan nyata yang diselesaikan** dan tidak ada spender/event nonzero nyata yang dibuktikan dalam scan parsial ini.

Metode fixture wallet yang tercatat hanya permissions/accounts/chain dan switch chain sintetis. Tidak ada signing atau pengiriman transaksi. Public RPC reads sungguhan tidak boleh disamakan dengan wallet sungguhan.

## Temuan audit awal berdasarkan severity dan status setelah patch

Severity menilai dampak dan kemungkinan pada scope prototipe. Tidak ditemukan bukti eksploit pencurian dana pada kode yang diperiksa; ini bukan audit keamanan formal.

### H1 — Guard transaksi hilang saat reload atau meninggalkan dashboard

**Status setelah R1:** tetap terbuka. Dialog dan panel wallet sekarang memperingatkan session-only secara eksplisit. Warning tidak menyimpan history dan tidak memperbaiki recovery tahan reload.

**Lokasi:** `src/lib/liveWriteStore.ts:68`, `src/lib/allowanceWrites.ts:163`, `src/lib/allowanceWrites.ts:201`, `src/main.tsx:11`.

**Reproduksi:** mulai transaksi melalui fixture dengan receipt tertahan/unknown; full reload atau pergi ke landing; kembali, connect, dan check pasangan. Store baru tidak memiliki hash/history/lock lama. Transaksi yang sudah dikirim tidak dibatalkan oleh reload.

**Bukti:** state hanya dalam memori; probe domain menunjukkan store unknown terblokir sementara instance baru tidak terblokir. README sudah mengakui keterbatasan, tetapi UI konfirmasi belum menyampaikan konsekuensi reload secara jelas. Tidak diuji dengan transaksi nyata.

**Dampak:** pengguna dapat kehilangan konteks transaksi pending lalu mengirim perubahan lain. Severity high untuk model keselamatan jika dipakai dengan aset bernilai; scope testnet membatasi dampak langsung. Sebelum submission, setidaknya tampilkan konsekuensi session-only pada status pending/unknown dan jelaskan pada demo. Pemulihan tahan reload masuk R5, bukan perluasan produksi mendadak.

### M1 — Receipt confirmed dan verification gagal memakai label dialog `failed`

**Status: diperbaiki oleh R1.** Reproduksi di bawah menjelaskan source sebelum patch; lokasi/perilaku terbaru dan bukti lulus tercantum pada bagian verifikasi R1/R2.

**Lokasi:** `src/lib/allowanceWrites.ts:450`, `src/lib/allowanceWrites.ts:534`, `src/components/AllowanceChangeDialog.tsx:158`, `src/components/LiveActivity.tsx:47`.

**Reproduksi:** receipt sukses, lalu RPC allowance/balance pada receipt block gagal. Activity berstatus confirmed tetapi dialog memperlihatkan `failed`. Pengguna harus memahami dua pesan yang tampak bertentangan.

**Bukti:** tes `AUDIT-M1` di `tests/hackathon-audit.spec.ts:18` gagal pada assertion bahwa receipt confirmed tidak boleh mendapat phase failed. Tes yang sama membuktikan lock aktif sampai Refresh verification sukses; recovery menghasilkan zero dan melepas lock tanpa submit ulang.

**Dampak:** pengguna bisa menyangka transaksi gagal, meskipun kontrak sudah berubah. Lock saat ini mencegah retry langsung, tetapi kata status mengaburkan penyebab kegagalan.

**Varian penting:** approve yang simulated `true` tetapi hasil aktual berbeda dari requested mendapat phase `confirmed` (`src/lib/allowanceWrites.ts:520`). Pesan menjelaskan mismatch, tetapi badge belum membedakan receipt sukses dari keberhasilan perubahan izin. Reset dengan actual nonzero sudah memblokir Continue; jangan menghilangkan penjagaan ini.

### M2 — Update pasangan lain membuang manual check yang masih berjalan

**Status: diperbaiki oleh R2.** Reproduksi di bawah adalah baseline sebelum patch; AUDIT-M2 serta stale same-pair kini lulus.

**Lokasi:** `src/lib/liveAllowances.ts:217`, khususnya increment generation di `:228` dan check generation di `:266`; integrasi observer `src/hooks/useManualAllowances.ts:52`.

**Reproduksi:** manual check pasangan A masih menunggu RPC; transaksi pasangan B selesai dan observer menerima verification B; RPC A kemudian selesai. A tidak masuk hasil, pending ikut selesai, dan pesan terakhir berasal dari B.

**Bukti:** `AUDIT-M2` di `tests/hackathon-audit.spec.ts:40` gagal: hasil hanya berisi B. `accept()` menaikkan generation global untuk setiap pasangan sehingga membatalkan request A walau account/network tidak berubah.

**Dampak:** read-only check yang valid hilang tanpa error. Ini dapat terjadi karena manual check tetap tersedia saat transaksi lain pending, atau saat scan dimulai sementara transaksi lama masih diobservasi. Guard scope A → B → A tetap perlu dipertahankan saat memperbaiki.

### M3 — Unknown outcome tanpa hash tidak punya jalur recovery dalam aplikasi

**Status: mitigasi copy selesai; recovery tetap terbatas.** R1 tidak menawarkan Check receipt tanpa hash, menjelaskan inspeksi wallet/explorer asal dan tetap mengunci writes tanpa unlock otomatis.

**Lokasi:** `src/lib/allowanceWrites.ts:402`, `:550`, `src/components/LiveActivity.tsx:100`, `src/components/AllowanceChangeDialog.tsx:194`.

**Reproduksi:** wallet submit mengembalikan error transport yang tidak definitif, tanpa hash. Status menjadi confirmation-unknown dan semua writes terblokir. Activity tidak menyediakan Check receipt karena tidak ada hash; `checkReceipt()` langsung kembali.

**Bukti:** probe domain menghasilkan `hashPresent=false`, `blockedAfterReceiptCheck=true`. README sudah mendokumentasikan inspect wallet/explorer manual. Namun dialog menyuruh membuka Activity untuk memeriksa receipt yang tidak tersedia.

**Dampak:** dead end UX. Memaksa unlock/retry otomatis berbahaya karena outcome sungguhan belum diketahui. Instruksi pemulihan harus berbeda untuk kasus hash ada dan hash tidak ada.

### M4 — Lock lintas akun, Activity hanya akun aktif

**Status: penjelasan blocker diperbaiki oleh R1.** Akun, chain ID dan hash/tidak ada hash asal kini tampil meskipun Activity akun aktif kosong. Lock konservatif lintas akun dipertahankan.

**Lokasi:** `src/lib/allowanceWrites.ts:201`, `src/hooks/useAllowanceWrites.ts:36`, `src/components/WalletUI.tsx:235`.

**Reproduksi:** account A memiliki unresolved transaction; pindah ke B; Activity B kosong tetapi tombol write tetap terblokir.

**Bukti:** probe domain menunjukkan `otherAccountVisibleActivity=0` dan lock tetap true. UI sudah mengarahkan kembali ke originating account, tetapi tidak menampilkan identitas blocker secara spesifik.

**Dampak:** tampak seperti aplikasi macet. Ini merupakan konsekuensi global lock yang konservatif, bukan bukti salah account melakukan submit. Perbaikan singkat cukup menunjukkan originating account/network; jangan melepas seluruh lock tanpa model konkurensi yang jelas.

### M5 — Scan publik nyata memiliki biaya request besar

**Lokasi:** `src/lib/approvalScan.ts:110`, `src/lib/scanClient.ts:9`, `src/lib/liveAllowances.ts:110`.

**Reproduksi:** gunakan endpoint default, jalankan scan 50.000 blok. Range cap nyata membuat chunk efektif 125 setelah empat error awal.

**Bukti:** browser read-only berhasil 125 blok; proyeksi aritmetika **400 request log** untuk 50.000 blok, ditambah verification. Setiap spender juga mengulang code, balance, dan metadata token. Proyeksi jumlah request bukan durasi full scan yang sudah diukur.

**Dampak:** onboarding scan berpotensi lambat/rate-limited. Progress/cancel/partial sudah tersedia dan berhasil. Jangan menjanjikan scan cepat atau seluruh wallet; tuning infrastruktur bukan blocker Demo sebelum deadline.

### L1 — Submission dan lisensi belum terbukti lengkap

**Lokasi:** file tracked root/README; tidak ada `LICENSE`, dokumen validasi pengguna, atau business/distribution plan dalam tree yang diperiksa.

**Reproduksi:** periksa `git ls-files` dan README. Logo ada; status publik repository, izin reviewer, form submission, dan materi video belum diverifikasi. `brag-output/` adalah artifact lokal untracked, bukan bukti bahwa video memenuhi isi/durasi submission.

**Dampak:** penilaian novelty, viability, traction, dan akses reviewer bisa lemah. Tidak adanya LICENSE bukan automatic disqualification, tetapi code yang dapat dilihat belum otomatis memiliki izin reuse open-source yang jelas.

### L2 — Gate lint dan lingkungan deployment belum diuji

**Lokasi:** `package.json:6`, `playwright.config.ts`, README bagian deployment.

Script lint/config tidak tersedia; browser default Playwright belum terpasang di mesin ini. README menyediakan alternatif Chrome yang terbukti berhasil. Node lokal 23 berbeda dari target 22; konfigurasi Vercel benar secara dokumentasi tetapi deployment aktual tidak diuji.

Ini gap reproduksibilitas/verifikasi, bukan alasan mengganti framework atau upgrade dependencies besar sebelum submission.

## Audit fungsi discovery, reads, dan summary

| Area | Temuan dan bukti |
| --- | --- |
| Scope wallet | Hanya Base Sepolia, scope chain/owner; account/network/disconnect menghapus hasil dan mengabaikan reply lama. Suite mencakup A → B → A. |
| Discovery | Satu USDC contract, owner-indexed Approval logs, `strict: true`, removed logs dibuang (`src/lib/scanClient.ts:19`). Event value tidak dipakai sebagai allowance terkini. |
| Rentang dan pagination | Snapshot head tetap; rentang inclusive 50.000 dan clamp genesis. Cursor/chunk kontigu, lima attempt, bounded backoff, transport 12 detik tanpa retry tambahan. |
| Pair deduplication | Spender case-insensitive pada scan; merge berdasarkan chain/owner/token/spender. Duplicate event tidak menggandakan summary. |
| Verification | Code, balance, allowance, metadata dibaca pada satu block. Balance/allowance wajib berhasil; metadata boleh unavailable. Zero adalah hasil valid. |
| Partial/cancel/retry | Failed logs atau pair verification tidak disebut complete. Cancel mengabaikan late reply tetapi tidak menghentikan HTTP in-flight. Retry mulai snapshot baru; tidak resume cursor. Mock suite dan cancel/retry RPC nyata parsial sudah diuji. |
| Kesegaran | Older scanned block tidak menimpa newer pair. Hasil tetap snapshot, bukan realtime; batas block dan selected-pairs ditampilkan. Celah konkurensi lintas pasangan M2 sudah ditutup oleh R2; block-order dan scope invalidation tetap berlaku. |
| Summary | Active `allowance > 0`; unlimited tepat maxUint256; above balance menggunakan bigint dan strict `>`. Live menghitung kumpulan pasangan terverifikasi sesi, bukan seluruh wallet atau hanya scan terbaru. |
| UI hasil | Live default menyembunyikan zero; Show revoked menampilkannya. Refresh gagal menjaga snapshot lama dengan error. Demo memiliki filter/search sendiri dan data sintetis. |
| Completeness | RPC dapat memberi logs tidak lengkap tanpa error; satu endpoint tidak membuktikan kelengkapan. Older events, token lain, Approval nonstandard, dan undetected spender di luar scope. |

## Audit transaksi dan kompatibilitas ERC-20

- Connection memakai EIP-6963/injected fallback, storage wagmi null, reconnectOnMount false. Connect tidak switch chain otomatis dan tidak meminta spending permission/signature. Switch hanya setelah klik.
- Writes memvalidasi connection, account yang tersedia pada provider, chain 84532, dan confirmation generation setelah async wallet queries. Suite membuktikan final-submit A → B → A guard dan duplicate-click lock.
- Input finite menggunakan parseUnits/bigint, menolak negative, exponent, invalid format, precision berlebih, overflow, dan exact maxUint256. Decimals unavailable memblokir Edit, tetapi Revoke zero tetap dapat dimulai.
- Current allowance diread sebelum simulation; allowance berubah memerlukan review ulang. Metadata decimals berubah memerlukan input ulang. Simulasi tidak mengubah chain; `approve` harus mengembalikan boolean true.
- Wallet rejection, insufficient funds, dan reverted receipt dibedakan. Unknown receipt tidak dianggap failure dan tidak disubmit ulang. Reprice mengikuti replacement hash; replacement/cancel non-reprice tidak melanjutkan reset step.
- Nonzero-to-nonzero selalu reset zero dahulu. Receipt sukses dan actual zero wajib terbukti sebelum explicit Continue. Reject/stop setelah reset tidak otomatis mengirim set. Suite dan mock adapter browser membuktikan urutan ini.
- Receipt sukses memicu read pada receipt block. Verification gagal menjaga lock dan menyediakan Refresh verification. Tes audit memastikan recovery dapat sukses; label dialog M1 sudah diperbaiki oleh R1.
- Account/network berubah saat pending: dialog invalidated, transaksi/history tetap pada scope asal. Receipt dapat terus diobservasi; hasil tidak masuk wallet lain. M4 menjelaskan global lock.
- Receipt memakai satu confirmation dan timeout 120 detik. Tidak ada model finality/reorg lanjutan. Perilaku onReplaced/confirmations sesuai [dokumentasi viem](https://viem.sh/docs/actions/public/waitForTransactionReceipt), diperiksa lewat Context7.

**Dukungan aktual:** token harus punya code dan read ERC-20 yang dapat didecode. Dynamic string metadata dicoba; bytes32 metadata legacy tidak didecode. Token approve `false` ditolak sebelum wallet submit oleh adapter dan terbukti lewat mock browser asli. Tes baru membuktikan approve dengan return kosong `0x` gagal dalam simulation memakai ABI ERC-20 yang sama. Tidak ada fallback kompatibilitas no-return.

Token yang wajib zero-first ditangani melalui reset eksplisit, sepanjang approve tetap lolos simulation/verification. Token paused, blacklist, token-specific restrictions, atau custom approve dapat gagal. Token yang simulated true tetapi tidak mengubah allowance tetap menghasilkan actual value, bukan nilai optimistis. Tidak dilakukan pengujian terhadap semua tipe deployed token. ABI/simulation bukan audit contract dan tidak menjamin kontrak arbitrer berperilaku seperti ERC-20 standar.

## Dependencies, secrets, storage, deployment, dan klaim

- Terpasang: React/ReactDOM 19.3.0, wagmi 3.7.7, viem 2.57.3, TanStack Query 5.104.1, Vite 6.4.3, TypeScript 5.9.3, Playwright 1.63.0. Lockfile tracked. npm audit terbaru menghasilkan nol advisory; tidak dilakukan upgrade.
- Pemindaian file tracked saat ini untuk pola private-key PEM, AWS access key, token GitHub/API tertentu, dan assignment key/mnemonic tidak menemukan kandidat. Tidak ada tracked `.env`, `.pem`, atau `.key`. Tidak ada nilai secret ditampilkan. Ini pemeriksaan pola pada tree sekarang, bukan seluruh git history, provider secret store, atau jaminan bebas secret.
- Source tidak memakai localStorage; wagmi storage null. SessionStorage `veto-entered` hanya mengatur entrance. Smoke test mendapati localStorage kosong. Data onchain/activity tidak persisten.
- Wallet private key/seed tidak diminta. Google Fonts dan endpoint RPC eksternal dipakai; unavailable fonts memiliki system fallback. Privacy produk frontend tidak berarti tidak ada network request ke pihak ketiga.
- Explorer memakai hash wallet-returned dan chain constant; URL aktual `https://sepolia.basescan.org/tx/<hash>`, dengan `noopener noreferrer`. Mock hashes hanya untuk testing; tidak ada hash nyata dipalsukan oleh aplikasi.
- `vercel.json` rewrite `/(.*)` ke `/index.html` cocok dengan [dokumentasi Vercel untuk Vite SPA](https://vercel.com/docs/frameworks/frontend/vite), diperiksa lewat Context7. `/app` direct refresh production lokal lulus. Vercel settings, domain, assets, dan remote deep-link refresh belum diuji karena audit tidak melakukan deploy.
- Klaim landing/README tentang testnet-only, USDC/range, selected-pair summaries, no safety score, snapshot, Demo separation, dan explicit reset sesuai source. Tidak ditemukan klaim pengguna/revenue/partnership/security guarantee Veto. Wording status M1/M3 diperbaiki pada R1; recovery hashless dan session-only tetap dibatasi secara eksplisit.

## Penilaian produk dan kompetitor

Penilaian berikut adalah opini berdasarkan produk dan bukti repository, bukan skor resmi juri.

| Aspek | Penilaian |
| --- | --- |
| Masalah pengguna | Nyata: allowance bertahan setelah penggunaan dApp dan disconnect. Namun produk belum menentukan segmen yang paling membutuhkan bantuan Veto. |
| Keunikan | Rendah untuk discovery/check/edit/revoke. Pembeda saat ini adalah kualitas presentasi, Demo tanpa wallet, penjelasan exposure, serta transparansi block/coverage dan urutan transaksi. Ini pembeda pengalaman, belum teknologi atau moat unik. |
| Kualitas eksekusi | Kuat untuk prototipe: desain konsisten, landing efektif, bigint, pinned reads, simulation, dan guard wallet. Recovery/status dan konkurensi masih perlu diperbaiki. |
| Onboarding | Demo mudah. Live lebih berat: extension, Base Sepolia, token/spender address untuk manual, dan scan USDC yang terbatas. CTA Launch App juga berakhir pada Demo sampai connect; README jujur tentang ini. |
| Distribusi | Belum ada channel teruji dalam repository. Hipotesis masuk akal: komunitas onboarding wallet/Base dan materi edukasi; belum ada bukti conversion atau acquisition cost. |
| Potensi bisnis | Belum tervalidasi. Revoke dasar sudah tersedia luas. Hipotesis edukasi untuk komunitas atau toolkit onboarding perlu diuji sebelum menjanjikan monetisasi/integrasi. |
| Bukti kebutuhan | Tidak ditemukan interview, observasi usability, cohort, pengguna aktif, revenue, atau willingness-to-pay. Tidak adanya bukti di repository bukan bukti tim tidak memilikinya di luar repository. |

**Fakta kompetitor, diverifikasi dari sumber resmi pada audit ini:**

- [Revoke.cash](https://revoke.cash/) menawarkan allowance dashboard/filter/revoke, pencarian address tanpa connect, exploit checker, 80+ jaringan, dan layanan premium monitoring/automated revoking. [Halaman checker resminya](https://revoke.cash/token-approval-checker/ethereum) juga menjelaskan detail approval dan sorting/filtering. Angka marketing pengguna/dana tidak digunakan sebagai bukti independen.
- [Etherscan Information Center](https://info.etherscan.com/connecting-your-wallet-on-etherscan/?id=999) mendokumentasikan Token Approval Checker untuk review/revoke. Halaman app langsung memberi 403 pada browser research, sehingga UI terkini tidak diuji.
- [MetaMask Help Center](https://support.metamask.io/more-web3/learn/how-to-revoke-smart-contract-allowances-token-approvals/) mendokumentasikan allowance/revoke pada MetaMask Portfolio. Tidak dilakukan benchmark hands-on terhadap Portfolio.

**Pendapat:** Veto belum layak diposisikan sebagai alat pertama atau satu-satunya untuk revoke. Positioning yang lebih kredibel untuk diuji adalah *prototipe review izin bagi pengguna yang belum memahami allowance, dengan keputusan yang dapat dijelaskan dan hasil yang dapat diverifikasi*. Demo dan desain membantu menyampaikan ini, tetapi belum membuktikan pengguna memahami lebih cepat daripada memakai kompetitor.

## Konteks submission resmi

[Aturan resmi Crypto World’s Fair](https://colosseum.com/legal/Crypto%20World%27s%20Fair%20Hackathon%20Rules.pdf) menetapkan deadline **12 Oktober 2026 pukul 23:59 PT**, yaitu **13 Oktober 2026 pukul 13:59 WIB** pada offset saat itu. Situs penyelenggara menjadi rujukan bila jadwal berubah. Aturan menilai functionality, impact, novelty, UX, open-source/composability, dan business plan.

[FAQ Colosseum](https://colosseum.com/hackathon) juga menekankan founder fit, insight, execution, communication, viability, dan traction. Materi yang diminta mencakup repo reviewer-accessible, presentasi 2–3 menit, demo maksimal 3 menit, serta strategi distribusi/validasi demand. Status form, akses repo, video, dan informasi tim Veto belum diperiksa di akun penyelenggara.

Jangan mengklaim audit ini menyelesaikan submission. Bukti teknik mendukung prototipe; packaging dan validasi masalah membutuhkan pekerjaan tim.

## Maksimal lima perbaikan, berurutan

Estimasi untuk satu developer yang mengenal repository, termasuk verifikasi; bukan janji waktu. Semua mempertahankan palet hijau dan landing motion. Tidak ada kebutuhan mainnet, multichain, backend, atau AI scoring untuk scope ini.

### Wajib sebelum submission

**R1 — Pisahkan status receipt dan verification; perjelas pemulihan. Selesai.**

- Masalah: M1, mismatch outcome, wording M3, serta pengguna kehilangan konteks H1/M4.
- Perubahan terbatas: Activity/dialog menyatakan receipt confirmed terpisah dari verification loading/unavailable/matched/mismatched. Kasus tanpa hash diarahkan ke wallet/explorer secara manual, bukan tombol receipt fiktif. Tampilkan konsekuensi reload dan originating account untuk blocker; tetap pertahankan lock.
- Manfaat pengguna: tahu apakah transaksi sudah terjadi dan apa yang belum diketahui. Manfaat juri: alur failure menunjukkan kontrol produk, bukan hanya happy path.
- Waktu: 1–2 jam. Risiko regresi: sedang bila state transition diubah; rendah jika status tambahan dipisahkan dan guard submit tidak disentuh.
- Dependencies: store, Activity, dialog, tes domain/browser; tidak perlu library baru.
- Verifikasi: AUDIT-M1 lulus; confirmed+verification unavailable tetap blocked; Refresh verification hanya membaca; reset nonzero/mismatch tidak membuka Continue; unknown tanpa hash tidak menawarkan receipt recovery palsu; suite wallet-race tetap lulus.

**R2 — Isolasi invalidasi manual read per pasangan. Selesai.**

- Masalah: M2; update B membatalkan A tanpa perubahan scope.
- Perubahan: pisahkan scope/session invalidation dari update-result generation; merge hasil manual melalui aturan block-order per pair. Jangan mengizinkan older read menimpa newer verification pasangan yang sama.
- Manfaat pengguna: manual check tetap selesai saat aktivitas lain masuk. Manfaat juri: data yang ditampilkan konsisten saat interaksi nyata, bukan hanya berurutan.
- Waktu: 45–90 menit. Risiko regresi: sedang, khususnya A → B → A dan same-pair stale reads.
- Dependencies: `AllowanceSession`, hook observer, tes M2 serta tes stale response yang sudah ada.
- Verifikasi: AUDIT-M2 lulus; kedua pasangan tampil; newer same-pair tetap menang; disconnect/network change tetap membuang late response; summary unique benar.

**R3 — Uji pengguna singkat dan paket pitch yang jujur.**

- Masalah: pembeda, demand, onboarding, distribusi, dan submission-access belum terbukti.
- Perubahan nonfitur: observasi 3–5 calon pengguna dengan izin, tugas Demo + review approval, kemudian pitch/demo sesuai ketentuan resmi. Tim menentukan akses repo/lisensi dan melengkapi form. Tidak menghubungi peserta atau reviewer secara otomatis dalam audit.
- Manfaat pengguna: menemukan titik salah paham sebelum produk diperluas. Manfaat juri: evidence-based insight dan strategi distribusi, bukan angka traction rekaan.
- Waktu: 1,5–3 jam jika peserta siap; bisa menjadi blocker eksternal bila belum ada peserta.
- Risiko regresi: rendah; risiko interpretasi tinggi bila sampel kecil dianggap representatif.
- Dependencies: peserta, tim/founder, screen recording atau notes, keputusan akses repo; tidak perlu source change.
- Verifikasi: catat n peserta aktual, waktu/task success, pemahaman allowance versus balance/disconnect, masalah nyata, dan kutipan berizin. Video membedakan Demo, mock, RPC nyata dan transaksi testnet nyata yang sebelumnya dilakukan pengguna; jangan menganggap mock sebagai bukti signing nyata. Jangan menyebut 3–5 sebagai pengguna aktif/traction berbayar.

Setelah R1/R2, R3 lebih bernilai daripada fitur baru: gap utama penilaian startup adalah insight/demand/communication, bukan kekurangan multichain.

### Bernilai jika waktu cukup

**R4 — Panduan review singkat; ekspor bukti hanya bila masih ada waktu.**

- Masalah: alamat spender sulit dipahami; angka unlimited/above balance belum membantu menentukan tindakan.
- Perubahan: satu panduan ringkas di Live: cocokkan token/spender dengan sumber resmi, pastikan masih dipakai, pahami kebutuhan allowance, lalu pilih keep/limit/revoke. Jangan memberi malicious/safe verdict. Jika panduan sudah diuji dan ada waktu, ekspor JSON lokal berisi scope, pair, block, raw allowance/balance, coverage, dan receipt/verification status sebagai opsi bukti.
- Manfaat pengguna: keputusan lebih mudah dijelaskan; export membantu reproduksi/support. Manfaat juri: memperkuat positioning transparansi, bukan sekadar salinan checker.
- Waktu: panduan 30–60 menit; export tambahan 60–90 menit. Risiko regresi: rendah untuk copy, sedang untuk schema/export bigint dan privacy address.
- Dependencies: insight R3, hasil R1 untuk status; browser download API bila export dipilih, tanpa backend.
- Verifikasi: pengguna tidak menganggap exposure sebagai diagnosis keamanan; mobile/keyboard tetap terjangkau. Export memakai bigint string, decimals nullable, scope dan block tepat; tidak mengubah allowance atau mengandung secret. Bila waktu pendek, pilih uji pengguna/pitch daripada export.

### Roadmap setelah hackathon

**R5 — Recovery transaksi tahan reload, tanpa retry otomatis.**

- Masalah: H1/M3/M4; history hilang, hashless outcome dead end, dan blocker tidak mudah dilacak.
- Perubahan terukur: jurnal minimal owner/chain/pair/hash/requested/status sebelum/ketika submit; restore read-only observation dan verifikasi saat aplikasi kembali. Unknown tanpa hash membutuhkan rekonsiliasi wallet/nonce yang terbukti; jangan membuka lock hanya berdasarkan reload atau acknowledgement.
- Manfaat pengguna: tidak kehilangan konteks pending. Manfaat juri/investor: jalur menuju keandalan produksi, tanpa mengklaim fitur ini sudah ada.
- Waktu: 1–2 hari plus pengujian wallet manual. Risiko regresi: tinggi pada concurrency, storage rusak, account isolation, replacement, dan replay.
- Dependencies: model status R1, serialization bigint/versioning, keputusan privacy retention, fixture reload, dan pengujian wallet sungguhan oleh tim secara terpisah. Backend/multichain tidak diperlukan.
- Verifikasi: reload/close/reopen tidak submit ulang, pending/unknown tidak hilang, account B tidak mengambil data A, corrupt storage gagal konservatif, replacement/reorg diperlakukan eksplisit. Transaksi nyata tetap memerlukan pengujian terpisah setelah otorisasi tim.

## Satu langkah berikutnya paling berdampak

**R3: uji pemahaman 3–5 calon pengguna dan rapikan pitch berdasarkan hasilnya.** R1/R2 sudah menutup dua kegagalan yang terbukti; gap submission terbesar berikutnya adalah bukti kebutuhan dan komunikasi pembeda. Ini lebih bernilai dalam beberapa jam daripada menambah jaringan atau fitur.

Rencana untuk ditinjau, belum dijalankan:

1. Rekrut peserta yang bersedia melalui tim; audit tidak mengirim pesan kepada pihak lain.
2. Beri tugas Demo: review unlimited, edit finite, revoke, lalu jelaskan allowance versus balance/disconnect. Gunakan skenario receipt confirmed/verification unavailable untuk menguji pemahaman status tanpa signing.
3. Catat keberhasilan tugas, waktu, titik salah paham dan kutipan berizin; ubah narasi pitch sesuai bukti. Jelaskan batas scan, Base Sepolia dan session-only secara jujur.
4. Tim meninjau akses repo serta form/video submission; sertakan bukti transaksi testnet sebelumnya secara terpisah jika tersedia.

Acceptance criteria: jumlah peserta aktual tercatat; observasi dan opini dibedakan; tidak ada angka traction/revenue rekaan; pitch menyatakan pembeda pengalaman dan batas produk; materi membedakan Demo, mock, RPC read-only dan transaksi testnet nyata. Tidak diperlukan fitur baru untuk menyelesaikan langkah ini.

## Hal yang belum diverifikasi

Tidak diuji oleh auditor dalam tahap ini: installed extension wallet sungguhan, hardware/mobile wallet, signing/transaksi testnet nyata, deployed approve false/no-return/custom token secara nyata, real pending/replacement/reorg, full scan RPC 50.000 blok, completeness independent indexer, Safari/WebKit/Firefox, perangkat fisik/GPU, Vercel deployed URL/Node 22, submission form/reviewer access/video aktual, atau validasi demand/monetisasi.

Pengguna telah menyatakan melakukan transaksi testnet nyata sebelum audit ini. Itu bukti terpisah dari mock dan read-only RPC audit; audit ini tidak menelusuri hash/receipt transaksi pengguna tersebut. Tidak disimpulkan bahwa Veto belum pernah diuji transaksi nyata.

Tidak ada private key diminta, signing/transaksi nyata oleh auditor, commit/push/deploy. R1/R2 dan verifikasi otomatis selesai; R3–R5 masih rekomendasi, belum diimplementasikan.
