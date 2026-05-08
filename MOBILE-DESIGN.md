# 手機版預約管理介面 — 詳細設計文件

> 建立日期：2026-05-07
> 狀態：已實作（手機 + 平板適配）
> 對應桌面版：現有 FullCalendar SPA（不修改）

## 一、設計目標

將預約管理系統的完整功能以 mobile-first 思維重新設計 UI 層，達成：

1. **功能完全對齊** — 桌面版能做的，手機版都能做
2. **觸控優先** — 所有互動針對手指操作優化（最小觸控目標 44×44px）
3. **單手可操作** — 核心操作（查看、改狀態）單手拇指可完成
4. **零學習成本** — 遵循 iOS/Android 原生 app 的互動慣例
5. **不影響桌面版** — 純增量，桌面版程式碼不動

## 二、架構策略

### 2.1 一個外掛核心，兩套 UI Shell

```
┌─────────────────────────────────────────┐
│  Java Servlets（100% 共用）              │
│  /appointment/init, /events, /book...   │
└────────────────────┬────────────────────┘
                     │ JSON + JWT
┌────────────────────┴────────────────────┐
│  React 共用核心（100% 共用）             │
│  api.ts / types.ts / useAppState.ts     │
└──────────┬──────────────────┬───────────┘
           │                  │
┌──────────┴─────┐  ┌────────┴──────────┐
│ DesktopLayout  │  │  MobileLayout     │
│ (現有元件)      │  │  (新元件)          │
└────────────────┘  └───────────────────┘
```

### 2.2 裝置偵測與路由

```tsx
// App.tsx — 斷點邏輯
const isMobile = window.innerWidth < 1024;
const isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;

// 使用 React.lazy 做 code splitting
const Layout = isMobile
  ? lazy(() => import('./layouts/MobileLayout'))
  : lazy(() => import('./layouts/DesktopLayout'));
```

- 桌面使用者（≥1024px）不載入手機元件（bundle 不膨脹）
- 手機（<768px）：單欄、日檢視、全螢幕 bottom sheet
- 平板（768~1024px）：雙欄 agenda、週檢視、右側面板、居中 dialog
- 平板適配透過 `.tablet` CSS class + `tablet` prop（MobileCalendar 週檢視）
- 不做 runtime 切換（重新整理即可）

### 2.3 入口流程

```
使用者手機登入 iDempiere WebUI
  → 點選單「預約管理」
  → ZK FormController 偵測 ClientInfo.isMobile()
  → 顯示引導畫面 + 「開啟預約管理」按鈕
  → 點擊 → window.open(SPA URL + #token=xxx, '_blank')
  → 新分頁全螢幕載入手機版 SPA
```

手機版 SPA 拿到完整 viewport，不受 ZK iframe 限制。

### 2.4 檔案結構

```
spa/src/
├── api.ts                         ← 共用（不動）
├── types.ts                       ← 共用（不動）
├── hooks/useAppState.ts           ← 共用（不動）
├── App.tsx                        ← 加入 isMobile 判斷
├── layouts/
│   ├── DesktopLayout.tsx          ← 包裝現有桌面元件
│   └── MobileLayout.tsx           ← 手機版主框架
├── components/
│   ├── Calendar.tsx               ← 桌面用（不動）
│   ├── Sidebar.tsx                ← 桌面用（不動）
│   ├── AppointmentDialog.tsx      ← 桌面用（不動）
│   ├── ServiceManager.tsx         ← 桌面用（不動）
│   ├── ResourceManager.tsx        ← 桌面用（不動）
│   ├── StatusManager.tsx          ← 桌面用（不動）
│   └── mobile/
│       ├── BottomTabs.tsx         ← 底部導航
│       ├── AgendaView.tsx         ← 今日/列表檢視
│       ├── MobileCalendar.tsx     ← 手機行事曆（日檢視）
│       ├── BookingSheet.tsx       ← 新增/編輯預約（bottom sheet）
│       ├── QuickActions.tsx       ← 快速狀態切換
│       ├── MobileFilters.tsx      ← 篩選面板
│       ├── MobileSearch.tsx       ← 全螢幕搜尋
│       ├── MobileSettings.tsx     ← 設定頁（管理資源/服務/狀態）
│       └── MobileToast.tsx        ← 手機版 toast
└── styles/
    └── mobile.css                 ← 手機版專用樣式
```


## 三、頁面結構與導航

### 3.1 底部 Tab 導航（BottomTabs）

```
┌─────────────────────────────────────┐
│          （頁面內容區）               │
│                                     │
├─────────────────────────────────────┤
│  📋 今日  │  📅 行事曆  │  🔍 搜尋  │  ⚙️ 設定  │
└─────────────────────────────────────┘
```

