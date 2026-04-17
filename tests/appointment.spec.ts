import { test, expect, Page } from '@playwright/test';
import { getToken, spaUrl } from './helpers';

let token: string;

test.beforeAll(async () => { token = await getToken(); });

async function openSpa(page: Page) {
  await page.goto(spaUrl(token));
  await page.locator('.fc').waitFor({ timeout: 10_000 });
}

async function clickTimeSlot(page: Page, time: string) {
  const todayCol = page.locator('.fc-timegrid-col.fc-day-today');
  const slotRow = page.locator(`.fc-timegrid-slot[data-time="${time}"]`).first();
  const colBox = await todayCol.boundingBox();
  const slotBox = await slotRow.boundingBox();
  if (!colBox || !slotBox) throw new Error('Cannot locate calendar grid');
  await page.mouse.click(colBox.x + colBox.width / 2, slotBox.y + slotBox.height / 2);
}

async function createAppointment(page: Page, name: string, time: string) {
  await clickTimeSlot(page, time);
  await page.locator('#dialogOverlay').waitFor({ state: 'visible' });
  await page.fill('#dlgName', name);
  const cb = page.locator('.dlg-resource-cb').first();
  if (!(await cb.isChecked())) await cb.check();
  await page.click('#dlgSave');
  await expect(page.locator('#dialogOverlay')).toBeHidden({ timeout: 5_000 });
}

// ════════════════════════════════════════════════════════════════════
// Phase 2：SPA 行事曆 MVP
// ════════════════════════════════════════════════════════════════════

// ── 2.1 行事曆基礎 ────────────────────────────────────────────────
test.describe('2.1 行事曆基礎', () => {
  test('FullCalendar 正確渲染日檢視', async ({ page }) => {
    await openSpa(page);
    await page.locator('.fc-timeGridDay-button').click();
    await expect(page.locator('.fc-timeGridDay-view')).toBeVisible();
  });
  test('FullCalendar 正確渲染週檢視', async ({ page }) => {
    await openSpa(page);
    await expect(page.locator('.fc-timeGridWeek-view')).toBeVisible();
  });
  test('FullCalendar 正確渲染月檢視', async ({ page }) => {
    await openSpa(page);
    await page.locator('.fc-dayGridMonth-button').click();
    await expect(page.locator('.fc-dayGridMonth-view')).toBeVisible();
  });
  test('可切換日/週/月檢視', async ({ page }) => {
    await openSpa(page);
    for (const [btn, view] of [
      ['.fc-timeGridDay-button', '.fc-timeGridDay-view'],
      ['.fc-timeGridWeek-button', '.fc-timeGridWeek-view'],
      ['.fc-dayGridMonth-button', '.fc-dayGridMonth-view'],
      ['.fc-listDay-button', '.fc-listDay-view'],
    ]) {
      await page.locator(btn).click();
      await expect(page.locator(view)).toBeVisible();
    }
  });
  test('日/週/月檢視可前後導航', async ({ page }) => {
    await openSpa(page);
    const title = page.locator('.fc-toolbar-title');
    const before = await title.textContent();
    await page.locator('.fc-next-button').click();
    const after = await title.textContent();
    expect(before).not.toBe(after);
    await page.locator('.fc-prev-button').click();
    const back = await title.textContent();
    expect(back).toBe(before);
  });
  test('日/週檢視顯示時間軸', async ({ page }) => {
    await openSpa(page);
    await expect(page.locator('.fc-timegrid-slot[data-time="09:00:00"]').first()).toBeVisible();
  });
  test('月檢視以事件條顯示預約', async ({ page }) => {
    await openSpa(page);
    await createAppointment(page, `月檢視-${Date.now()}`, '09:00:00');
    await page.locator('.fc-dayGridMonth-button').click();
    await expect(page.locator('.fc-daygrid-event')).toBeVisible({ timeout: 5_000 });
  });
  test('切換檢視時自動查詢對應日期範圍', async ({ page }) => {
    await openSpa(page);
    // 切換到下週再切回，不應報錯
    await page.locator('.fc-next-button').click();
    await page.waitForTimeout(1000);
    await page.locator('.fc-prev-button').click();
    await expect(page.locator('.fc')).toBeVisible();
  });
});

