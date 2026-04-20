---
name: appointment-project
description: iDempiere Appointment Management Plugin 專案開發規範
---

# Appointment Plugin 開發規範

## Build & Run

- SPA build: `cd spa && npm run build`
- Java build: `mvn verify -Didempiere.core.repository.url=file:///path/to/p2/repository`
- Deploy (SPA only, no restart): `cp -r web/appointments/* $BD/web/appointments/`
- Deploy (Java): `cp target/classes/com/mxp/appointments/*.class $BD/com/mxp/appointments/ && systemctl restart idempiere`
- Full deploy: snapshot restore → git clone → mvn verify → exploded bundle → bundles.info → clear OSGi cache → restart

## Architecture Boundaries

```
AppointmentFormController  → ZK Form 容器，token 橋接，zoom 橋接
AppointmentForm            → iframe wrapper，不放邏輯
AuthFilter                 → JWT 驗證，設 request attribute（client/org/user）
AuthContext                → 從 request 讀 client/org/user 的共用 helper
TokenServlet               → AD_Session_ID → JWT，不信任前端傳的 org
*Servlet (Book/Update/...) → 業務邏輯，每個 servlet 自己做租戶驗證
ConflictCheck              → 共用衝突檢測
ResourceScheduleCheck      → 共用排程驗證
AppointmentActivator       → migration + syncColumns，不放業務邏輯
spa/src/
  api.ts                   → 所有 API 呼叫集中，apptFetch 統一帶 token
  hooks/useAppState.ts     → 集中狀態管理，groupAssignments 分組邏輯
  components/              → 純 UI，不直接呼叫 API（透過 props callback）
```

- Servlet 只做自己的 CRUD，不跨 servlet 呼叫
- 前端 components 不直接呼叫 api.ts，透過 useAppState 的 callback
- AuthFilter 以外不做 JWT 解碼

## 知識庫

- 開始開發前，先載入 iDempiere ERP 知識庫和 Skills 知識庫，掌握細節與對齊認知
- 更新知識庫內容前，必須先向使用者說明變更內容並取得同意

## 多租戶隔離（零容忍）

- 所有讀取查詢帶 `AD_Client_ID` 過濾，無例外
- 所有寫入操作驗證記錄的 `AD_Client_ID` 與 token 一致
- `AD_Client_ID`、`AD_Org_ID`、`AD_User_ID` 從 JWT 解碼取得，不信任前端傳入的值
- `AD_Org_ID` 從 `AD_Session` 表讀取，不用 `Env.getAD_Org_ID()`（不可靠）

## 操作者追蹤

- 所有 DB 寫入（新增/更新/刪除）必須記錄實際操作者
- Model 寫入（`saveEx`/`deleteEx`）：寫入前 `Env.setContext(ctx, "#AD_User_ID", AuthContext.getUserId(req))`
- Raw SQL 寫入：明確帶 `CreatedBy=?` / `UpdatedBy=?` 參數
- 不寫死 `100`（SuperUser）

## 不寫死會變動的值

- Client ID、Org ID → 從 `AuthContext` 取
- Port、Host → 從 `Executions.getCurrent()` 或 request 取
- UOM ID → 用 `WHERE Name='Hour'` 查，不寫死 `101`
- Mandatory FK（`M_Product_Category_ID`、`C_TaxCategory_ID`）→ 查該 client 的第一個可用值

## 資料關聯

- 關聯欄位存 Value code 或 FK ID，不存顯示名稱
- 顯示時 JOIN 查當前名稱，改名不影響歷史記錄
- 為統計設計：專用 AD_Column 優於 Description JSON

## 資源可預約性

- 前端（InitServlet）：只回傳 `IsTimeSlot='Y'` 的類型 + `IsAvailable='Y'` 的資源
- 後端（BookServlet）：驗證 `IsActive`、`IsAvailable`、`IsTimeSlot`
- 排程驗證：營業日（OnMonday~OnSunday）+ 營業時段（TimeSlotStart/End）

## 用詞

- 通用化，不綁定特定行業（不用「病患」「醫師」「診間」）
- 中性詞：客戶、資源、服務、已到場、進行中、未到

## 先查證再實作

- 使用 iDempiere API 前，查原始碼確認正確用法
- 使用欄位前，查 `information_schema.columns` 確認存在
- 不猜 URL 格式、事件格式、資料結構

## Collaboration

- 語言：繁體中文溝通，commit message 用英文 conventional commits
- 功能性變更先討論方案和 tradeoff，確認方向後再實作
- 簡單 bug fix 或明確指令可直接動手
- 完成後主動審視：有沒有其他 servlet 需要同步改、有沒有遺漏的驗證

## NEVER

- 在 Servlet 裡信任前端傳入的 AD_Client_ID / AD_Org_ID / AD_User_ID
- 用 `Env.getAD_Org_ID()` 產生 JWT 或做安全決策
- 用 `update-prd.sh` 部署（會破壞 REST API）
- 用 `nextval('sequence')` 產生 ID（用 `DB.getNextID()`）
- 寫死 client ID、port、UOM ID 等環境相關值
- 更新知識庫內容未經使用者確認

## ALWAYS

- 改完 Java 後 `mvn verify` 確認編譯
- 改完 SPA 後 `npm run build` 確認建置
- 新增 Servlet 時同步更新 `WEB-INF/web.xml`
- 新增 AD_Column 時同步更新 `AppointmentActivator.syncColumns()`
- 寫入操作加 `Env.setContext(ctx, "#AD_User_ID", ...)` 和 `UpdatedBy`
- 新增 API endpoint 時確認 AuthFilter 覆蓋範圍

## Completeness Checklist

每次改動完成後檢查：

- [ ] migration SQL：新增欄位/表有對應的 AD_Element + AD_Column + syncColumns
- [ ] web.xml：新增 Servlet 有註冊
- [ ] api.ts：新增 endpoint 有對應的 typed function
- [ ] types.ts：新增欄位有對應的 TypeScript type
- [ ] README.md：架構或功能有變時同步
- [ ] steering：設計原則有變時同步
- [ ] 知識庫：踩坑或新模式需記錄時，先向使用者提出

## Verification

| 變更範圍 | 必須通過 |
|----------|---------|
| Java 檔案 | `mvn verify -q` 編譯成功 |
| SPA 檔案 | `npm run build` 無 TS error |
| 新增 AD_Column | psql 確認 DB 欄位存在 |
| 新增 Servlet | curl 確認 endpoint 回應正確 |
| 租戶相關 | 無 token → 401、有 token → 正確過濾 |
| 里程碑 | 快照還原 → clone → build → deploy → 功能驗收 |

## 部署

- 使用手動 exploded bundle + `bundles.info`，不用 `update-prd.sh`（會破壞 REST API）
- SPA 靜態檔更新不需重啟 iDempiere
- Java class 更新需要重啟
- 首次安裝需清 OSGi cache：`rm -rf configuration/org.eclipse.osgi`