| Tab | 圖示 | 功能 | 對應桌面版 |
|-----|------|------|-----------|
| 今日 | 📋 | 當日預約列表（agenda style） | Calendar listDay 檢視 |
| 行事曆 | 📅 | FullCalendar 日/3日檢視 | Calendar timeGrid 檢視 |
| 搜尋 | 🔍 | 全螢幕搜尋預約 | Sidebar 搜尋欄 |
| 設定 | ⚙️ | 篩選 + 管理資源/服務/狀態 | Sidebar + 管理彈窗 |

**規格：**
- 高度：56px（含安全區域 padding）
- 觸控目標：每個 tab 寬度 = 100% / 4
- 選中態：圖示 + 文字變色（var(--primary)）
- 未選中：灰色（#9E9E9E）
- 支援 iOS safe area：`padding-bottom: env(safe-area-inset-bottom)`

### 3.2 頁面轉場

- Tab 切換：無動畫（即時切換）
- 進入子頁面（編輯表單、管理頁）：從右滑入（push）
- 返回：從左滑出（pop）或點左上角返回箭頭
- Bottom sheet：從底部滑上

## 四、今日 Tab（AgendaView）

### 4.1 佈局

```
┌─────────────────────────────────────┐
│  ← 2026/05/07 (三) →    [篩選]      │  ← 頂部日期列
├─────────────────────────────────────┤
│                                     │
│  09:00                              │
│  ┌─────────────────────────────────┐│
│  │ 🟡 王小明                        ││  ← 預約卡片
│  │    諮詢 · 資源A                  ││
│  │    09:00 - 09:30                 ││
│  └─────────────────────────────────┘│
│                                     │
│  09:30                              │
│  ┌─────────────────────────────────┐│
│  │ 🔵 李大華                        ││
│  │    療程 · 資源B                  ││
│  │    09:30 - 10:30                 ││
│  └─────────────────────────────────┘│
│                                     │
│  10:00                              │
│  ┌─────────────────────────────────┐│
│  │ 🟢 陳美玲                        ││
│  │    回診 · 資源A, 資源C           ││
│  │    10:00 - 10:30                 ││
│  └─────────────────────────────────┘│
│                                     │
│                          [＋]       │  ← FAB
├─────────────────────────────────────┤
│  📋 今日  │  📅 行事曆  │ 🔍 搜尋 │ ⚙️ │
└─────────────────────────────────────┘
```

### 4.2 頂部日期列

- 顯示：`YYYY/MM/DD (週幾)`
- 左右箭頭切換日期
- 點擊日期文字 → 彈出日期選擇器跳轉
- 右側「篩選」按鈕 → 開啟 MobileFilters

### 4.3 預約卡片規格

```
┌──────────────────────────────────────┐
│ [狀態色條] 客戶名稱            [狀態] │
│            服務名稱 · 資源列表        │
│            HH:MM - HH:MM            │
└──────────────────────────────────────┘
```

- 左側 4px 色條：對應預約狀態顏色
- 客戶名稱：font-size 16px, font-weight 600
- 服務 + 資源：font-size 14px, color: var(--text-secondary)
- 時間：font-size 13px, color: var(--text-secondary)
- 右側狀態 badge：圓角標籤，背景色 = 狀態色，文字白色
- 卡片 padding：12px 16px
- 卡片間距：8px
- 最小高度：72px（確保觸控目標）
- 圓角：8px
- 陰影：0 1px 3px rgba(0,0,0,.08)

### 4.4 卡片互動

**點擊卡片** → 開啟 QuickActions（快速動作面板）

**左滑卡片** → 露出快速動作按鈕：
- 「已到場」（綠色）— 狀態 → CHK
- 「取消」（紅色）— 狀態 → CXL

**空列表狀態：**
- 顯示插圖 + 「今天沒有預約」文字
- 下方「新增預約」按鈕

### 4.5 FAB（浮動新增按鈕）

- 位置：右下角，距底部 Tab 16px，距右邊 16px
- 尺寸：56×56px 圓形
- 顏色：var(--primary)
- 圖示：白色 + 號（28px）
- 陰影：0 4px 12px rgba(25, 118, 210, 0.4)
- 點擊 → 開啟 BookingSheet（新增模式）
- 滾動時自動隱藏（向下滾隱藏，向上滾顯示）


## 五、行事曆 Tab（MobileCalendar）

### 5.1 佈局

