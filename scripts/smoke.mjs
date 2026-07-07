import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import fs from 'node:fs/promises';

const baseUrl = process.env.UNIVERSE_SIM_URL ?? 'http://localhost:5173/';
const artifactDir = new URL('../artifacts/', import.meta.url);
await fs.mkdir(artifactDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const consoleErrors = [];

page.on('console', (message) => {
  if (message.type() === 'error') {
    consoleErrors.push(message.text());
  }
});
page.on('pageerror', (error) => consoleErrors.push(error.message));

await page.goto(baseUrl, { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);

const canvasInfo = await page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  return {
    width: canvas.width,
    height: canvas.height,
    cssWidth: rect.width,
    cssHeight: rect.height,
  };
});

const desktopGalaxy = await analyzeScreenshot('universesim-desktop-galaxy.png', {
  x: 420,
  y: 110,
  width: 860,
  height: 560,
});

await page.getByRole('tab', { name: 'Curvatura' }).click();
await page.waitForTimeout(1000);
const curvatureText = await page.locator('#mode-title').innerText();
const desktopCurvature = await analyzeScreenshot('universesim-desktop-curvature.png', {
  x: 390,
  y: 110,
  width: 700,
  height: 560,
});

await page.getByRole('tab', { name: 'Caida local' }).click();
await page.waitForTimeout(1000);
const freefallText = await page.locator('#mode-title').innerText();
const freefallHeight = await page.locator('#height-readout').innerText();
const desktopFreefall = await analyzeScreenshot('universesim-desktop-freefall.png', {
  x: 360,
  y: 110,
  width: 760,
  height: 560,
});

await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(800);
const mobileShot = await analyzeScreenshot('universesim-mobile.png', {
  x: 20,
  y: 160,
  width: 350,
  height: 360,
});
const overlapReport = await page.evaluate(() => {
  const boxes = Array.from(document.querySelectorAll('.hud')).map((element) => {
    const rect = element.getBoundingClientRect();
    return {
      cls: element.className,
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    };
  });
  const overlaps = [];

  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i];
      const b = boxes[j];
      const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      if (width * height > 0) {
        overlaps.push({ a: a.cls, b: b.cls, area: width * height });
      }
    }
  }

  return { boxes, overlaps };
});

await browser.close();

const result = {
  canvasInfo,
  modeTexts: { curvatureText, freefallText, freefallHeight },
  screenshots: [desktopGalaxy, desktopCurvature, desktopFreefall, mobileShot],
  overlapReport,
  consoleErrors,
};

console.log(JSON.stringify(result, null, 2));

if (!canvasInfo || canvasInfo.width < 700 || canvasInfo.height < 500) {
  throw new Error('Canvas dimensions are too small');
}

for (const shot of result.screenshots) {
  if (shot.bright < 80 || shot.colorBuckets < 12) {
    throw new Error(`Screenshot looks blank or too flat: ${shot.path}`);
  }
}

if (overlapReport.overlaps.length) {
  throw new Error(`HUD overlap detected: ${JSON.stringify(overlapReport.overlaps)}`);
}

if (consoleErrors.length) {
  throw new Error(`Console errors detected: ${consoleErrors.join('\n')}`);
}

async function analyzeScreenshot(name, region) {
  const path = new URL(name, artifactDir);
  const buffer = await page.screenshot({ path: path.pathname, fullPage: false });
  const png = PNG.sync.read(buffer);
  const x0 = region?.x ?? 0;
  const y0 = region?.y ?? 0;
  const x1 = Math.min(png.width, x0 + (region?.width ?? png.width));
  const y1 = Math.min(png.height, y0 + (region?.height ?? png.height));
  let bright = 0;
  let total = 0;
  const varied = new Set();

  for (let y = y0; y < y1; y += 4) {
    for (let x = x0; x < x1; x += 4) {
      const index = (png.width * y + x) << 2;
      const r = png.data[index];
      const g = png.data[index + 1];
      const b = png.data[index + 2];
      if (r + g + b > 90) {
        bright += 1;
      }
      varied.add(`${r >> 4},${g >> 4},${b >> 4}`);
      total += 1;
    }
  }

  return {
    path: path.pathname,
    width: png.width,
    height: png.height,
    bright,
    total,
    colorBuckets: varied.size,
  };
}
