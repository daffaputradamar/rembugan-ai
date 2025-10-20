# **User Requirement Document (URD)**

|Project Name:|Digital Form BPU Timor Leste|
| :- | :- |
|Date:|14 Oktober 2025|
|Prepared by:|System Analyst Team|
|Reviewed by:|Business Owner (Finance)|
|Version:|1\.0|
## **1. Background**
Proses pengajuan BPU saat ini masih manual melalui email dan Excel, sehingga sulit dilacak statusnya. Dibutuhkan aplikasi berbasis web agar pengajuan dan approval dapat dilakukan secara digital, terintegrasi dengan sistem pembayaran di AX365.
## **2. Objective**
Meningkatkan efisiensi proses pengajuan dan approval BPU hingga 50%, serta mempercepat proses pembayaran ke vendor dengan integrasi langsung ke sistem keuangan AX365.
## **3. Scope**

|In Scope|Out of Scope|
| :- | :- |
|Pengajuan BPU digital oleh user|Integrasi dengan sistem HRMS|
|Workflow approval sesuai matrix|Modul budgeting|
|Integrasi ke AX365 via API|Notifikasi via WhatsApp (fase berikutnya)|
## **4. Functional Requirements**

|No|Requirement|Description|Priority|
| :- | :- | :- | :- |
|FR-01|Form pengajuan BPU|User dapat mengisi form pengajuan BPU lengkap dengan lampiran|High|
|FR-02|Workflow approval|Sistem melakukan approval otomatis sesuai matrix jabatan|High|
|FR-03|Integrasi AX365|Data BPU yang di-approve otomatis dikirim ke AX365|High|
|FR-04|Dashboard monitoring|Menampilkan status pengajuan, disetujui, ditolak, atau pending|Medium|
|FR-05|Notifikasi email|Mengirimkan notifikasi kepada approver|Medium|
## **5. Non-Functional Requirements**

|No|Aspect|Requirement|
| :- | :- | :- |
|NFR-01|Security|Akses login dengan SSO MPM|
|NFR-02|Performance|Response time < 3 detik untuk transaksi pengajuan|
|NFR-03|Usability|Desain UI sesuai guideline MPM Portal|
|NFR-04|Availability|99\.5% uptime, host di DC MPM|
|NFR-05|Maintainability|Kode mengikuti struktur repository standard MPM|
## **6. User Role & Access**

|Role|Description|Access Rights|
| :- | :- | :- |
|Requester|User yang membuat BPU|Create, Edit, View own data|
|Approver|Atasan yang menyetujui|View & Approve|
|Finance|Pengelola pembayaran|View & Export|
|Admin|Pengelola sistem|Full Access|
## **7. Business Flow**
[User Submit BPU] → [Auto Validation Budget] → [Approval 1 - Dept Head] → [Approval 2 - Finance] → [Integrate to AX365] → [Payment & Close]
## **8. Integration Point**

|System|Direction|Data|Protocol|
| :- | :- | :- | :- |
|AX365|Outbound|Data BPU|REST API|
|MPM SSO|Inbound|User authentication|OAuth 2.0|
## **9. Acceptance Criteria**
Aplikasi dianggap selesai jika seluruh fitur prioritas High telah berfungsi di environment UAT tanpa bug mayor dan telah disetujui oleh user owner.
## **10. Sign-Off**

|Name|Position|Signature|Date|
| :- | :- | :- | :- |
|[Nama User Owner]|Finance Manager|||
|[Nama System Analyst]|IT System Integrator|||
|[Nama Developer Lead]|IT Application Dev|||