```
┌─────────────────────────────────────┐
│  ← 2026/05/07 →   [日][3日]  [篩選] │  ← 頂部工具列
├─────────────────────────────────────┤
│  09:00 │                            │
│  ──────┤  ┌──────────────────┐      │
│  09:15 │  │ 🟡 王小明         │      │
│  ──────┤  │    諮詢           │      │
│  09:30 │  └──────────────────┘      │
│  ──────┤  ┌──────────────────┐      │
│  09:45 │  │ 🔵 李大華         │      │
│  ──────┤  │    療程           │      │
│  10:00 │  │                  │      │
│  ──────┤  └──────────────────┘      │
│  10:15 │                            │
│  ──────┤                            │
│                          [＋]       │
├─────────────────────────────────────┤
│  📋 今日  │  📅 行事曆  │ 🔍 搜尋 │ ⚙️ │
└─────────────────────────────────────┘
```

### 5.2 FullCalendar 手機設定

```tsx
// MobileCalendar.tsx 的 FullCalendar 設定
initialView="timeGridDay"
headerToolbar={false}  // 用自訂頂部工具列
slotDuration="00:30:00"  // 手機上用 30 分鐘格（比桌面 15 分鐘大）
slotMinTime="08:00:00"
slotMaxTime="19:00:00"
allDaySlot={false}
nowIndicator={true}
editable={false}  // 手機上禁用拖曳（誤觸率高）
selectable={false}  // 禁用拖曳選取（用 FAB 代替）
height="100%"
eventMinHeight={44}  // 最小觸控目標
```

### 5.3 檢視切換

- 「日」按鈕：timeGridDay（預設）
- 「3日」按鈕：timeGrid3Day
- 左右箭頭：切換日期
- 點擊日期文字：跳轉日期選擇器

### 5.4 事件點擊

點擊事件 → 開啟 QuickActions（同今日 Tab 的卡片點擊行為）

### 5.5 長按空白時段

長按（500ms）空白時段 → 開啟 BookingSheet，預填該時段的日期和時間。
（替代桌面版的拖曳選取）

## 六、快速動作面板（QuickActions）

### 6.1 觸發方式

- 今日 Tab：點擊預約卡片
- 行事曆 Tab：點擊事件

### 6.2 佈局（Bottom Sheet，半頁高度）

```
┌─────────────────────────────────────┐
│  ─── （拖曳指示條）                   │
├─────────────────────────────────────┤
│                                     │
│  王小明                    🔗 客戶   │  ← 客戶名 + zoom 連結
│  諮詢 · 09:00-09:30                │  ← 服務 + 時間
│  資源A, 資源B                       │  ← 資源列表
│  備註：初診患者                      │  ← 備註（如有）
│                                     │
├─────────────────────────────────────┤
│  狀態：                             │
│  [預約中] [已確認] [已到場]          │  ← 狀態按鈕列
│  [進行中] [已完成]                  │
├─────────────────────────────────────┤
│                                     │
│  [✏️ 編輯]  [📋 複製到下週]  [❌ 取消] │  ← 動作按鈕
│                                     │
└─────────────────────────────────────┘
```

### 6.3 狀態按鈕規格

- 排列：flex-wrap，每個按鈕 pill 形狀
- 當前狀態：實心填色（背景 = 狀態色，文字白色）
- 其他狀態：描邊（border = 狀態色，文字 = 狀態色）
- 點擊非當前狀態 → 立即切換（呼叫 updateAppointment）
- 切換成功 → toast 提示 + 卡片顏色即時更新
- 終結狀態（CXL、ABS）不顯示在快速切換列（需從「取消」按鈕操作）

### 6.4 動作按鈕

| 按鈕 | 行為 |
|------|------|
| ✏️ 編輯 | 開啟 BookingSheet（編輯模式） |
| 📋 複製到下週 | 確認後建立 +7 天的新預約 |
| ❌ 取消預約 | 二次確認後狀態 → CXL |
| 🔗 客戶 | 開啟 iDempiere 永久連結（新分頁） |

### 6.5 Zoom 連結（手機版適配）

桌面版用 postMessage → ZK onZoom。手機版（獨立分頁）改用 iDempiere 永久連結：

```tsx
function handleZoom(tableName: string, recordId: number) {
  const base = window.location.origin;
  window.open(`${base}/webui/?Action=Zoom&TableName=${tableName}&Record_ID=${recordId}`, '_blank');
}
```

## 七、新增/編輯預約（BookingSheet）

### 7.1 觸發方式

- FAB 按鈕 → 新增模式
- 長按行事曆空白時段 → 新增模式（預填時間）
- QuickActions「編輯」→ 編輯模式

### 7.2 佈局（全螢幕 Bottom Sheet）

