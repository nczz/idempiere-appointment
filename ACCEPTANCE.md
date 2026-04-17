# 診所預約管理系統 — 驗收規格表

> 對應文件：[DESIGN.md](./DESIGN.md)
> 建立日期：2026-04-17

每個階段列出具體驗收項目。每項標記 `[ ]` 待驗收 / `[x]` 通過。

---

## Phase 0：資料模型驗證

> 目標：確認 iDempiere 資源模組的標準 API 可以支撐預約流程的基礎操作。
> 注意：自訂欄位（X_AppointmentStatus、C_BPartner_ID）由 Phase 1 的 2Pack 自動建立，Phase 0 先用標準欄位驗證。

### 0.1 主檔建立

- [x] 建立 S_ResourceType「醫師」：IsSingleAssignment=Y, IsTimeSlot=Y, TimeSlotStart=09:00, TimeSlotEnd=18:00, OnMonday~OnSaturday=Y, OnSunday=N
- [x] 建立 S_ResourceType「診間」：同上設定
- [x] 建立 S_Resource「王醫師」：歸屬「醫師」類型，IsAvailable=Y
- [x] 建立 S_Resource「A診間」：歸屬「診間」類型，IsAvailable=Y
- [x] 確認系統自動產生對應的 M_Product（ProductType=R）
- [x] 確認 M_Product 歸屬正確的 M_Product_Category（來自 ResourceType）
- [x] 確認 M_Product 在 Price List 中有價格（若無，手動加入並記錄步驟）

> 驗證結果：ResourceType 醫師(1000000)、診間(1000001)。Resource 王醫師(1000000)、A診間(1000001)。M_Product 自動產生(1000002, 1000003, ProductType=R)。M_Product 預設無價格，已手動加入 Standard PriceList Version(104)。Time 欄位需帶 Z 後綴。

### 0.2 預約 CRUD

- [x] POST S_ResourceAssignment 建立預約：指定 S_Resource_ID、AssignDateFrom/To、Name
- [x] GET 查詢該資源的預約清單，確認預約存在
- [x] PUT 更新預約時間（修改 AssignDateFrom/To），確認更新成功
- [x] PUT 更新 IsConfirmed=true，確認狀態變更
- [x] DELETE 刪除預約，確認已移除

### 0.3 衝突檢測查詢

- [x] 建立一筆 09:00~10:00 的預約（狀態 SCH）
- [x] 用 date-only 範圍查詢當天所有 assignment，確認能查到該筆
- [x] 前端 JS 判斷 08:30~09:30 與 09:00~10:00 重疊，確認邏輯正確
- [x] 前端 JS 判斷 10:00~11:00 與 09:00~10:00 不重疊（邊界），確認邏輯正確
- [x] 將該預約狀態改為 CXL，前端 JS 排除 CXL 後判斷無衝突
- [x] 在同一時段建立新預約，確認成功（覆蓋預約）

> 驗證結果：date-only 範圍查詢正常。JS 重疊判斷 4/4 通過。注意：lt/le + datetime 有 bug，必須用 date-only 查詢 + 前端 JS 過濾。IsActive filter 行為不如預期，實際用 X_AppointmentStatus 做狀態過濾。

### 0.4 合併預約

- [x] 為同一時段建立兩筆 Assignment（王醫師 + A診間），Description 帶相同 group_id
- [x] 查詢兩個資源的 Assignment，確認各自獨立存在
- [x] 透過 group_id 可以關聯出同一組預約

> 驗證結果：contains(Description, group_id) 可正確關聯查詢出 2 筆。

### 0.5 計費連動

- [x] 確認資源對應的 M_Product 在 Price List 中有價格
- [x] 建立 C_BPartner（測試病患）
- [x] 建立 C_Order（IsSOTrx=true, C_BPartner_ID=測試病患, SalesRep_ID, M_PriceList_ID, C_PaymentTerm_ID）
- [x] 建立 C_OrderLine：M_Product_ID=資源對應產品, S_ResourceAssignment_ID=預約 ID
- [x] 完成訂單（DocAction=CO），確認成功
- [x] 回填 Assignment 的 Description 中 order_id，確認更新成功

> 驗證結果：Assignment(1000006) → Order(1000004) → OrderLine(1000003) → CO 成功。用 SuperUser(100) 作為 SalesRep 在 GardenWorld 可 CO。C_Currency_ID=100(USD)。

