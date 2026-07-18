// 레이싱 손맛 회귀 하니스 (docs/racing-feel-plan.md R-G).
// 자동 주행으로 km/h를 샘플링해 가속 곡선과 터보 오버드라이브를 숫자로 검증합니다.
//
// 사용법: dev 서버(5173)를 띄운 뒤
//   node scripts/telemetry.mjs [playwright모듈경로]
import assert from "node:assert/strict";

const playwrightPath = process.argv[2] || "playwright";
const { chromium } = await import(playwrightPath);

const browser = await chromium.launch({ args: ["--no-sandbox", "--enable-unsafe-swiftshader"] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error)));

await page.goto("http://localhost:5173", { waitUntil: "networkidle" });
await page.waitForTimeout(3500);
const startButton = page.getByText("배송 출발", { exact: false }).first();
assert.ok(await startButton.count(), "배송 출발 버튼을 찾지 못했습니다.");
await startButton.click();
await page.waitForTimeout(1600);

async function readKmh() {
  const text = await page.locator(".tach-readout strong").first().textContent().catch(() => "0");
  return Number(text) || 0;
}

// 헤드리스 환경은 FPS가 낮아 게임 시간이 벽시계보다 느리게 흐른다(dt 상한 0.033s).
// 런타임과 같은 규칙으로 게임 시간을 재현해, 어떤 FPS에서도 같은 기준으로 계측한다.
await page.evaluate(() => {
  window.__gameTime = 0;
  let last = performance.now();
  const tick = (now) => {
    window.__gameTime += Math.min(0.033, (now - last) / 1000);
    last = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
const gameTime = () => page.evaluate(() => window.__gameTime);

const samples = [];
await page.keyboard.down("ArrowUp");
const cruiseWallLimit = Date.now() + 90000;
while ((await gameTime()) < 15 && Date.now() < cruiseWallLimit) {
  samples.push({ t: await gameTime(), kmh: await readKmh() });
  await page.waitForTimeout(60);
}
// 터보 구간 (게임 시간 4초)
await page.keyboard.down("Shift");
const boostSamples = [];
const boostStart = await gameTime();
const boostWallLimit = Date.now() + 40000;
while ((await gameTime()) - boostStart < 4 && Date.now() < boostWallLimit) {
  boostSamples.push({ t: (await gameTime()) - boostStart, kmh: await readKmh() });
  await page.waitForTimeout(60);
}
await page.keyboard.up("Shift");
await page.keyboard.up("ArrowUp");

const firstAt = (threshold) => samples.find((sample) => sample.kmh >= threshold)?.t ?? null;
// 시내 코스는 코너 감속·교통이 끼어들므로 "직선 최고속"이 아니라 "실주행 피크"를 본다.
const cityPeak = Math.max(...samples.map((sample) => sample.kmh));
const boostPeak = Math.max(...boostSamples.map((sample) => sample.kmh));
const report = {
  zeroTo100: firstAt(100),
  cityPeak,
  boostPeak,
  pageErrors
};
console.log(JSON.stringify(report, null, 2));

assert.equal(pageErrors.length, 0, `콘솔 페이지 에러: ${pageErrors[0] || ""}`);
assert.ok(report.zeroTo100 !== null && report.zeroTo100 >= 1.2 && report.zeroTo100 <= 5.5,
  `0→100km/h ${report.zeroTo100}s — 기준(1.2~5.5s) 이탈`);
assert.ok(cityPeak >= 120, `시내 실주행 피크 ${cityPeak}km/h — 기준(≥120) 미달`);
assert.ok(boostPeak >= 215, `터보 피크 ${boostPeak}km/h — 오버드라이브(≥215km/h) 미달`);
console.log("텔레메트리 통과: 가속 곡선과 터보 오버드라이브가 기준 범위 안에 있습니다.");
await browser.close();