```
┌─────────────────────────────────────┐
│  ✕ 新增預約                  [儲存]  │  ← 頂部列
├─────────────────────────────────────┤
│                                     │
│  客戶 ─────────────────────────     │
│  [搜尋客戶或輸入姓名...]             │
│                                     │
│  服務項目 ─────────────────────     │
│  [▼ 選擇服務項目]                   │
│                                     │
│  日期 ─────────────────────────     │
│  [2026/05/07]                       │
│                                     │
│  時間 ─────────────────────────     │
│  [09:00]  至  [09:30]              │
│                                     │
│  資源 ─────────────────────────     │
│  [資源A ✕] [資源B ✕]  [＋ 加入]    │
│                                     │
│  狀態（編輯模式）──────────────     │
│  [▼ 預約中]                         │
│                                     │
│  備註 ─────────────────────────     │
│  [                              ]   │
│                                     │
│  ──────────────────────────────     │
│  [取消預約]          （編輯模式）    │
│                                     │
└─────────────────────────────────────┘
```

### 7.3 表單欄位規格

| 欄位 | 類型 | 手機優化 |
|------|------|---------|
| 客戶 | 文字輸入 + 搜尋下拉 | 輸入 2 字後觸發搜尋，300ms debounce |
| 服務項目 | 原生 select | 使用系統原生選擇器（iOS wheel / Android dropdown） |
| 日期 | input[type=date] | 使用系統原生日期選擇器 |
| 開始時間 | input[type=time] | step=900（15 分鐘） |
| 結束時間 | input[type=time] | step=900 |
| 資源 | tag 列表 + 加入按鈕 | 點「＋加入」→ 彈出資源選擇列表 |
| 狀態 | 原生 select | 僅編輯模式顯示 |
| 備註 | textarea | 2 行高，可展開 |

### 7.4 客戶搜尋互動

1. 使用者輸入文字 → 300ms debounce → 呼叫 searchBPartners
2. 結果以下拉列表顯示（最多 10 筆）
3. 點擊結果 → 填入姓名 + 顯示客戶資訊卡
4. 客戶資訊卡：姓名 | 電話 | Email + 「🔗 開啟」連結

### 7.5 資源選擇互動

- 已選資源以 tag（pill）形式顯示，每個 tag 有 ✕ 可移除
- 點「＋ 加入」→ 彈出半頁 bottom sheet，列出所有可用資源
- 資源列表按類型分組
- 點擊資源 → 加入 tag 列表 → 自動關閉選擇面板

### 7.6 儲存流程

1. 前端驗證：姓名必填、時間必填、至少一個資源
2. 呼叫 bookAppointment / updateAppointment
3. 成功 → toast + 關閉 sheet + 重新載入事件
4. 失敗 → toast 錯誤訊息，sheet 保持開啟

### 7.7 鍵盤處理

- 表單開啟時，focus 第一個空欄位
- 虛擬鍵盤彈出時，sheet 自動上推（避免遮住輸入框）
- 使用 `visualViewport` API 偵測鍵盤高度


## 八、搜尋 Tab（MobileSearch）

### 8.1 佈局

```
┌─────────────────────────────────────┐
│  [🔍 搜尋預約...              ]  ✕  │  ← 搜尋列
├─────────────────────────────────────┤
│                                     │
│  搜尋結果：                          │
│                                     │
│  ┌─────────────────────────────────┐│
│  │ 05/07 09:00  王小明 · 諮詢      ││
│  │              資源A              ││
│  └─────────────────────────────────┘│
│  ┌─────────────────────────────────┐│
│  │ 05/06 14:00  王小明 · 療程      ││
│  │              資源B              ││
│  └─────────────────────────────────┘│
│                                     │
├─────────────────────────────────────┤
│  📋 今日  │  📅 行事曆  │ 🔍 搜尋 │ ⚙️ │
└─────────────────────────────────────┘
```

### 8.2 搜尋行為

- 進入 Tab 時自動 focus 搜尋框
- 輸入 ≥ 2 字後觸發搜尋（500ms debounce）
- 呼叫 `api.searchAssignments(keyword)`
- 結果按日期降序排列

### 8.3 結果卡片

- 顯示：日期 + 時間、客戶名、服務、資源
- 左側色條 = 狀態顏色
- 點擊結果 → 跳轉到行事曆 Tab 該日期 + 開啟 QuickActions

### 8.4 空狀態

- 未輸入：顯示「輸入客戶姓名搜尋預約」提示
- 無結果：顯示「找不到符合的預約」

## 九、設定 Tab（MobileSettings）

### 9.1 佈局

