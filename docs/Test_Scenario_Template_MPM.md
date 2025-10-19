# **Test Scenario Document**

|Project:|Digital Form BPU Timor Leste|
| :- | :- |
|Version:|1\.0|
|Date:|14 Oktober 2025|
|Prepared by:|System Analyst Team|
## **1. Objective**
Dokumen ini menjabarkan skenario uji yang akan digunakan untuk memastikan aplikasi Digital Form BPU memenuhi kebutuhan bisnis sebagaimana tertuang dalam URD dan A&D Document.
## **2. Reference Document**

|No|Document Name|Version|Date|
| :- | :- | :- | :- |
|1|User Requirement Document (URD)|1\.0|14 Okt 2025|
|2|Analysis & Design (A&D) Document|1\.0|14 Okt 2025|
## **3. Scope**

|In Scope|Out of Scope|
| :- | :- |
|Proses pengajuan BPU|Modul budgeting|
|Workflow approval sesuai matrix jabatan|Integrasi HRMS|
|Integrasi data ke AX365|Pengiriman notifikasi WhatsApp|
## **4. Test Scenario Summary**

|No|Scenario ID|Description|URD Reference|Expected Result|Category|
| :- | :- | :- | :- | :- | :- |
|1|TS-01|User dapat membuat pengajuan BPU baru|URD-FR-01|Data BPU tersimpan dan muncul di dashboard 'Waiting Approval'|Fungsional|
|2|TS-02|Sistem melakukan validasi mandatory field pada form BPU|URD-FR-01|Pesan error muncul jika field wajib kosong|Fungsional|
|3|TS-03|Workflow approval sesuai matrix jabatan|URD-FR-02|BPU berpindah ke approver berikutnya sesuai matrix|Workflow|
|4|TS-04|Status BPU berubah setelah proses approval|URD-FR-03|Status berubah menjadi 'Approved' atau 'Rejected'|Fungsional|
|5|TS-05|Data BPU terintegrasi ke AX365 setelah disetujui Finance|URD-FR-03|Data terkirim ke AX365 dan nomor transaksi AX muncul|Integrasi|
|6|TS-06|Dashboard menampilkan daftar pengajuan sesuai filter dan status|URD-FR-04|Data tampil sesuai role user dan status|Tampilan|
|7|TS-07|Sistem mengirim notifikasi email ke approver|URD-FR-05|Email terkirim ke approver berikutnya|Non-Fungsional|
## **5. Non-Functional Scenarios**

|No|Scenario ID|Description|Aspect|Expected Result|
| :- | :- | :- | :- | :- |
|1|TS-NF-01|Uji performa saat 50 user submit bersamaan|Performance|Response time < 3 detik|
|2|TS-NF-02|Validasi login dengan SSO MPM|Security|Hanya user aktif yang dapat login|
|3|TS-NF-03|Uji ketersediaan sistem (availability)|Availability|Sistem tetap stabil selama jam kerja|
## **6. Test Data Requirement**

|No|Data Type|Example|Remarks|
| :- | :- | :- | :- |
|1|Data BPU valid|Nominal: 1.000.000; Dept: Finance|Untuk uji pengajuan sukses|
|2|Data BPU tidak valid|Nominal: kosong|Untuk uji validasi mandatory|
|3|Data Approver|Head: Adhika; Finance: Kevin|Untuk uji workflow approval|
## **7. Acceptance Criteria**
Aplikasi dinyatakan lolos tahap System Test jika:\
1\. 100% skenario uji fungsional (TS-01 s.d TS-07) dinyatakan Pass.\
2\. Tidak ada bug mayor atau blocker.\
3\. Semua integrasi ke AX365 berhasil tanpa error.
## **8. Approval**

|Role|Name|Signature|Date|
| :- | :- | :- | :- |
|System Analyst|[Nama SA MPM]|||
|QA Lead|[Nama QA Lead]|||
|Business Owner|[Nama Finance Manager]|||