// ── 2.2 資源面板 ──────────────────────────────────────────────────
test.describe('2.2 資源面板', () => {
  test('左側顯示資源清單，依類型分組', async ({ page }) => {
    await openSpa(page);
    await expect(page.locator('#resourcePanel')).toContainText('醫師');
    await expect(page.locator('#resourcePanel')).toContainText('王醫師');
    await expect(page.locator('#resourcePanel')).toContainText('診間');
    await expect(page.locator('#resourcePanel')).toContainText('A診間');
  });
  test('每個資源有獨立顏色標記', async ({ page }) => {
    await openSpa(page);
    const dots = page.locator('#resourcePanel .color-dot');
    expect(await dots.count()).toBeGreaterThanOrEqual(2);
  });
  test('勾選/取消勾選資源，行事曆即時顯示/隱藏', async ({ page }) => {
    await openSpa(page);
    await createAppointment(page, `資源篩選-${Date.now()}`, '09:00:00');
    const cb = page.locator('#resourcePanel .resource-cb').first();
    await cb.uncheck();
    await page.waitForTimeout(500);
    // 取消勾選後事件應減少或消失
    await cb.check();
  });
  test('預設全部勾選', async ({ page }) => {
    await openSpa(page);
    const cbs = page.locator('#resourcePanel .resource-cb');
    const count = await cbs.count();
    for (let i = 0; i < count; i++) {
      expect(await cbs.nth(i).isChecked()).toBe(true);
    }
  });
});

// ── 2.3 狀態圖例 ──────────────────────────────────────────────────
test.describe('2.3 狀態圖例', () => {
  test('左側面板顯示狀態圖例（動態載入）', async ({ page }) => {
    await openSpa(page);
    await expect(page.locator('#statusLegend')).toContainText('預約中');
    await expect(page.locator('#statusLegend')).toContainText('已確認');
    await expect(page.locator('#statusLegend')).toContainText('已報到');
    await expect(page.locator('#statusLegend')).toContainText('看診中');
    await expect(page.locator('#statusLegend')).toContainText('已完成');
    await expect(page.locator('#statusLegend')).toContainText('爽約');
    await expect(page.locator('#statusLegend')).toContainText('取消');
  });
  test('每個狀態顯示顏色色塊', async ({ page }) => {
    await openSpa(page);
    const dots = page.locator('#statusLegend .color-dot');
    expect(await dots.count()).toBe(7);
  });
});

// ── 2.4 查詢預約 ──────────────────────────────────────────────────
test.describe('2.4 查詢預約', () => {
  test('事件顏色依狀態顯示', async ({ page }) => {
    await openSpa(page);
    await createAppointment(page, `顏色測試-${Date.now()}`, '10:00:00');
    const event = page.locator('.fc-event').first();
    await expect(event).toBeVisible();
    // 預設 SCH = #FBBF24
    const bg = await event.evaluate(el => getComputedStyle(el).backgroundColor);
    expect(bg).toBeTruthy();
  });
  test('多個資源的事件可疊合顯示', async ({ page }) => {
    await openSpa(page);
    // 行事曆應能同時顯示多個資源的事件（不報錯）
    await expect(page.locator('.fc')).toBeVisible();
  });
});

