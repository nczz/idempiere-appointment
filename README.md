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

# 使用 iDempiere 標準部署工具（注意：用 update-prd.sh，不是 update-rest-extensions.sh）
./update-prd.sh file:///path/to/idempiere-appointment/com.mxp.idempiere.appointments.p2/target/repository/ com.mxp.idempiere.appointments
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
              └── SPA（React + TypeScript + FullCalendar）
                    ├── GET /appointment/init      初始資料
                    ├── GET /appointment/events     預約查詢
                    ├── POST /appointment/book      建立預約
                    ├── PUT /appointment/update     更新預約
                    ├── POST /appointment/group-add 加入資源
                    └── GET /appointment/bpartners  搜尋病患
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

### 前置需求

- Node.js 18+（SPA 建置）
- JDK 17+（Java 編譯）
- Maven 3.9+（Tycho 建置）
- iDempiere 12 原始碼已建置（提供 p2 repository）

### 專案結構

```
idempiere-appointment/
├── spa/                          ← React SPA 原始碼
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── App.tsx
│       ├── api.ts
│       ├── types.ts
│       ├── components/
│       └── hooks/
├── com.mxp.idempiere.appointments/   ← OSGi bundle（Java + 靜態檔）
│   ├── META-INF/MANIFEST.MF
│   ├── WEB-INF/web.xml
│   ├── src/com/mxp/appointments/     ← Java servlets
│   ├── web/appointments/             ← Vite build 產出（不要手動編輯）
│   └── migration/                    ← SQL migration
├── com.mxp.idempiere.appointments.parent/  ← Maven parent
├── com.mxp.idempiere.appointments.p2/      ← p2 repository 產出
└── tests/                            ← Playwright E2E 測試
```

### 開發流程

#### 1. 修改 SPA（React）

```bash
cd spa
npm install              # 首次或 package.json 變更後
npm run dev              # 開發模式（http://localhost:5173，需要 iDempiere 後端）
npm run build            # 建置到 ../com.mxp.idempiere.appointments/web/appointments/
```

`npm run build` 會清空 `web/appointments/` 並產出新的 `index.html` + `assets/`。

#### 2. 修改 Java（Servlet）

Java 原始碼在 `com.mxp.idempiere.appointments/src/`。修改後需要重新建置 OSGi bundle。

#### 3. 建置 OSGi Bundle

```bash
# 先建置 SPA（如果有修改）
cd spa && npm run build && cd ..

# 建置 Java + 打包 OSGi bundle + 產出 p2 repository
mvn verify -Didempiere.core.repository.url=file:///path/to/iDempiere/org.idempiere.p2/target/repository
```

產出：
- `com.mxp.idempiere.appointments/target/*.jar` — OSGi bundle
- `com.mxp.idempiere.appointments.p2/target/repository/` — p2 update site

#### 4. 部署到 iDempiere

**正式部署（使用 p2 update site）：**
```bash
cd /path/to/idempiere-server
./update-rest-extensions.sh /path/to/com.mxp.idempiere.appointments.p2/target/repository/
systemctl restart idempiere
```

**開發快速部署（直接複製檔案）：**
```bash
# 在 iDempiere 伺服器上
cd /path/to/idempiere-appointment
git pull

# 只更新 SPA 靜態檔（不需重啟）
cp -r com.mxp.idempiere.appointments/web/appointments/* \
  /path/to/idempiere/plugins/com.mxp.idempiere.appointments_*/web/appointments/

# 更新 Java class（需要重啟）
mvn verify -q
cp com.mxp.idempiere.appointments/target/classes/com/mxp/appointments/*.class \
  /path/to/idempiere/plugins/com.mxp.idempiere.appointments_*/com/mxp/appointments/
systemctl restart idempiere
```

> **注意**：SPA 靜態檔更新不需要重啟 iDempiere（NoCacheFilter 確保瀏覽器不快取）。Java class 更新需要重啟。

### 執行測試

```bash
# E2E 測試（需要 iDempiere 後端運行中）
IDEMPIERE_URL=https://your-server.com \
IDEMPIERE_USER=admin \
IDEMPIERE_PASS=admin \
npx playwright test
```

### Reverse Proxy 設定

如果 iDempiere 前面有 nginx，需要轉發 `/appointment/` 路徑：

```nginx
location /appointment/ {
    proxy_pass http://idempiere-backend:8080/appointment/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## 授權

GPL-2.0（與 iDempiere 相同）
