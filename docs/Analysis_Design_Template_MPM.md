# **Analysis & Design Document (A&D)**

|Project:|Digital Form BPU Timor Leste|
| :- | :- |
|Date:|14 Oktober 2025|
|Version:|1\.0|
|Prepared by:|IT System Analyst Team|
## **1. Objective**
Dokumen ini menjabarkan analisis proses bisnis dan rancangan teknis aplikasi Digital Form BPU untuk memastikan kesesuaian dengan kebutuhan bisnis dan kemudahan integrasi ke AX365.
## **2. Business Process Flow (AS-IS)**
User → Email BPU Form Excel → Print → Approval Manual → Kirim ke Finance → Input ke AX365 → Pembayaran\
Problem: sulit dilacak, sering terjadi duplikasi form, dan keterlambatan approval.
## **3. Business Process Flow (TO-BE)**
[User Create BPU Online Form] → [Auto Validation Budget] → [Approval Workflow (Dept Head → Finance)] → [Data Sent to AX365 API] → [Payment Confirmation & Close]\
Improvement: waktu proses turun 60%, status real-time, dan data terintegrasi otomatis ke AX365.
## **4. Use Case Diagram**
+---------------------+\
|     System BPU      |\
+---------------------+\
|  [Create BPU]       |\
|  [Approve BPU]      |\
|  [View Dashboard]   |\
|  [Export Report]    |\
+---------------------+\
`      `^         ^\
`      `|         |\
Requester   Approver
## **5. Entity Relationship Diagram (ERD)**
+-----------+       +-------------+        +-------------+\
| tbl\_user  | 1..n  | tbl\_bpu     | 1..n   | tbl\_approval|\
+-----------+       +-------------+        +-------------+\
| user\_id   |-----> | bpu\_id      |----->  | approval\_id |\
| name      |       | requester   |        | approver\_id |\
| role      |       | amount      |        | status      |\
+-----------+       +-------------+        +-------------+
## **6. System Architecture (C4 – Level 1: Context Diagram)**
[User Web Browser]\
`       `│\
`       `▼\
[Digital Form BPU App] ──────► [AX365 API]\
`       `│\
`       `▼\
`   `[SSO MPM Login]
## **7. High-Level Design (C4 – Level 2: Container)**

|Component|Technology|Description|
| :- | :- | :- |
|Frontend|React.js / Vue.js|Antarmuka user untuk pengajuan & approval|
|Backend|.NET Core API|Logika bisnis, validasi, dan integrasi AX365|
|Database|SQL Server|Penyimpanan data BPU & approval|
|Authentication|MPM SSO (OAuth 2.0)|Single Sign-On user internal|
|Integration|REST API AX365|Sinkronisasi data pengajuan ke AX|
## **8. Sequence Diagram (Proses Submit BPU)**
User → UI Form : Input data BPU\
UI Form → API : POST /bpu\
API → DB : Insert tbl\_bpu\
API → AX365 : Send JSON payload\
AX365 → API : Response success\
API → UI Form : Show 'Submitted'
## **9. UI/UX Mockup**
Halaman utama menampilkan daftar BPU dengan status warna:\
\- Hijau: Approved\
\- Kuning: Waiting Approval\
\- Merah: Rejected
## **10. Non-Functional Design**

|Aspect|Design Specification|
| :- | :- |
|Security|Gunakan HTTPS, role-based access, audit trail per transaksi|
|Performance|Optimasi query SQL, caching pada dashboard|
|Availability|Deploy di DC MPM, backup tiap 24 jam|
|Maintainability|Modular API & versioning di GitLab|
## **11. Deployment Architecture**
[User Browser]\
`    `│\
`    `▼\
[Load Balancer]\
`    `│\
` `┌──┴────────┐\
` `│ App Server │ (.NET API)\
` `└────┬──────┘\
`      `│\
`      `▼\
` `[SQL Server DC]
## **12. Design Approval**

|Role|Name|Signature|Date|
| :- | :- | :- | :- |
|Business Owner|[Nama Finance Manager]|||
|System Analyst|[Nama SA MPM]|||
|Developer Lead|[Nama DEV Lead]|||