---

## Phase 1：Plugin 骨架

> 目標：OSGi bundle 可部署，2Pack 自動建立自訂欄位，ZK Form 可從選單開啟，iframe 載入 SPA 並取得有效 token，token 可自動續期。

### 1.1 OSGi Bundle

- [ ] Plugin 專案結構建立完成（META-INF, OSGI-INF, src, 2pack, web）
- [ ] MANIFEST.MF 正確宣告 bundle 資訊與依賴
- [ ] build.properties 包含 2pack/ 和 web/ 目錄

### 1.2 2Pack 自動設定

- [ ] Plugin 首次啟動時自動建立 AD_Reference「X_AppointmentStatus」
- [ ] 自動建立 AD_Ref_List 項目：SCH/CFM/CHK/INP/DON/ABS/CXL（含顏色 hex code）
- [ ] 自動建立 AD_Column「X_AppointmentStatus」on S_ResourceAssignment
- [ ] 自動建立 AD_Column「C_BPartner_ID」on S_ResourceAssignment（Table Direct）
- [ ] DB 欄位自動建立（ALTER TABLE）
- [ ] 透過 REST API GET S_ResourceAssignment 確認 X_AppointmentStatus 可讀寫
- [ ] 透過 REST API GET S_ResourceAssignment 確認 C_BPartner_ID 可讀寫
- [ ] 透過 REST API GET `S_ResourceAssignment?$filter=C_BPartner_ID eq {id}` 確認可查詢
- [ ] 透過 REST API GET AD_Ref_List 可查詢狀態清單和顏色
- [ ] Plugin 重啟時不重複建立（冪等性）

### 1.2 ZK Form 註冊

- [ ] FormFactory 正確註冊，iDempiere 啟動後可辨識
- [ ] 在 iDempiere 中建立 Form 類型的選單項目「預約管理」
- [ ] 從選單點擊「預約管理」，ZK Form 正確開啟

### 1.3 Token 橋接

- [ ] ZK Form Controller 可取得當前使用者的 context（AD_Client_ID, AD_Role_ID 等）
- [ ] 成功產生有效的 REST API JWT token
- [ ] Token 透過 URL fragment 傳遞給 iframe（不出現在 server log）

### 1.4 Token 自動續期

- [ ] SPA 偵測到 token 過期（API 回傳失敗）
- [ ] SPA 透過 postMessage 向 ZK Form 請求新 token
- [ ] ZK Form 收到請求後 server-side 重新產生 token
- [ ] ZK Form 透過 postMessage 回傳新 token 給 SPA
- [ ] SPA 更新 token 後自動重送失敗的請求
- [ ] 整個續期過程對使用者透明（無中斷感）

### 1.5 SPA 載入

- [ ] iframe 正確載入 web/appointments/index.html
- [ ] SPA 可從 URL fragment 讀取 token
- [ ] SPA 用 token 呼叫 GET S_ResourceType，確認回傳正常
- [ ] iframe 填滿 ZK Form 的可用空間（無多餘捲軸或空白）

---

## Phase 2：SPA 行事曆 MVP

> 目標：單資源預約的完整 CRUD，狀態顏色顯示，可用的行事曆介面。

### 2.1 行事曆基礎

- [ ] FullCalendar 正確渲染日檢視（Day View）
- [ ] FullCalendar 正確渲染週檢視（Week View）
- [ ] FullCalendar 正確渲染月檢視（Month View）
- [ ] 可切換日/週/月檢視
- [ ] 日/週/月檢視可前後導航
- [ ] 日/週檢視顯示時間軸（依 ResourceType 的 TimeSlotStart/End 設定）
- [ ] 月檢視以事件條顯示預約（顯示 Name + 狀態顏色）
- [ ] 切換檢視時自動查詢對應日期範圍的資料（date-only 範圍查詢）

### 2.2 資源面板

- [ ] 左側顯示資源清單，依類型分組（醫師、診間）
- [ ] 每個資源有獨立顏色標記
- [ ] 勾選/取消勾選資源，行事曆即時顯示/隱藏對應事件
- [ ] 預設全部勾選

### 2.3 狀態圖例

- [ ] 左側面板底部顯示狀態圖例（從 AD_Ref_List 動態載入）
- [ ] 每個狀態顯示名稱 + 對應顏色色塊
- [ ] 診所在 iDempiere 後台修改狀態/顏色後，SPA 重新載入即反映

