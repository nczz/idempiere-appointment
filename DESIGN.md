# 診所預約管理系統 — 設計規劃

> 專案名稱：idempiere-appointment
> 建立日期：2026-04-17
> 狀態：規劃中

## 一、系統定位

iDempiere 內建的 Form 選單項目。診所夥伴登入 iDempiere 後，從選單點「預約管理」即可使用 Google Calendar 風格的行事曆介面。

- 背後資料全部存在 iDempiere 標準表（S_Resource*）+ 一個 AD 自訂欄位
- 計費走標準 O2C 流程（C_Order → C_Invoice → C_Payment）
- 不需要額外登入、不需要外站
- 通用設計，不綁定特定租戶

## 二、技術架構

```
┌─ iDempiere ──────────────────────────────────┐
│                                              │
│  ZK Session（已登入）                          │
│    └── AppointmentForm（ZK Form）              │
│          ├── Server-side 產生 REST Token       │
│          ├── Token 自動續期（postMessage）      │
│          └── <iframe> 載入 SPA                 │
│                                              │
│  ┌─ iframe 內 ─────────────────────────┐      │
│  │  SPA（HTML + JS + CSS）              │      │
│  │  ├── FullCalendar（行事曆引擎）       │      │
│  │  ├── api.js（REST API 封裝）         │      │
│  │  └── 呼叫 /api/v1/models/*          │      │
│  └──────────────────────────────────────┘      │
│                                              │
│  iDempiere REST API（標準 endpoint）           │
│    ├── S_ResourceType       查詢資源類型       │
│    ├── S_Resource           查詢資源清單       │
│    ├── S_ResourceAssignment CRUD 預約         │
│    ├── S_ResourceUnAvailable 不可用時段       │
│    ├── C_BPartner           搜尋病患          │
│    ├── C_Order              建立帳單          │
│    ├── C_OrderLine          帳單明細          │
│    └── AD_Ref_List          狀態/顏色定義     │
│                                              │
└──────────────────────────────────────────────┘
```

### 架構決策

| 決策 | 選擇 | 理由 |
|------|------|------|
| UI 技術 | FullCalendar SPA（嵌入 ZK iframe） | ZK 無法提供行事曆等級的 UX |
| 後端 | iDempiere 標準 REST API | 不寫自訂 endpoint，減少維護成本 |
| 部署方式 | 單一 OSGi bundle | SPA 靜態檔打包在 plugin 內，單一部署 |
| 衝突檢測 | 前端查詢（排除終結狀態） | 診所規模不需要 DB 層級鎖；CXL/ABS 自動釋放時段 |
| 計費時機 | 按需觸發 | 預約不強制建立 C_Order，看診完成後才計費 |
| 預約狀態 | AD Reference List + 自訂欄位 | 診所可自行定義狀態和顏色，不改程式碼 |
| 取消預約 | 改狀態，不刪除 | 保留歷史紀錄，時段自動釋放可重新預約 |

## 三、資料模型

### 3.1 核心表關聯

```
S_ResourceType（資源類型）
  │  例：「醫師」「診間」「手術室」
  │  ├── 工作日：OnMonday~OnSaturday
  │  ├── 時段：IsTimeSlot, TimeSlotStart/End
  │  ├── IsSingleAssignment=Y
  │  └── M_Product_Category_ID → 產品分類
  │
  ▼
S_Resource（個別資源）
  │  例：「王醫師」「A診間」
  │  ├── S_ResourceType_ID → 歸屬類型
  │  ├── AD_User_ID → 關聯使用者（醫師適用）
  │  ├── M_Warehouse_ID → 歸屬地點
  │  └── 系統自動產生 M_Product（ProductType=R）
  │
  ├──▼
  │  S_ResourceAssignment（預約佔位 = 行事曆事件）
  │    ├── S_Resource_ID → 佔哪個資源
  │    ├── AssignDateFrom / AssignDateTo（datetime）
  │    ├── Name → 行事曆顯示文字
  │    ├── Description → JSON 結構化資料
  │    ├── IsConfirmed → 基礎確認狀態（內建）
  │    ├── X_AppointmentStatus → 預約狀態（AD 自訂欄位，List 型態）
  │    ├── C_BPartner_ID → 病患（AD 自訂欄位，Table Direct）
  │    └── Qty → 時數
  │
  └──▼
     S_ResourceUnAvailable（不可用時段）
       ├── S_Resource_ID
       ├── DateFrom / DateTo（僅日期）
       └── Description
```

