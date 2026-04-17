# iDempiere Appointment Management Plugin

預約管理系統 — iDempiere 內建的 Google Calendar 風格行事曆。

登入 iDempiere 後，從選單點「預約管理」即可使用。背後資料全部存在 iDempiere 標準表（S_Resource*），計費走標準 O2C 流程，不需要額外登入或外站。

## 功能概覽

- 📅 FullCalendar 日/週/月/列表檢視
- 🎨 預約狀態顏色（預約中、已確認、已報到、看診中、已完成、爽約、取消）
- 👥 多資源管理（醫師、診間），依類型分組
- 🔍 搜尋預約、跳轉日期
- ➕ 點擊時段新增預約，選擇服務項目自動計算時長
- ✏️ 點擊事件編輯狀態、時間、備註
- 🚫 衝突檢測（IsSingleAssignment 資源）
- 📋 複製到下週（定期回診）
- 🔐 Session-based JWT — 誰登入就用誰的權限，不需要 service account

## 系統需求

- iDempiere 12
- JDK 17+
- Maven 3.9+
- PostgreSQL

## 從零開始安裝

### 1. 建置 iDempiere（如果還沒有 p2 repository）

```bash
git clone https://github.com/idempiere/idempiere.git
cd idempiere
mvn verify
# 產出：org.idempiere.p2/target/repository/
```

### 2. 建置本外掛

```bash
git clone https://github.com/nczz/idempiere-appointment.git
cd idempiere-appointment

# 指向 iDempiere p2 repository（調整路徑）
mvn verify -Didempiere.core.repository.url=file:///path/to/idempiere/org.idempiere.p2/target/repository
```

建置成功後，p2 repository 在：
```
com.mxp.idempiere.appointments.p2/target/repository/
```

### 3. 部署到 iDempiere

```bash
cd /path/to/idempiere-server

# 使用 iDempiere 標準部署工具
./update-rest-extensions.sh /path/to/idempiere-appointment/com.mxp.idempiere.appointments.p2/target/repository/
```

### 4. 重啟 iDempiere

```bash
systemctl restart idempiere
```

首次啟動時，外掛會自動：
- 建立 AD_Reference「X_AppointmentStatus」及 7 個狀態值（含顏色）
- 建立 AD_Column「X_AppointmentStatus」和「C_BPartner_ID」在 S_ResourceAssignment 表
- 執行 ALTER TABLE 新增實際 DB 欄位
- 建立 AD_Form「預約管理」
- 建立 AD_Menu 並掛載到選單樹
- 建立角色權限（AD_Form_Access）
- 建立翻譯記錄（AD_Menu_Trl、AD_Form_Trl）

**不需要手動執行任何 SQL。**

### 5. 設定 Reverse Proxy（如果有）

如果 iDempiere 前面有 nginx reverse proxy，需要加上 `/appointment/` 路徑的轉發：

```nginx
location /appointment/ {
    proxy_pass http://idempiere-backend:8080/appointment/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

### 6. 登入使用

1. 登入 iDempiere WebUI
2. 在左側選單找到「Partner Relations」→「預約管理」
3. 點擊即可開啟行事曆

## 專案結構

```
idempiere-appointment/
├── pom.xml                                    # Maven root
├── com.mxp.idempiere.appointments.parent/     # Tycho 建置設定
│   └── pom.xml
├── com.mxp.idempiere.appointments/            # 外掛本體
│   ├── META-INF/MANIFEST.MF                   # OSGi bundle 設定
│   ├── WEB-INF/web.xml                        # Token servlet mapping
│   ├── OSGI-INF/                              # SCR component
│   ├── build.properties
│   ├── src/com/mxp/appointments/
│   │   ├── AppointmentActivator.java          # Bundle 啟動 + 自動 migration
│   │   ├── AppointmentForm.java               # ZK Form（iframe 容器）
│   │   ├── AppointmentFormController.java     # Token 取得 + postMessage 橋接
│   │   └── TokenServlet.java                  # AD_Session_ID → JWT token
│   ├── web/appointments/
│   │   ├── index.html                         # SPA 入口
│   │   ├── app.js                             # FullCalendar + 業務邏輯
│   │   ├── api.js                             # iDempiere REST API 封裝
│   │   └── style.css                          # 樣式
│   └── migration/
│       └── 001_appointment_ad_setup.sql       # AD 設定（首次啟動自動執行）
├── com.mxp.idempiere.appointments.p2/         # p2 repository 產出
│   ├── pom.xml
│   └── category.xml
├── tests/                                     # Playwright E2E 測試
│   ├── appointment.spec.ts
│   └── helpers.ts
├── DESIGN.md                                  # 設計規劃文件
└── ACCEPTANCE.md                              # 驗收規格表
```

## 技術架構

```
ZK Session（已登入使用者）
  └── AppointmentForm（ZK Form）
        ├── 從 Env.getCtx() 取得 AD_Session_ID
        ├── POST /appointment/token → JWT token（純 Java HMAC-SHA512 簽發）
        └── <iframe src="appointments/index.html#token=...">
              └── SPA（FullCalendar）
                    └── 用 JWT token 呼叫 iDempiere REST API
                          ├── S_ResourceType     資源類型
                          ├── S_Resource          資源清單
                          ├── S_ResourceAssignment 預約 CRUD
                          ├── AD_Ref_List         狀態 + 顏色
                          └── C_BPartner          病患搜尋
```

### Token 機制

- **不需要 service account** — 用當前 ZK session 的 `AD_Session_ID` 換發 JWT
- Token 由 `TokenServlet` 簽發，使用和 iDempiere REST API 相同的 HMAC-SHA512 密鑰（`REST_TOKEN_SECRET`）
- Token 有效期 7 天（遠超 ZK session 壽命，iframe 關閉即失效）
- 備有 postMessage 橋接機制，可在需要時自動續期

## 預約狀態

| 代碼 | 名稱 | 顏色 | 佔位 |
|------|------|------|:----:|
| SCH | 預約中 | 🟡 #FBBF24 | ✅ |
| CFM | 已確認 | 🔵 #3B82F6 | ✅ |
| CHK | 已報到 | 🟢 #10B981 | ✅ |
| INP | 看診中 | 🟠 #F97316 | ✅ |
| DON | 已完成 | ⚪ #9CA3AF | ✅ |
| ABS | 爽約   | 🔴 #EF4444 | ❌ |
| CXL | 取消   | ⬜ #D1D5DB | ❌ |

狀態和顏色可在 iDempiere 後台（AD_Ref_List）自行修改，不需要改程式碼。

## 開發

### 執行測試

```bash
npm install
npx playwright test
```

### 修改 SPA

SPA 檔案在 `com.mxp.idempiere.appointments/web/appointments/`，修改後重新 `mvn verify` 並部署。

## 授權

GPL-2.0（與 iDempiere 相同）