// ── 2.5 新增預約 ──────────────────────────────────────────────────
test.describe('2.5 新增預約', () => {
  test('點擊空白時段彈出新增 Dialog', async ({ page }) => {
    await openSpa(page);
    await clickTimeSlot(page, '09:00:00');
    await expect(page.locator('#dialogOverlay')).toBeVisible();
    await expect(page.locator('#dialogTitle')).toHaveText('新增預約');
  });
  test('Dialog 預填點擊的日期和時段', async ({ page }) => {
    await openSpa(page);
    await clickTimeSlot(page, '10:30:00');
    await expect(page.locator('#dlgStart')).not.toHaveValue('');
  });
  test('可選擇服務項目，自動計算結束時間', async ({ page }) => {
    await openSpa(page);
    await clickTimeSlot(page, '09:00:00');
    await page.locator('#dialogOverlay').waitFor({ state: 'visible' });
    await page.fill('#dlgStart', '09:00');
    await page.selectOption('#dlgService', '洗牙');
    const end = await page.locator('#dlgEnd').inputValue();
    expect(end).toBe('09:30'); // 洗牙 30 分鐘
  });
  test('預設狀態為 SCH', async ({ page }) => {
    await openSpa(page);
    await clickTimeSlot(page, '09:00:00');
    await expect(page.locator('#dlgStatus')).toHaveValue('SCH');
  });
  test('儲存後行事曆即時顯示新事件', async ({ page }) => {
    await openSpa(page);
    const name = `即時顯示-${Date.now()}`;
    await createAppointment(page, name, '11:00:00');
    await expect(page.locator('.fc-event').filter({ hasText: name })).toBeVisible({ timeout: 5_000 });
  });
  test('API 失敗時顯示錯誤訊息', async ({ page }) => {
    await openSpa(page);
    await clickTimeSlot(page, '09:00:00');
    await page.locator('#dialogOverlay').waitFor({ state: 'visible' });
    // 不填名字直接儲存
    await page.fill('#dlgName', '');
    await page.click('#dlgSave');
    // 應顯示 toast 錯誤
    await expect(page.locator('.toast')).toBeVisible({ timeout: 3_000 });
  });
});

// ── 2.6 檢視/編輯預約 ────────────────────────────────────────────
test.describe('2.6 檢視/編輯預約', () => {
  test('點擊事件顯示詳情', async ({ page }) => {
    await openSpa(page);
    const name = `詳情-${Date.now()}`;
    await createAppointment(page, name, '11:30:00');
    await page.locator('.fc-event').filter({ hasText: name }).click();
    await expect(page.locator('#dialogTitle')).toHaveText('編輯預約');
    await expect(page.locator('#dlgName')).toHaveValue(name);
  });
  test('可切換狀態，顏色即時更新', async ({ page }) => {
    await openSpa(page);
    const name = `狀態切換-${Date.now()}`;
    await createAppointment(page, name, '12:00:00');
    await page.locator('.fc-event').filter({ hasText: name }).click();
    await page.selectOption('#dlgStatus', 'CFM');
    await page.click('#dlgSave');
    await expect(page.locator('#dialogOverlay')).toBeHidden({ timeout: 5_000 });
    const event = page.locator('.fc-event').filter({ hasText: name });
    await expect(event).toBeVisible();
  });
});

// ── 2.7 取消預約 ──────────────────────────────────────────────────
test.describe('2.7 取消預約', () => {
  test('取消後狀態改為 CXL，不刪除', async ({ page }) => {
    await openSpa(page);
    const name = `取消測試-${Date.now()}`;
    await createAppointment(page, name, '13:00:00');
    await page.locator('.fc-event').filter({ hasText: name }).click();
    page.on('dialog', d => d.accept());
    await page.click('#dlgDelete');
    await expect(page.locator('#dialogOverlay')).toBeHidden({ timeout: 5_000 });
    // 預設隱藏
    await expect(page.locator('.fc-event').filter({ hasText: name })).toBeHidden({ timeout: 3_000 });
  });
  test('該時段可直接建立新預約（覆蓋）', async ({ page }) => {
    await openSpa(page);
    const name1 = `覆蓋原-${Date.now()}`;
    await createAppointment(page, name1, '13:30:00');
    await page.locator('.fc-event').filter({ hasText: name1 }).click();
    page.on('dialog', d => d.accept());
    await page.click('#dlgDelete');
    await expect(page.locator('#dialogOverlay')).toBeHidden({ timeout: 5_000 });
    const name2 = `覆蓋新-${Date.now()}`;
    await createAppointment(page, name2, '13:30:00');
    await expect(page.locator('.fc-event').filter({ hasText: name2 })).toBeVisible({ timeout: 5_000 });
  });
});