### 2.4 查詢預約

- [ ] 切換週次時，自動查詢該週所有已勾選資源的 Assignment
- [ ] 事件顏色依 X_AppointmentStatus 對應的顏色顯示
- [ ] 無狀態的事件 fallback 到資源顏色
- [ ] 事件顯示 Name 文字（如「王小明 - 洗牙」）
- [ ] 多個資源的事件可疊合顯示

### 2.5 新增預約

- [ ] 點擊行事曆空白時段，彈出新增 Dialog
- [ ] Dialog 預填點擊的日期和時段
- [ ] 可輸入姓名（自由文字）
- [ ] 可選擇資源（單選，從已勾選的資源中選）
- [ ] 可選擇服務項目，選擇後自動計算結束時間（預設時長）
- [ ] 預設狀態為「預約中」（SCH）
- [ ] 儲存後，行事曆即時顯示新事件（狀態顏色正確）
- [ ] API 呼叫失敗時顯示錯誤訊息

### 2.6 檢視/編輯預約

- [ ] 點擊已有事件，顯示詳情（姓名、資源、時段、狀態、備註）
- [ ] 可修改時段（手動輸入）
- [ ] 可切換狀態（下拉選單，選項從 AD_Ref_List 載入）
- [ ] 狀態變更後事件顏色即時更新
- [ ] 儲存後行事曆即時更新

### 2.7 取消預約

- [ ] 詳情面板中有「取消預約」按鈕
- [ ] 點擊後確認提示
- [ ] 確認後將狀態改為 CXL（不刪除 Assignment）
- [ ] 行事曆上該事件變為取消顏色（或隱藏，依 toggle 設定）
- [ ] 該時段可直接建立新預約（覆蓋預約，無衝突提示）

### 2.8 顯示/隱藏已取消

- [ ] 左側面板有「顯示已取消」toggle，預設關閉
- [ ] 開啟時，已取消/爽約的事件以淡色顯示在行事曆上
- [ ] 關閉時，已取消/爽約的事件完全隱藏

### 2.9 搜尋預約

- [ ] 左側面板頂部有搜尋框，輸入客戶名稱可即時查詢
- [ ] 搜尋結果以列表顯示（日期、時段、客戶名、資源、狀態顏色）
- [ ] 結果依日期降序排列（最近的在前）
- [ ] 點擊搜尋結果，行事曆自動跳轉到該預約的日期並高亮該事件
- [ ] 清空搜尋框後回到正常行事曆檢視

### 2.10 今日排程列表

- [ ] 日檢視下可切換「列表模式」
- [ ] 列表依時間排序顯示當天所有預約
- [ ] 每筆顯示：時段、病患名、資源名、狀態色塊
- [ ] 可在列表中直接切換狀態（下拉選單），即時更新
- [ ] 點擊列表項目可展開詳情

---

## Phase 3：完整功能

> 目標：多資源合併預約、病患搜尋、衝突檢測、計費連動。

### 3.1 多資源合併預約

- [ ] 新增 Dialog 可選擇多個資源（如：王醫師 + A診間）
- [ ] 儲存時為每個資源建立獨立的 Assignment，共用 group_id
- [ ] 行事曆上同一組預約有視覺關聯（相同標記或邊框）
- [ ] 取消合併預約時，提示是否一併取消所有關聯資源的佔位
- [ ] 修改合併預約的時間時，所有關聯 Assignment 同步更新
- [ ] 修改合併預約的狀態時，所有關聯 Assignment 同步更新

### 3.2 病患搜尋與聯絡資訊

- [ ] 新增 Dialog 中可搜尋 C_BPartner（模糊搜尋 Name）
- [ ] 搜尋結果顯示病患名稱，可點選帶入
- [ ] 選擇病患後，C_BPartner_ID 寫入 Assignment 的 AD 自訂欄位
- [ ] 也可不選病患，直接輸入姓名（新客情境）
- [ ] 預約詳情面板顯示病患電話（從 C_BPartner 或 AD_User 帶出）

### 3.3 衝突檢測