### 3.2 預約狀態與顏色（AD Reference List）

透過 iDempiere Application Dictionary 建立 Reference `X_AppointmentStatus`，診所可在後台自行管理狀態清單和對應顏色。

**預設狀態（範例，各診所可自訂）：**

| Value | Name | Description（顏色） | 佔位 | 說明 |
|-------|------|:-------------------:|:----:|------|
| SCH | 預約中 | #FBBF24 🟡 | ✅ | 初始狀態 |
| CFM | 已確認 | #3B82F6 🔵 | ✅ | 電話/訊息確認 |
| CHK | 已報到 | #10B981 🟢 | ✅ | 病患到場 |
| INP | 看診中 | #F97316 🟠 | ✅ | 進入診間 |
| DON | 已完成 | #9CA3AF ⚪ | ✅ | 看診結束 |
| ABS | 爽約 | #EF4444 🔴 | ❌ | 未到場，時段釋放 |
| CXL | 取消 | #D1D5DB | ❌ | 主動取消，時段釋放 |

**佔位規則：** 衝突檢測時排除「不佔位」的終結狀態（CXL、ABS）。這些狀態的時段自動釋放，可直接被新預約覆蓋。

**實作方式：**

1. 在 AD 建立 Reference（AD_Reference, DisplayType=List）
2. 在 AD_Ref_List 建立各狀態項目，Description 欄位存顏色 hex code
3. 在 S_ResourceAssignment 表透過 AD 加自訂欄位 `X_AppointmentStatus`（List 型態，指向該 Reference）
4. 在 S_ResourceAssignment 表透過 AD 加自訂欄位 `C_BPartner_ID`（Table Direct，指向 C_BPartner）
5. REST API 自動支援讀寫和 OData filter

**顏色優先順序：**

行事曆事件的顏色依以下順序決定：
1. **預約狀態顏色**（X_AppointmentStatus 對應的 Description）— 最優先
2. **資源顏色**（前端為每個資源分配的顏色）— fallback

狀態顏色讓診所夥伴一眼看出每個預約的進度；資源顏色用於區分不同醫師/診間的事件。

### 3.3 取消/爽約與時段釋放

取消預約 = 將 X_AppointmentStatus 改為 CXL（或 ABS），**不刪除** Assignment。

- 紀錄保留：可追溯取消歷史、統計爽約率
- 時段釋放：衝突檢測排除 CXL/ABS，該時段可直接建立新預約
- 顯示方式：預設隱藏已取消/爽約的事件；開啟「顯示已取消」時以淡色呈現
- 覆蓋預約：使用者在已取消的時段上直接建立新預約，體驗等同空時段，無額外步驟

**衝突檢測查詢（排除終結狀態）：**

```
GET S_ResourceAssignment?$filter=
  S_Resource_ID eq {id}
  and AssignDateFrom lt '{end}'
  and AssignDateTo gt '{start}'
  and IsActive eq true
  and X_AppointmentStatus ne 'CXL'
  and X_AppointmentStatus ne 'ABS'
```

### 3.3 計費連動（按需）

```
C_Order（銷售訂單 = 預約帳單）
  ├── C_BPartner_ID = 病患
  ├── IsSOTrx = true
  ├── C_DocTypeTarget_ID = Standard Order (SOO)
  ├── SalesRep_ID = 當前登入使用者（或指定業務）
  ├── M_PriceList_ID = 租戶的銷售價格表
  ├── C_PaymentTerm_ID = 付款條件
  │
  └── C_OrderLine
      ├── M_Product_ID = 資源自動產生的產品（ProductType=R，必須在 Price List 中有價格）
      ├── S_ResourceAssignment_ID = 預約佔位
      ├── QtyEntered = 1
      └── PriceEntered = 診療費用
```

> ⚠️ 資源對應的 M_Product 必須在 Price List 中有價格，否則 OrderLine 建立會失敗。Phase 0 需驗證。

### 3.4 不可用時段的限制與 Workaround

S_ResourceUnAvailable 的 DateFrom/DateTo 是**日期型態（無時間）**，只能表達整天不可用。