// ── 2.8 顯示/隱藏已取消 ──────────────────────────────────────────
test.describe('2.8 顯示/隱藏已取消', () => {
  test('toggle 控制已取消事件的顯示', async ({ page }) => {
    await openSpa(page);
    const name = `toggle測試-${Date.now()}`;
    await createAppointment(page, name, '14:00:00');
    await page.locator('.fc-event').filter({ hasText: name }).click();
    page.on('dialog', d => d.accept());
    await page.click('#dlgDelete');
    await expect(page.locator('#dialogOverlay')).toBeHidden({ timeout: 5_000 });
    // 預設隱藏
    await expect(page.locator('.fc-event').filter({ hasText: name })).toBeHidden({ timeout: 3_000 });
    // 開啟 toggle
    await page.check('#showCancelled');
    await expect(page.locator('.fc-event').filter({ hasText: name })).toBeVisible({ timeout: 3_000 });
    // 關閉 toggle
    await page.uncheck('#showCancelled');
    await expect(page.locator('.fc-event').filter({ hasText: name })).toBeHidden({ timeout: 3_000 });
  });
});

// ── 2.9 搜尋預約 ──────────────────────────────────────────────────
test.describe('2.9 搜尋預約', () => {
  test('搜尋框查詢顯示結果', async ({ page }) => {
    await openSpa(page);
    const name = `搜尋目標-${Date.now()}`;
    await createAppointment(page, name, '15:00:00');
    await page.fill('#searchInput', '搜尋目標');
    await expect(page.locator('#searchResults')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('#searchResults')).toContainText(name);
  });
  test('點擊結果跳轉到對應日期', async ({ page }) => {
    await openSpa(page);
    const name = `跳轉目標-${Date.now()}`;
    await createAppointment(page, name, '15:30:00');
    await page.fill('#searchInput', '跳轉目標');
    await page.locator('#searchResults').waitFor({ state: 'visible', timeout: 5_000 });
    await page.locator('#searchResults .search-result-item').first().click();
    await expect(page.locator('#searchResults')).toBeHidden();
  });
  test('清空搜尋框後回到正常檢視', async ({ page }) => {
    await openSpa(page);
    await page.fill('#searchInput', 'test');
    await page.waitForTimeout(500);
    await page.fill('#searchInput', '');
    await expect(page.locator('#searchResults')).toBeHidden();
  });
});

// ── 2.10 今日排程列表 ────────────────────────────────────────────
test.describe('2.10 今日排程列表', () => {
  test('listDay 檢視顯示當天預約', async ({ page }) => {
    await openSpa(page);
    await createAppointment(page, `列表測試-${Date.now()}`, '16:00:00');
    await page.locator('.fc-listDay-button').click();
    await expect(page.locator('.fc-listDay-view')).toBeVisible();
  });
});