```
┌─────────────────────────────────────┐
│  設定                               │
├─────────────────────────────────────┤
│                                     │
│  篩選 ─────────────────────────     │
│                                     │
│  資源篩選                    [全選]  │
│  [☑ 資源A] [☑ 資源B] [☐ 資源C]     │
│                                     │
│  服務篩選                    [全選]  │
│  [☑ 諮詢] [☑ 療程] [☐ 回診]        │
│                                     │
│  [☐ 顯示已取消]                     │
│                                     │
│  管理 ─────────────────────────     │
│                                     │
│  [👥 管理資源              →]       │
│  [⚙️ 管理服務項目           →]       │
│  [🎨 管理狀態              →]       │
│                                     │
├─────────────────────────────────────┤
│  📋 今日  │  📅 行事曆  │ 🔍 搜尋 │ ⚙️ │
└─────────────────────────────────────┘
```

### 9.2 篩選區

- 資源以 chip 形式排列（flex-wrap）
- 選中 chip：實心填色
- 未選中 chip：描邊
- 「全選」按鈕：toggle 全選/全不選
- 篩選變更即時生效（影響今日 Tab 和行事曆 Tab 的顯示）

### 9.3 管理頁面（子頁面）

點擊管理項目 → push 進入子頁面（全螢幕列表 + CRUD）