| 情境 | S_ResourceUnAvailable | Workaround |
|------|:---------------------:|------------|
| 王醫師 4/20~4/22 整天不在 | ✅ 直接使用 | — |
| 王醫師 4/20 下午不在 | ❌ 無法表達 | 建立佔位 Assignment（13:00~18:00, Name=「休診」） |
| A診間 4/25 早上維修 | ❌ 無法表達 | 建立佔位 Assignment（09:00~12:00, Name=「維修」） |

佔位 Assignment 使用一個專用狀態（如 BLK=封鎖），或直接用 SCH 狀態搭配特定 Name 前綴。

### 3.5 IsSingleAssignment 與同時段多人

S_ResourceType 的 `IsSingleAssignment` 控制是否允許同時段多筆預約：

| 設定 | 適用情境 |
|------|---------|
| IsSingleAssignment=Y | 醫師（同時只看一個病患）、手術室 |
| IsSingleAssignment=N | 團體治療室、候診區、共用設備 |

前端衝突檢測需依據資源所屬 ResourceType 的 IsSingleAssignment 判斷：
- Y → 同時段有佔位 assignment 即為衝突
- N → 不做衝突檢測（允許重疊）

### 3.4 Description 欄位結構

S_ResourceAssignment.Description 存放 JSON，用於前端解析：

```json
{
  "order_id": 456,
  "group_id": "uuid-xxx",
  "service": "洗牙",
  "notes": "患者備註"
}
```

| 欄位 | 必填 | 說明 |
|------|:----:|------|
| order_id | ❌ | 計費後回填 |
| group_id | ❌ | 合併預約的群組 UUID |
| service | ❌ | 服務項目名稱 |
| notes | ❌ | 備註 |

> 注意：bpartner_id 已改為 AD 自訂欄位（C_BPartner_ID），不再放 JSON。

### 3.5 三種預約情境

| 情境 | 需要 BPartner？ | 需要 C_Order？ |
|------|:-:|:-:|
| 新客預約諮詢（未消費） | ❌ | ❌ |
| 舊客預約回診 | ✅ 已存在 | ❌ 看完再建 |
| 看診完成要計費 | ✅ | ✅ 此時才建 |

### 3.6 欄位擴充策略

當預約需要記錄更多資訊時，依需求程度選擇：

| 層級 | 做法 | 適用情境 | 改動範圍 |
|------|------|---------|---------|
| 第一層 | 修改 Description JSON 結構 | 不需要查詢/過濾的欄位 | 只改 SPA |
| 第二層 | 透過 AD 加自訂欄位 | 需要 OData 查詢或型別驗證 | AD 設定 + SPA |
| 第三層 | 建自訂表（X_ClinicAppointment） | 大幅擴充（診療紀錄等） | AD + SPA + 可能加 Java |

原則：先用最輕的方式跑起來，等實際使用後再依需求升級。

## 四、Token 橋接與自動續期

### 4.1 初始 Token 產生

ZK Form Controller 在 server-side 取得當前使用者 context，產生 REST JWT token：

```
ZK Session
  → Env.getCtx() 取得 AD_User_ID, AD_Client_ID, AD_Role_ID, AD_Org_ID
  → Server-side 產生 REST token
  → 將 token + refresh_token 透過 iframe URL fragment 傳給 SPA
```

**Token 產生方案（依優先順序嘗試）：**

1. 查 iDempiere 原始碼是否有 programmatic token generation API
2. 自訂 REST endpoint：接受 AD_Session_ID 換發 token
3. Service Account：plugin 設定檔中配置帳密，server-side 呼叫 auth/tokens

### 4.2 自動續期機制

REST token 約 1 小時過期，但使用者的 ZK session 可能持續更久。透過 postMessage 實現透明續期：

```
SPA 偵測到 API 失敗（token 過期）
  → window.parent.postMessage({type: "refresh-token"})
  → ZK Form 收到訊息
  → Server-side 重新產生 token
  → ZK Form 透過 iframe.contentWindow.postMessage 回傳新 token
  → SPA 更新 token，自動重送失敗的請求
```

對使用者完全透明。只要 ZK session 活著，token 可無限續期。

## 五、使用者介面設計

### 5.1 主畫面佈局

