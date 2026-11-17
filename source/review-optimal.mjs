import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const require = createRequire('/Users/somikhaylyuk/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/');
const { chromium } = require('playwright');
const sharp = require('sharp');
const folder = 'review/flow-3573-111220';
await mkdir(`${folder}/comparison`, { recursive: true });
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const measurements = [];
try {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce' });
  async function fresh(height) {
    await page.setViewportSize({ width: 375, height });
    await page.goto('http://127.0.0.1:8802/rubles/#delivery');
    await page.reload();
    await page.locator('#loading').waitFor({ state: 'hidden' });
  }
  async function capture(name, reference, height, cropHeight = height) {
    const file = `${folder}/comparison/${name}.png`;
    await page.screenshot({ path: file });
    const metadata = await sharp(`${folder}/figma-${reference}.png`).metadata();
    const ref = await sharp(`${folder}/figma-${reference}.png`).extract({ left: Math.round((metadata.width - 375) / 2), top: height - cropHeight, width: 375, height: cropHeight }).png().toBuffer();
    const actual = await sharp(file).extract({ left: 0, top: height - cropHeight, width: 375, height: cropHeight }).png().toBuffer();
    await sharp({ create: { width: 750, height: cropHeight, channels: 4, background: '#eee' } }).composite([{ input: ref, left: 0, top: 0 }, { input: actual, left: 375, top: 0 }]).png().toFile(`${folder}/comparison/${name}-side-by-side.png`);
    const translucent = await sharp(actual).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let i = 3; i < translucent.data.length; i += 4) translucent.data[i] = 128;
    const overlay = await sharp(translucent.data, { raw: translucent.info }).png().toBuffer();
    await sharp(ref).composite([{ input: overlay }]).png().toFile(`${folder}/comparison/${name}-overlay.png`);
    measurements.push({ name, reference, geometry: await page.evaluate(() => Object.fromEntries(['.selection', '.calculator', '.editor-panel', '.keyboard', '.custom-input', '.editor-product', '#bulk-notice', '#toast'].map(selector => { const el = document.querySelector(selector); return [selector, el?.getBoundingClientRect().toJSON()]; }))) });
  }
  await fresh(792);
  await page.locator('#scroll').evaluate(el => { el.scrollTop = 788; });
  await capture('empty', '3570-98970', 792);
  await fresh(850);
  await page.locator('[data-select="salomon-grey"]').click();
  await page.locator('[data-amount="100"]').click();
  await page.locator('#scroll').evaluate(el => { el.scrollTop = 472; });
  await capture('single', '3573-109893', 850, 200);
  await fresh(847);
  await page.locator('#select-all').click();
  await page.locator('#scroll').evaluate(el => { el.scrollTop = 501; });
  await capture('optimal', '3555-93096', 847, 200);
  await fresh(812);
  await page.locator('#select-all').click();
  await page.locator('#edit-bulk').click();
  await page.locator('#amount').fill('300');
  await capture('bulk-custom', '3573-108165', 812, 457);
  await page.locator('#amount').fill('100');
  await capture('bulk-limited', '3555-93753', 812, 530);
  await page.locator('#done').click();
  await capture('success', '3573-108987', 812);
  await fresh(850);
  await page.locator('#select-all').click();
  await page.locator('.discount-chip[data-edit="salomon-grey"]').click();
  await page.locator('#amount').fill('100');
  await capture('individual', '3573-109648', 850, 627);
  await writeFile(`${folder}/comparison/geometry.json`, JSON.stringify(measurements, null, 2));
  console.log(JSON.stringify({ compared: measurements.length }));
} finally { await browser.close(); }