**管理資源子頁面：**
```
┌─────────────────────────────────────┐
│  ← 管理資源                  [＋]   │
├─────────────────────────────────────┤
│  醫師                               │  ← 類型分組標題
│  ┌─────────────────────────────────┐│
│  │ 王醫師                    [編輯] ││
│  │ 李醫師                    [編輯] ││
│  └─────────────────────────────────┘│
│  診間                               │
│  ┌─────────────────────────────────┐│
│  │ A診間                     [編輯] ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

**管理服務子頁面：**
- 列表顯示：服務名稱 + 預設時長
- 右上角 ＋ 新增
- 每項有編輯/刪除按鈕
- 編輯 → 開啟 inline 表單或 bottom sheet

**管理狀態子頁面：**
- 列表顯示：色點 + 狀態名稱 + Value code
- 僅顯示，不可在手機上修改（需到 iDempiere 後台）

## 十、篩選面板（MobileFilters）

### 10.1 觸發

- 今日 Tab 頂部「篩選」按鈕
- 行事曆 Tab 頂部「篩選」按鈕

### 10.2 佈局（Bottom Sheet，半頁）

```
┌─────────────────────────────────────┐
│  ─── 篩選                   [重置]  │
├─────────────────────────────────────┤
│                                     │
│  資源                        [全選]  │
│  [☑ 資源A] [☑ 資源B] [☐ 資源C]     │
│                                     │
│  服務                        [全選]  │
│  [☑ 諮詢] [☑ 療程]                 │
│                                     │
│  [☐ 顯示已取消/未到]                │
│                                     │
│  [套用]                             │
└─────────────────────────────────────┘
```

- 「重置」：恢復全選
- 「套用」：關閉面板，篩選即時生效
- 點擊遮罩也可關閉（等同套用）

## 十一、UX 規範

### 11.1 觸控目標

| 元素 | 最小尺寸 | 間距 |
|------|---------|------|
| 按鈕 | 44×44px | 8px |
| 列表項目 | 高度 ≥ 48px | — |
| Tab 項目 | 寬度 ≥ 25vw | — |
| Chip/Tag | 高度 32px | 4px |
| FAB | 56×56px | — |

### 11.2 字體大小

| 用途 | 大小 | 粗細 |
|------|------|------|
| 頁面標題 | 18px | 600 |
| 卡片主文字 | 16px | 600 |
| 卡片副文字 | 14px | 400 |
| 輔助資訊 | 13px | 400 |
| Tab 文字 | 11px | 500 |
| Badge/Tag | 12px | 500 |

### 11.3 間距系統

基於 4px 網格：
- 頁面 padding：16px
- 卡片內 padding：12px 16px
- 區塊間距：16px
- 元素間距：8px
- 緊湊間距：4px

### 11.4 顏色

沿用桌面版 CSS 變數，新增手機專用：
```css
:root {
  --mobile-bg: #F5F5F5;
  --mobile-card: #FFFFFF;
  --mobile-divider: #F0F0F0;
  --mobile-tab-inactive: #9E9E9E;
  --mobile-sheet-handle: #E0E0E0;
}
```

### 11.5 動畫

| 動作 | 動畫 | 時長 |
|------|------|------|
| Bottom sheet 開啟 | translateY(100%) → 0 | 250ms ease-out |
| Bottom sheet 關閉 | 0 → translateY(100%) | 200ms ease-in |
| 頁面 push | translateX(100%) → 0 | 250ms ease-out |
| 頁面 pop | 0 → translateX(100%) | 200ms ease-in |
| Toast 出現 | translateY(-12px) + opacity 0→1 | 250ms |
| Toast 消失 | opacity 1→0 | 200ms |
| FAB 隱藏 | scale(1) → scale(0) | 150ms |

### 11.6 手勢

| 手勢 | 區域 | 行為 |
|------|------|------|
| 左右滑動 | 頂部日期列 | 切換日期 |
| 下拉 | 列表頂部 | 重新載入事件 |
| 左滑卡片 | 預約卡片 | 露出快速動作 |
| 下拉 sheet | Bottom sheet 頂部 | 關閉 sheet |

### 11.7 回饋

| 操作 | 回饋方式 |
|------|---------|
| 狀態切換成功 | Toast「已更新為 XXX」+ 卡片顏色變化 |
| 預約建立成功 | Toast「預約已建立」+ 跳轉到該日期 |
| 預約取消 | Toast「預約已取消」+ 卡片消失（動畫） |
| 網路錯誤 | Toast（紅色）「操作失敗：XXX」 |
| 載入中 | 骨架屏（skeleton）或 spinner |

### 11.8 無障礙

- 所有互動元素有 aria-label
- 色彩對比度 ≥ 4.5:1（WCAG AA）
- 狀態不僅靠顏色區分（搭配文字標籤）
- 支援系統字體大小設定（使用 rem 單位）
- Bottom sheet 有 role="dialog" + aria-modal


## 十二、功能對齊矩陣

| # | 桌面版功能 | 手機版對應元件 | 互動方式 | 備註 |
|---|-----------|--------------|---------|------|
| 1 | 月/週/3日/日/列表檢視 | MobileCalendar（日/3日）+ AgendaView（列表） | Tab 切換 + 按鈕切換 | 手機不提供月檢視（資訊密度太低） |
| 2 | 點空白格新增預約 | FAB + 長按空白時段 | 點擊/長按 | |
| 3 | 點事件編輯 | QuickActions → 編輯 | 點擊 → sheet | 多一步但更安全（防誤觸） |
| 4 | 搜尋預約 | MobileSearch（獨立 Tab） | 全螢幕搜尋 | 比 sidebar 搜尋更好用 |
| 5 | 資源篩選 | MobileFilters / MobileSettings | chip 選擇 | |
| 6 | 服務篩選 | MobileFilters / MobileSettings | chip 選擇 | |
| 7 | 顯示/隱藏已取消 | MobileFilters toggle | checkbox | |
| 8 | 狀態變更 | QuickActions 狀態按鈕列 | 一鍵切換 | 比桌面版更快（不用開 dialog） |
| 9 | 管理資源 CRUD | MobileSettings → 子頁面 | 列表 + 表單 | |
| 10 | 管理服務 CRUD | MobileSettings → 子頁面 | 列表 + 表單 | |
| 11 | 管理狀態 | MobileSettings → 子頁面 | 僅檢視 | |
| 12 | 客戶搜尋 + 關聯 | BookingSheet 客戶欄位 | 搜尋 + 選擇 | |
| 13 | 多資源預約 | BookingSheet 資源 tag | tag + 選擇面板 | |
| 14 | 加入/移除資源 | BookingSheet（編輯模式） | tag ✕ + 加入 | |
| 15 | 複製到下週 | QuickActions 按鈕 | 確認後執行 | |
| 16 | 衝突檢測 | server-side（共用） | Toast 警告 | |
| 17 | Zoom 到業務夥伴 | QuickActions 🔗 按鈕 | window.open 永久連結 | |
| 18 | 日期導航 | 頂部日期列 ← → | 點擊/滑動 | |
| 19 | 狀態圖例 | MobileSettings 篩選區 | 色點 + 名稱 | |

**不提供的桌面功能：**
- 月檢視：手機螢幕太小，月檢視無法有效顯示預約內容
- 拖曳改時間：觸控裝置誤觸率高，改用編輯表單修改時間
- 事件 resize：同上

## 十三、Java 端修改

### 13.1 AppointmentFormController.java

```java
// 新增手機偵測邏輯
@Override
public ADForm getForm() {
    if (ClientInfo.isMobile()) {
        return createMobileGuideForm();
    }
    return createDesktopIframeForm();  // 現有邏輯
}