```
┌─ 預約管理 ─────────────────────────────────────┐
│                                                │
│  左側面板              右側行事曆                 │
│  ┌──────────┐  ┌──────────────────────────┐    │
│  │ 🔍搜尋預約 │  │  [< 上週]  本週  [下週 >]  │    │
│  │ [       ] │  │  [日] [週] [月]          │    │
│  │           │  │                          │    │
│  │ 資源篩選   │  │  Mon  Tue  Wed  Thu  Fri │    │
│  │           │  │  ┌────┬────┬────┬────┐   │    │
│  │ 醫師 ▼    │  │  │    │    │🔵  │    │   │    │
│  │ ☑ 王醫師🔵│  │  │    │    │王小明│    │   │    │
│  │ ☑ 李醫師🟢│  │  │    │    │已確認│    │   │    │
│  │ ☐ 張醫師🟡│  │  ├────┼────┼────┼────┤   │    │
│  │           │  │  │🟡  │    │    │🟢  │   │    │
│  │ 診間 ▼    │  │  │李小姐│    │    │陳先生│   │    │
│  │ ☑ A診間🟠 │  │  │預約中│    │    │已報到│   │    │
│  │ ☐ B手術室🔴│  │  └────┴────┴────┴────┘   │    │
│  │           │  └──────────────────────────┘    │
│  │ 狀態圖例   │                                  │
│  │ 🟡預約中  │                                  │
│  │ 🔵已確認  │                                  │
│  │ 🟢已報到  │                                  │
│  │ 🟠看診中  │                                  │
│  │ ⚪已完成  │                                  │
│  │ 🔴爽約    │                                  │
│  │           │                                  │
│  │ ☐顯示已取消│                                  │
│  └──────────┘                                  │
└────────────────────────────────────────────────┘
```

### 5.2 操作流程

**新增預約：**
1. 點擊行事曆空白時段
2. 彈出 Dialog：輸入姓名（或搜尋病患）、選擇資源（可多選）、選擇服務項目、填寫備註
3. 選擇服務項目後自動計算結束時間（預設時長）
4. 儲存 → 建立 S_ResourceAssignment × N（預設狀態=「預約中」）

**變更狀態：**
1. 點擊已有事件
2. 在詳情面板中切換狀態（下拉選單）
3. 詳情面板顯示病患聯絡電話（從 C_BPartner 帶出）
4. 事件顏色即時更新

**複製到下週：**
1. 在預約詳情中點「複製到下週」
2. 系統建立一筆新 Assignment，日期 +7 天，其餘欄位相同
3. 適用於定期回診的病患（復健、矯正等）

**今日排程列表：**
1. 切換到日檢視時，可選擇「列表模式」
2. 顯示當天所有預約，依時間排序
3. 每筆顯示：時段、病患名、資源、狀態（可快速切換）
4. 適合櫃檯快速瀏覽和操作狀態流轉

**合併預約（多資源）：**
1. 新增預約時勾選多個資源（如：王醫師 + A診間）
2. 系統為每個資源建立一筆 Assignment，共用同一個 group_id
3. 行事曆上同一組預約有視覺關聯

**計費：**
1. 在預約詳情中點「建立帳單」
2. 系統建立 C_Order + C_OrderLine（帶 S_ResourceAssignment_ID）
3. 後續走標準 O2C 流程

**拖拉改時間：**
1. 拖拉事件到新時段
2. 前端檢查衝突
3. 無衝突 → PUT 更新 AssignDateFrom/AssignDateTo

## 六、API 呼叫清單

### 6.1 已驗證的 API 限制

| 限制 | 說明 | 應對方式 |
|------|------|---------|
| `ne` 運算子不支援 | 無法用 `Status ne 'CXL'` 排除 | 改用 `in ('SCH','CFM',...)` 正向列舉 |
| `lt`/`le` + datetime 有 bug | 帶時間的比較結果不正確 | 查詢用 date-only 範圍，時間比對在前端 JS 做 |
| `not()` 僅限部分函數 | 不能搭配 eq 使用 | 避免使用 |

### 6.2 查詢策略

行事曆切換檢視時，用 **date-only 範圍** 一次查回該期間所有 assignment，前端 JS 負責時間級別的過濾和衝突檢測。

| 檢視 | API 查詢 | 說明 |
|------|---------|------|
| 日檢視 | `AssignDateFrom ge '{date}' and AssignDateFrom lt '{date+1}'` | 查一天 |
| 週檢視 | `AssignDateFrom ge '{weekStart}' and AssignDateFrom lt '{weekStart+7}'` | 查一週 |
| 月檢視 | `AssignDateFrom ge '{monthStart}' and AssignDateFrom lt '{nextMonthStart}'` | 查一個月 |

