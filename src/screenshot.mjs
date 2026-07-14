import path from "node:path";

/**
 * Renders an HTML file to a PNG buffer using Puppeteer.
 * Puppeteer is an optionalDependency — if not installed, throws a helpful error.
 *
 * @param {string} htmlPath  Absolute path to the generated index.html
 * @param {object} [options]
 * @param {number} [options.width=1200]  Viewport width in pixels
 * @returns {Promise<Buffer>}  PNG image buffer
 */
export async function screenshotHtml(htmlPath, options = {}) {
  let puppeteer;
  try {
    puppeteer = (await import("puppeteer")).default;
  } catch {
    throw new Error(
      "puppeteer is not installed. To enable PNG export, run: npm install puppeteer"
    );
  }

  const width = options.width ?? 1200;
  const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 800 });
    await page.goto(`file://${path.resolve(htmlPath)}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForSelector(".hm-page", { timeout: 10_000 });
    const scrollHeight = await page.evaluate(
      () => document.documentElement.scrollHeight
    );
    await page.setViewport({ width, height: Math.max(scrollHeight, 100) });
    return await page.screenshot({ type: "png", fullPage: false });
  } finally {
    await browser.close();
  }
}