private ADForm createMobileGuideForm() {
    CustomForm form = new CustomForm();
    // 取得 token（同現有邏輯）
    String token = obtainToken();
    String spaUrl = buildSpaUrl(token);

    // 建立引導畫面
    Vlayout layout = new Vlayout();
    layout.setStyle("padding: 24px; text-align: center;");

    Label title = new Label("📱 預約管理");
    title.setStyle("font-size: 18px; font-weight: bold; display: block; margin-bottom: 16px;");

    Label desc = new Label("點擊下方按鈕開啟手機版預約管理介面");
    desc.setStyle("color: #666; display: block; margin-bottom: 24px;");

    Button openBtn = new Button("開啟預約管理");
    openBtn.setStyle("padding: 12px 32px; font-size: 16px; background: #1976d2; color: white; border: none; border-radius: 8px; cursor: pointer;");
    openBtn.addEventListener(Events.ON_CLICK, e ->
        Clients.evalJavaScript("window.open('" + spaUrl + "', '_blank')"));

    layout.appendChild(title);
    layout.appendChild(desc);
    layout.appendChild(openBtn);
    form.appendChild(layout);
    return form;
}
```

### 13.2 不動的部分

- TokenServlet — 不動
- AuthFilter — 不動
- 所有業務 Servlet（Book/Update/Events/Init...）— 不動
- web.xml — 不動

## 十四、技術實作細節

### 14.1 Bottom Sheet 實作

不引入第三方 library，用原生 CSS + React 實作：

```tsx
interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  height?: 'half' | 'full';  // 半頁或全頁
  children: React.ReactNode;
}
```

- 背景遮罩：`position: fixed; inset: 0; background: rgba(0,0,0,.4)`
- Sheet 本體：`position: fixed; bottom: 0; left: 0; right: 0`
- 圓角：`border-radius: 16px 16px 0 0`
- 拖曳關閉：頂部 handle bar，下拉超過 100px 觸發關閉
- 動畫：CSS transition `transform 250ms ease-out`

### 14.2 左滑動作實作

```tsx
// 使用 touch events 實作
onTouchStart → 記錄起始 X
onTouchMove → 計算 deltaX，超過 50px 開始移動卡片
onTouchEnd → deltaX > 100px 觸發動作，否則回彈
```

- 只允許左滑（deltaX < 0）
- 露出的動作按鈕寬度：80px × N
- 回彈動畫：200ms ease-out

### 14.3 Pull-to-Refresh

```tsx
// 在列表頂部偵測下拉
onTouchStart → 記錄起始 Y（僅在 scrollTop === 0 時啟用）
onTouchMove → 計算 deltaY，顯示 loading indicator
onTouchEnd → deltaY > 60px 觸發 loadEvents()
```

- Loading indicator：圓形 spinner，位於列表頂部
- 觸發後自動收回

### 14.4 日期滑動切換

```tsx
// 在頂部日期列偵測左右滑動
onTouchStart → 記錄起始 X
onTouchEnd → deltaX > 50px → 前一天；deltaX < -50px → 後一天
```

### 14.5 Safe Area 處理

```css
.mobile-layout {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
}

.bottom-tabs {
  padding-bottom: env(safe-area-inset-bottom);
}
```

### 14.6 Viewport 與鍵盤

```html
<!-- index.html -->
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1">
```

```tsx
// 偵測虛擬鍵盤
useEffect(() => {
  const vv = window.visualViewport;
  if (!vv) return;
  const handler = () => {
    const keyboardHeight = window.innerHeight - vv.height;
    document.documentElement.style.setProperty('--keyboard-height', `${keyboardHeight}px`);
  };
  vv.addEventListener('resize', handler);
  return () => vv.removeEventListener('resize', handler);
}, []);
```

## 十五、效能考量

| 項目 | 策略 |
|------|------|
| Code splitting | Desktop/Mobile layout 各自 lazy load |
| 事件載入 | 同桌面版，按日期範圍查詢 |
| 圖片 | 無圖片依賴（純 CSS + emoji） |
| 動畫 | 僅用 transform + opacity（GPU 加速） |
| 列表渲染 | 預約數量通常 < 50/天，不需虛擬滾動 |
| Bundle size | 手機版不載入 FullCalendar 的 month/list plugin |

### 15.1 手機版 FullCalendar 精簡

手機版只需要：
- `@fullcalendar/core`
- `@fullcalendar/timegrid`（日/3日檢視）
- `@fullcalendar/interaction`（事件點擊）

不需要：
- `@fullcalendar/daygrid`（月檢視）
- `@fullcalendar/list`（用自訂 AgendaView 取代）

## 十六、驗證計畫

### 16.1 Docker 環境

```yaml
# docker-compose.yml
services:
  idempiere:
    image: idempiereofficial/idempiere:12
    ports:
      - "8080:8080"
      - "8443:8443"
    environment:
      - IDEMPIERE_DB_HOST=postgres
      - IDEMPIERE_DB_PORT=5432
      - IDEMPIERE_DB_NAME=idempiere
      - IDEMPIERE_DB_USER=adempiere
      - IDEMPIERE_DB_PASSWORD=adempiere
    depends_on:
      - postgres

  postgres:
    image: postgres:14
    environment:
      - POSTGRES_DB=idempiere
      - POSTGRES_USER=adempiere
      - POSTGRES_PASSWORD=adempiere
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