- [ ] 新增預約前，前端用已載入的行事曆資料做時段重疊判斷（排除 CXL/ABS）
- [ ] IsSingleAssignment=Y 的資源：同時段有佔位 assignment 即為衝突
- [ ] IsSingleAssignment=N 的資源：不做衝突檢測（允許重疊）
- [ ] 有衝突時，顯示衝突的預約資訊（誰、什麼時段）
- [ ] 阻止儲存，直到使用者修改時段
- [ ] 拖拉改時間時也觸發衝突檢測
- [ ] 已取消/爽約的時段上可直接建立新預約，不觸發衝突

### 3.4 計費連動

- [ ] 預約詳情中有「建立帳單」按鈕（僅狀態為 DON 時可用）
- [ ] 點擊後建立 C_Order + C_OrderLine（帶 S_ResourceAssignment_ID）
- [ ] 帳單建立成功後，Assignment 的 Description 回填 order_id
- [ ] 已建立帳單的預約，顯示「已計費」標記
- [ ] 「建立帳單」按鈕在已計費的預約上不可用

### 3.5 不可用時段

- [ ] 查詢 S_ResourceUnAvailable，在行事曆上以灰色區塊顯示
- [ ] 不可用時段內不允許建立預約（前端阻擋）

### 3.6 預設看診時長

- [ ] SPA 設定檔定義服務項目與預設時長對照（如：洗牙=30min, 植牙=90min）
- [ ] 新增預約選擇服務項目後，自動計算 AssignDateTo
- [ ] 可手動覆蓋自動計算的結束時間

### 3.7 複製到下週

- [ ] 預約詳情中有「複製到下週」按鈕
- [ ] 點擊後建立新 Assignment，日期 +7 天，其餘欄位相同
- [ ] 新預約狀態為 SCH（預約中）
- [ ] 建立前檢查目標時段是否有衝突

---

## Phase 4：體驗優化

> 目標：拖拉操作、響應式佈局、整體體驗打磨。

### 4.1 拖拉操作

- [ ] 可拖拉事件到新時段（改時間）
- [ ] 拖拉前檢查衝突
- [ ] 拖拉後自動 PUT 更新 AssignDateFrom/AssignDateTo
- [ ] 可拖拉事件底部邊緣調整時長（resize）

### 4.2 響應式佈局

- [ ] 平板橫向：左側面板 + 右側行事曆正常顯示
- [ ] 平板直向：左側面板可收合，行事曆佔滿寬度
- [ ] iframe 內 SPA 自適應容器大小

### 4.3 體驗細節

- [ ] 載入中顯示 loading 指示器
- [ ] API 錯誤統一處理（toast 通知）
- [ ] Token 續期失敗時提示使用者重新整理頁面
- [ ] 今天的日期在行事曆上有視覺標記
- [ ] 當前時間線（紅色橫線）顯示在行事曆上

---

## 非功能性驗收

| 項目 | 標準 |
|------|------|
| 部署 | 單一 OSGi bundle，放入 iDempiere plugins 目錄即可啟用 |
| 通用性 | 程式碼零硬編碼 ID，可部署到任何租戶 |
| 相容性 | iDempiere 12 + REST API v1 |
| 瀏覽器 | Chrome/Edge 最新版（診所環境） |
| 效能 | 週檢視載入 < 2 秒（10 個資源、每週 50 筆預約以內） |
| 效能 | 月檢視載入 < 3 秒（10 個資源、每月 200 筆預約以內） |
| 安全 | Token 不出現在 URL query string 或 server log |
| 授權 | 所有依賴皆 MIT/Apache 2.0 相容 |
| 狀態可設定 | 診所可在 iDempiere 後台自行增刪改預約狀態和顏色，不需改程式碼 |

---

## 端到端情境測試（Phase 3 完成後整合驗收）

> 目標：驗證完整使用者旅程，確認功能之間正確串接。

### E2E-1 新客完整流程

- [ ] 新客來電 → 輸入姓名建立預約（無 BPartner）→ 狀態 SCH
- [ ] 電話確認 → 狀態改為 CFM → 行事曆顏色更新
- [ ] 當天報到 → 狀態改為 CHK
- [ ] 進入診間 → 狀態改為 INP
- [ ] 看診結束 → 狀態改為 DON
- [ ] 建立 C_BPartner（正式成為客戶）→ 回填 Assignment 的 C_BPartner_ID
- [ ] 點擊「建立帳單」→ C_Order + C_OrderLine 建立成功
- [ ] 完成訂單（DocAction=CO）→ 確認成功
- [ ] 預約顯示「已計費」標記