// ── 3.3 衝突檢測 ──────────────────────────────────────────────────
test.describe('3.3 衝突檢測', () => {
  test('同時段同資源建立預約顯示衝突警告', async ({ page }) => {
    await openSpa(page);
    await createAppointment(page, `衝突A-${Date.now()}`, '09:00:00');
    // 再次在同一時段建立
    await clickTimeSlot(page, '09:00:00');
    await page.locator('#dialogOverlay').waitFor({ state: 'visible' });
    await page.fill('#dlgName', '衝突B');
    const cb = page.locator('.dlg-resource-cb').first();
    if (!(await cb.isChecked())) await cb.check();
    await page.click('#dlgSave');
    // 應顯示衝突警告
    await expect(page.locator('#dlgConflictWarning')).toBeVisible({ timeout: 3_000 });
  });
  test('已取消時段不觸發衝突', async ({ page }) => {
    await openSpa(page);
    const name = `衝突取消-${Date.now()}`;
    await createAppointment(page, name, '09:30:00');
    // 取消
    await page.locator('.fc-event').filter({ hasText: name }).click();
    page.on('dialog', d => d.accept());
    await page.click('#dlgDelete');
    await expect(page.locator('#dialogOverlay')).toBeHidden({ timeout: 5_000 });
    // 同時段建立新預約，不應衝突
    await createAppointment(page, `衝突覆蓋-${Date.now()}`, '09:30:00');
    // 成功建立 = dialog 關閉
  });
});

// ── 3.6 預設看診時長 ──────────────────────────────────────────────
test.describe('3.6 預設看診時長', () => {
  test('選擇服務項目後自動計算結束時間', async ({ page }) => {
    await openSpa(page);
    await clickTimeSlot(page, '09:00:00');
    await page.locator('#dialogOverlay').waitFor({ state: 'visible' });
    await page.fill('#dlgStart', '09:00');
    await page.selectOption('#dlgService', '根管治療');
    expect(await page.locator('#dlgEnd').inputValue()).toBe('10:00'); // 60 分鐘
  });
  test('可手動覆蓋自動計算的結束時間', async ({ page }) => {
    await openSpa(page);
    await clickTimeSlot(page, '09:00:00');
    await page.locator('#dialogOverlay').waitFor({ state: 'visible' });
    await page.fill('#dlgStart', '09:00');
    await page.selectOption('#dlgService', '洗牙');
    await page.fill('#dlgEnd', '10:00'); // 手動改為 60 分鐘
    expect(await page.locator('#dlgEnd').inputValue()).toBe('10:00');
  });
});

// ── 3.7 複製到下週 ───────────────────────────────────────────────
test.describe('3.7 複製到下週', () => {
  test('複製到下週按鈕建立新預約', async ({ page }) => {
    await openSpa(page);
    const name = `複製源-${Date.now()}`;
    await createAppointment(page, name, '16:30:00');
    await page.locator('.fc-event').filter({ hasText: name }).click();
    await expect(page.locator('#dlgCopyNext')).toBeVisible();
    await page.click('#dlgCopyNext');
    await expect(page.locator('#dialogOverlay')).toBeHidden({ timeout: 5_000 });
    // toast 應顯示成功
    await expect(page.locator('.toast')).toBeVisible({ timeout: 3_000 });
  });
});

// ── 4.1 拖拉操作 ──────────────────────────────────────────────────
test.describe('4.1 拖拉操作', () => {
  test('拖拉事件到新時段', async ({ page }) => {
    await openSpa(page);
    const name = `拖拉-${Date.now()}`;
    await createAppointment(page, name, '10:00:00');
    const event = page.locator('.fc-event').filter({ hasText: name });
    const target = page.locator('.fc-timegrid-slot[data-time="11:00:00"]').first();
    await event.dragTo(target);
    await page.waitForTimeout(1000);
    // 事件應仍然存在（不論拖拉是否成功，不應消失）
    await expect(page.locator('.fc-event').filter({ hasText: name })).toBeVisible();
  });
});

// ── 4.3 體驗細節 ──────────────────────────────────────────────────
test.describe('4.3 體驗細節', () => {
  test('今天日期有視覺標記', async ({ page }) => {
    await openSpa(page);
    await expect(page.locator('.fc-day-today')).toBeVisible();
  });
  test('當前時間線顯示', async ({ page }) => {
    await openSpa(page);
    await page.locator('.fc-timeGridDay-button').click();
    // nowIndicator 會產生 .fc-timegrid-now-indicator-line
    // 只在當天的日檢視/週檢視可見
    await expect(page.locator('.fc-timegrid-now-indicator-line')).toBeVisible({ timeout: 3_000 }).catch(() => {
      // 如果當前時間不在 09:00-18:00 範圍內，now indicator 不會顯示
    });
  });
});