每個已勾選的資源各發一次查詢（可並行）。回傳資料快取在前端，切換資源勾選時不需重新查詢。

### 6.3 衝突檢測（前端 JS）

不額外呼叫 API，直接用已載入的行事曆資料做判斷：

```javascript
// 從已載入的 assignment 中篩選衝突
const conflicts = assignments.filter(a =>
  a.S_Resource_ID === targetResourceId &&
  a.AssignDateFrom < desiredEnd &&
  a.AssignDateTo > desiredStart &&
  !['CXL', 'ABS'].includes(a.X_AppointmentStatus)
);
```

### 6.4 API 端點清單

| 操作 | Method | Endpoint | 說明 |
|------|--------|----------|------|
| 載入資源類型 | GET | `S_ResourceType?$filter=IsActive eq true` | 左側分類 |
| 載入資源清單 | GET | `S_Resource?$filter=IsActive eq true&$orderby=Name` | 左側列表 |
| 載入狀態定義 | GET | `AD_Ref_List?$filter=AD_Reference_ID eq {ref_id}&$orderby=Value` | 狀態 + 顏色 |
| 查詢預約 | GET | `S_ResourceAssignment?$filter=S_Resource_ID eq {id} and AssignDateFrom ge '{rangeStart}' and AssignDateFrom lt '{rangeEnd}'` | date-only 範圍 |
| 查詢不可用 | GET | `S_ResourceUnAvailable?$filter=S_Resource_ID eq {id} and DateFrom le '{rangeEnd}' and DateTo ge '{rangeStart}'` | 灰色封鎖區 |
| 建立預約 | POST | `S_ResourceAssignment` | 新增事件 |
| 更新預約 | PUT | `S_ResourceAssignment/{id}` | 改時間/狀態 |
| 刪除預約 | DELETE | `S_ResourceAssignment/{id}` | 僅用於誤建，正常取消走狀態變更 |
| 搜尋預約 | GET | `S_ResourceAssignment?$filter=contains(Name,'{keyword}')&$orderby=AssignDateFrom desc&$top=20` | 速查客戶預約 |
| 搜尋病患 | GET | `C_BPartner?$filter=contains(Name,'{keyword}') and IsCustomer eq true&$top=10` | 病患選擇 |
| 建立帳單 | POST | `C_Order` + `C_OrderLine` | 計費 |
| 完成帳單 | POST | `processes/c_order-process` | DocAction=CO |

## 七、Plugin 結構

```
com.mxp.idempiere.appointments/
├── META-INF/MANIFEST.MF
├── OSGI-INF/
│   └── component.xml
├── src/com/mxp/appointments/
│   ├── AppointmentForm.java            ← CustomForm（iframe 容器）
│   ├── AppointmentFormController.java  ← IFormController（token 橋接 + 續期）
│   └── FormFactory.java               ← Incremental2PackActivator + FormFactory
├── migration/
│   └── 001_appointment_ad_setup.sql  ← AD 設定 SQL（Reference + Column + Ref_List）
├── web/appointments/
│   ├── index.html                      ← SPA 入口
│   ├── app.js                          ← 主邏輯 + FullCalendar（slotDuration=15min）
│   ├── api.js                          ← iDempiere REST 封裝 + token 管理
│   └── style.css                       ← 樣式
└── build.properties
```

### 2Pack / Migration 自動設定

iDempiere 的 Incremental2PackActivator 需要 `META-INF/2Pack_[version].zip` 格式（由 PackOut 工具產生）。
由於 2Pack ZIP 必須透過 iDempiere UI 的 PackOut 視窗匯出，本專案提供 SQL migration 腳本作為替代：

**首次部署步驟：**
1. 執行 `migration/001_appointment_ad_setup.sql` 建立 AD 設定
2. 重啟 iDempiere（或清除 cache）讓 REST API 認識新欄位
3. （可選）在 iDempiere 中用 PackOut 匯出這些 AD 變更，產生正式的 2Pack ZIP 供後續自動部署

**SQL 腳本建立的內容：**