### E2E-2 取消後重新預約

- [ ] 建立預約（09:00~10:00, 王醫師）
- [ ] 取消預約 → 狀態改為 CXL
- [ ] 確認原記錄仍存在（CXL 狀態，所有原始資料完整）
- [ ] 在同一時段（09:00~10:00, 王醫師）建立新預約 → 無衝突，建立成功
- [ ] 新預約正常走完狀態流程至 DON

### E2E-3 多資源合併全流程

- [ ] 選擇王醫師 + A診間，建立合併預約（09:00~10:00）
- [ ] 行事曆上兩個資源都顯示該預約，有視覺關聯
- [ ] 修改時間為 10:00~11:00 → 兩筆 Assignment 同步更新
- [ ] 修改狀態為 CFM → 兩筆 Assignment 同步更新
- [ ] 取消預約 → 提示是否一併取消 → 確認 → 兩筆都變 CXL
- [ ] 兩個資源的 09:00~10:00 和 10:00~11:00 時段都已釋放

### E2E-4 定期回診

- [ ] 建立預約（週三 09:00, 王醫師, 病患=陳先生）
- [ ] 點擊「複製到下週」→ 下週三 09:00 建立新預約
- [ ] 再次「複製到下週」→ 下下週三 09:00 建立新預約
- [ ] 三筆預約各自獨立，可各自操作狀態
- [ ] 取消其中一筆不影響其他兩筆

### E2E-5 搜尋到跳轉

- [ ] 建立多筆不同日期的預約（同一病患名）
- [ ] 在搜尋框輸入病患名 → 結果列表顯示所有相關預約
- [ ] 點擊較早日期的結果 → 行事曆跳轉到該日期並高亮事件
- [ ] 點擊較晚日期的結果 → 行事曆跳轉到該日期並高亮事件

---

## 異常處理驗收（Phase 2~4 各階段持續驗收）

> 目標：確認系統在異常情況下的行為合理，不會造成資料損壞或使用者困惑。

### ERR-1 API 失敗處理

- [ ] 多資源預約時第二筆 API 失敗 → 回滾第一筆（刪除已建立的 Assignment），顯示錯誤訊息
- [ ] 儲存過程中 token 過期 → 自動續期後重送，使用者無感
- [ ] 網路中斷時儲存 → 顯示明確錯誤訊息，Dialog 保持開啟，資料不遺失
- [ ] 拖拉改時間後 API 失敗 → 事件回到原位，顯示錯誤訊息

### ERR-2 輸入容錯

- [ ] 搜尋輸入特殊字元（'、"、%）→ 不報錯，正確 escape 後查詢
- [ ] Description JSON 格式損壞 → 前端容錯，不影響行事曆顯示，詳情面板顯示原始文字
- [ ] Name 欄位輸入超長文字 → 行事曆事件正常顯示（截斷），詳情面板顯示完整

### ERR-3 Token 異常

- [ ] Token 續期失敗（ZK session 已過期）→ 提示使用者重新整理頁面
- [ ] 初始 token 無效 → SPA 顯示明確錯誤，不顯示空白行事曆

---

## 邊界條件驗收（Phase 2~4 各階段持續驗收）

> 目標：確認系統在邊界情況下的行為正確。

### BND-1 工作時間邊界

- [ ] 嘗試在工作時間外建立預約（如 07:00 或 19:00）→ 前端警告或阻擋
- [ ] 嘗試在非工作日建立預約（如週日，OnSunday=N）→ 前端警告或阻擋
- [ ] 預約跨越工作時間結束（如 17:30~18:30）→ 前端警告

### BND-2 資源狀態邊界

- [ ] 資源被停用（IsActive=false）→ 左側面板不再顯示該資源
- [ ] 停用資源的已存在預約 → 行事曆上仍可見（但不可新增）
- [ ] IsSingleAssignment=N 的資源 → 同一時段可建立多筆預約，行事曆正確疊合顯示

### BND-3 顯示邊界

- [ ] 行事曆無任何預約（空狀態）→ 顯示正常，不報錯
- [ ] 單日大量預約（20+ 筆）→ 行事曆可讀，可捲動或收合
- [ ] 視窗大小變化（iframe resize）→ SPA 自適應，不出現異常捲軸