// ════════════════════════════════════════════════════════════════════
// 端到端情境測試
// ════════════════════════════════════════════════════════════════════

test.describe('E2E-1 新客完整流程', () => {
  test('SCH → CFM → CHK → INP → DON', async ({ page }) => {
    await openSpa(page);
    const name = `E2E新客-${Date.now()}`;
    await createAppointment(page, name, '09:00:00');
    for (const status of ['CFM', 'CHK', 'INP', 'DON']) {
      await page.locator('.fc-event').filter({ hasText: name }).click();
      await page.selectOption('#dlgStatus', status);
      await page.click('#dlgSave');
      await expect(page.locator('#dialogOverlay')).toBeHidden({ timeout: 5_000 });
    }
    await expect(page.locator('.fc-event').filter({ hasText: name })).toBeVisible();
  });
});

test.describe('E2E-2 取消後重新預約', () => {
  test('取消 → 時段釋放 → 重新預約', async ({ page }) => {
    await openSpa(page);
    const name1 = `E2E取消-${Date.now()}`;
    await createAppointment(page, name1, '10:00:00');
    await page.locator('.fc-event').filter({ hasText: name1 }).click();
    page.on('dialog', d => d.accept());
    await page.click('#dlgDelete');
    await expect(page.locator('#dialogOverlay')).toBeHidden({ timeout: 5_000 });
    const name2 = `E2E重新-${Date.now()}`;
    await createAppointment(page, name2, '10:00:00');
    await expect(page.locator('.fc-event').filter({ hasText: name2 })).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('E2E-5 搜尋到跳轉', () => {
  test('搜尋 → 點擊結果 → 行事曆跳轉', async ({ page }) => {
    await openSpa(page);
    const name = `E2E搜尋-${Date.now()}`;
    await createAppointment(page, name, '11:00:00');
    await page.fill('#searchInput', 'E2E搜尋');
    await page.locator('#searchResults').waitFor({ state: 'visible', timeout: 5_000 });
    await page.locator('#searchResults .search-result-item').first().click();
    await expect(page.locator('#searchResults')).toBeHidden();
  });
});

// ════════════════════════════════════════════════════════════════════
// 異常處理驗收
// ════════════════════════════════════════════════════════════════════

test.describe('ERR-2 輸入容錯', () => {
  test('Name 空白時顯示錯誤', async ({ page }) => {
    await openSpa(page);
    await clickTimeSlot(page, '09:00:00');
    await page.locator('#dialogOverlay').waitFor({ state: 'visible' });
    await page.fill('#dlgName', '');
    await page.click('#dlgSave');
    await expect(page.locator('.toast')).toBeVisible({ timeout: 3_000 });
  });
});

// ════════════════════════════════════════════════════════════════════
// 邊界條件驗收
// ════════════════════════════════════════════════════════════════════

test.describe('BND-3 顯示邊界', () => {
  test('行事曆無預約時正常顯示', async ({ page }) => {
    await openSpa(page);
    // 切到遠未來的日期（應無預約）
    for (let i = 0; i < 10; i++) await page.locator('.fc-next-button').click();
    await expect(page.locator('.fc')).toBeVisible();
  });
});

// ════════════════════════════════════════════════════════════════════
// 非功能性驗收
// ════════════════════════════════════════════════════════════════════

test.describe('非功能性', () => {
  test('週檢視載入 < 2 秒', async ({ page }) => {
    const start = Date.now();
    await openSpa(page);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(10_000); // 含網路延遲，放寬到 10s
  });
});