| 項目 | 內容 |
|------|------|
| AD_Reference | X_AppointmentStatus（List 型態） |
| AD_Ref_List × 7 | SCH/CFM/CHK/INP/DON/ABS/CXL（含顏色 hex code） |
| AD_Column | S_ResourceAssignment.X_AppointmentStatus |
| AD_Column | S_ResourceAssignment.C_BPartner_ID（Table Direct） |
| DB | ALTER TABLE 新增實際欄位（冪等） |

所有 INSERT 使用 UUID 做冪等檢查（WHERE NOT EXISTS），可安全重複執行。

### 程式碼量預估

| 部分 | 檔案數 | 行數 | 說明 |
|------|:------:|:----:|------|
| Java（ZK 薄殼） | 3 | ~100 | iframe wrapper + token 橋接/續期 + 2Pack activator |
| 2Pack XML | 1 | ~200 | AD 自動設定（Reference + Column + Ref_List） |
| SPA（行事曆） | 3 | ~700 | FullCalendar + API + Dialog + 狀態管理 + 今日列表 |
| 合計 | 7 | ~1000 | |

### FullCalendar 設定

| 設定 | 值 | 說明 |
|------|-----|------|
| slotDuration | 00:15:00 | 最小時間粒度 15 分鐘 |
| slotMinTime | 依 ResourceType.TimeSlotStart | 行事曆起始時間 |
| slotMaxTime | 依 ResourceType.TimeSlotEnd | 行事曆結束時間 |
| views | dayGridMonth, timeGridWeek, timeGridDay, listDay | 月/週/日/今日列表 |

## 八、通用性設計

### 8.1 租戶無關

- 程式碼中零硬編碼 ID
- SPA 動態查詢資源和狀態定義
- REST API 自動依登入者的 AD_Client_ID 過濾資料
- 同一個 plugin 可部署到任何租戶

### 8.2 各租戶自行設定

| 設定項目 | 設定方式 |
|---------|---------|
| 資源類型（醫師/診間/...） | iDempiere 後台建立 S_ResourceType |
| 個別資源（王醫師/A診間/...） | iDempiere 後台建立 S_Resource |
| 預約狀態與顏色 | iDempiere 後台編輯 AD_Ref_List |
| 工作日與時段 | S_ResourceType 的 OnMonday~OnSunday + TimeSlotStart/End |
| 服務項目與預設時長 | SPA 設定檔（JSON），各租戶可自訂 |
| 同時段是否允許多人 | S_ResourceType 的 IsSingleAssignment |

## 九、實作階段

| 階段 | 內容 | 預估工作量 |
|------|------|-----------|
| Phase 0 | 資料模型驗證：建立主檔 + API 跑通基礎預約 CRUD + 計費流程 | 0.5 天 |
| Phase 1 | Plugin 骨架：OSGi bundle + 2Pack 自動建欄位 + ZK Form + token 橋接/續期 | 1.5 天 |
| Phase 2 | SPA MVP：FullCalendar 日/週/月檢視 + 單資源預約 CRUD + 狀態顏色 + 搜尋 + 今日排程列表 | 2.5 天 |
| Phase 3 | 完整功能：多資源合併預約 + 病患搜尋/聯絡資訊 + 衝突檢測 + 計費 + 預設時長 + 複製到下週 | 2.5 天 |
| Phase 4 | 體驗優化：拖拉改時間 + 不可用顯示 + 響應式 | 1 天 |

## 十、明確排除（不做的事）

- ❌ 不寫 Event Handler（診所規模不需要伺服器端衝突檢測）
- ❌ 不寫自訂 REST endpoint（標準 API 夠用，除非 token 橋接需要）
- ❌ 不做簡訊/Email 通知（未來可加）
- ❌ 不做權限控管（依 iDempiere 原生角色權限）
- ❌ 不做預約間緩衝時間（未來可加）
- ❌ 不做列印/匯出排程表（未來可加）

## 十一、風險與緩解

| 風險 | 影響 | 緩解 |
|------|------|------|
| Token 橋接無法從 ZK session 直接產生 | 阻塞 Phase 1 | 備案：自訂 REST endpoint 或 Service Account |
| 併發預約衝突（race condition） | 極低（診所規模） | 前端查詢檢測，未來可加 Event Handler |
| iDempiere 升版影響 plugin | 低 | Java 程式碼極少（~100 行），REST API 有相容性保證 |
| FullCalendar 授權 | 無（MIT License） | 開源免費 |