### 16.2 部署步驟

1. `docker compose up -d` 啟動環境
2. 等待 iDempiere 完全啟動（約 2-3 分鐘）
3. 建置外掛：`mvn verify`
4. 部署到 Docker container（exploded bundle）
5. 重啟 iDempiere container
6. 建立測試資料（ResourceType + Resource）

### 16.3 驗證項目

| # | 驗證項目 | 方法 | 預期結果 |
|---|---------|------|---------|
| 1 | 手機偵測引導 | Chrome DevTools 手機模擬 | 顯示「開啟預約管理」按鈕 |
| 2 | 新分頁開啟 | 點擊按鈕 | 全螢幕載入手機版 SPA |
| 3 | 今日 Tab 載入 | 進入 SPA | 顯示當日預約列表 |
| 4 | 日期切換 | 點擊左右箭頭 | 切換日期，重新載入事件 |
| 5 | FAB 新增 | 點擊 + 按鈕 | 開啟 BookingSheet |
| 6 | 建立預約 | 填寫表單 + 儲存 | 預約出現在列表中 |
| 7 | 快速狀態切換 | 點擊卡片 → 點狀態按鈕 | 狀態更新 + 顏色變化 |
| 8 | 編輯預約 | QuickActions → 編輯 | BookingSheet 預填資料 |
| 9 | 取消預約 | QuickActions → 取消 | 確認後預約消失 |
| 10 | 行事曆 Tab | 切換到行事曆 | FullCalendar 日檢視正常 |
| 11 | 搜尋 | 輸入關鍵字 | 顯示搜尋結果 |
| 12 | 篩選 | 取消勾選資源 | 列表即時過濾 |
| 13 | 多資源預約 | 新增時選多個資源 | 預約顯示多資源 |
| 14 | 客戶搜尋 | 輸入客戶名 | 下拉顯示結果 |
| 15 | 複製到下週 | QuickActions → 複製 | 新預約建立在 +7 天 |
| 16 | 桌面版不受影響 | 桌面瀏覽器開啟 | 顯示原有 FullCalendar 介面 |

### 16.4 裝置測試矩陣

| 裝置 | 螢幕 | 測試方式 |
|------|------|---------|
| iPhone SE | 375×667 | Chrome DevTools |
| iPhone 14 | 390×844 | Chrome DevTools |
| iPhone 14 Pro Max | 430×932 | Chrome DevTools |
| iPad Mini | 768×1024 | Chrome DevTools |
| Pixel 7 | 412×915 | Chrome DevTools |
| Samsung Galaxy S23 | 360×780 | Chrome DevTools |

## 十七、實作順序

| 步驟 | 內容 | 依賴 |
|------|------|------|
| 1 | App.tsx 裝置偵測 + DesktopLayout 包裝 | 無 |
| 2 | BottomTabs + MobileLayout 骨架 | 步驟 1 |
| 3 | AgendaView（今日列表） | 步驟 2 |
| 4 | QuickActions（快速動作面板） | 步驟 3 |
| 5 | BookingSheet（新增/編輯表單） | 步驟 2 |
| 6 | MobileCalendar（FullCalendar 日檢視） | 步驟 2 |
| 7 | MobileSearch（搜尋頁） | 步驟 2 |
| 8 | MobileFilters（篩選面板） | 步驟 2 |
| 9 | MobileSettings（設定 + 管理子頁面） | 步驟 2 |
| 10 | FAB + 手勢（左滑、下拉刷新） | 步驟 3 |
| 11 | AppointmentFormController 手機偵測 | 無 |
| 12 | Docker 驗證 | 全部完成 |

## 十八、不引入的依賴

手機版不新增任何 npm 依賴，全部用原生 React + CSS 實作：

| 功能 | 不用 | 原因 |
|------|------|------|
| Bottom Sheet | react-spring, framer-motion | CSS transition 足夠 |
| 手勢 | react-use-gesture, hammer.js | 原生 touch events 足夠 |
| 路由 | react-router | 只有 4 個 tab + 子頁面，useState 管理 |
| UI 框架 | MUI, Ant Design | 增加 bundle size，且需要客製化 |
| 圖示 | icon library | 用 emoji + CSS 形狀 |

保持零新增依賴，bundle size 增量僅為手機版元件本身的程式碼。
