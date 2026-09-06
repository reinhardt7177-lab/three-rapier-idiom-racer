async function openMenu(page) {
  if (!await page.getByRole('dialog').isVisible()) await page.getByRole('button', { name: '일시정지 및 메뉴', exact: true }).click();
  await page.getByRole('dialog').waitFor();
}
async function resume(page) {
  if (await page.getByRole('dialog').isVisible()) await page.getByRole('button', { name: '주행 재개', exact: true }).click();
  await page.locator('canvas').focus();
}
async function resetDrive(page) { await openMenu(page); await page.getByRole('button', { name: '시작점 복귀 · R' }).click(); await page.getByRole('button', { name: '복귀 확인', exact: true }).click(); await resume(page); }
async function recoverDrive(page) { await openMenu(page); await page.getByRole('button', { name: '도로 복귀 · C' }).click(); await resume(page); }
async function exitDrive(page) { await openMenu(page); await page.getByRole('button', { name: '차고로 돌아가기', exact: true }).click(); }
async function inspectDrive(page) { await openMenu(page); await page.getByRole('button', { name: '정차 후 바퀴 점검', exact: true }).click(); await page.locator('[data-left-angle]').waitFor(); await page.locator('canvas').focus(); }
async function touchOn(page) { await openMenu(page); await page.getByLabel('터치 버튼 표시', { exact: true }).selectOption('on'); await resume(page); }
module.exports = { openMenu, resume, resetDrive, recoverDrive, exitDrive, inspectDrive, touchOn };
