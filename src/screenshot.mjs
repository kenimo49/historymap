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
      "PNG export requires puppeteer, but it is not installed.\n" +
      "  Install:  npm install puppeteer\n" +
      "  If you used --omit=optional or --no-optional, re-run without those flags.\n" +
      "  Or set PUPPETEER_EXECUTABLE_PATH to point to an existing Chrome binary."
    );
  }

  const width = options.width ?? 1200;
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  } catch (err) {
    throw new Error(
      `Chrome could not be launched: ${err.message}\n` +
      "To fix, choose one of:\n" +
      "  1. Download the bundled browser:  npx puppeteer browsers install chrome\n" +
      "  2. Point to an existing binary:   PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable"
    );
  }

  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 800 });
    await page.goto(`file://${path.resolve(htmlPath)}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForSelector(".hm-page", { timeout: 10_000 });
    // Disable all CSS transitions/animations first so the screenshot captures
    // the fully-rendered final state, not a mid-animation frame.
    // Also force lazy images to load immediately.
    await page.evaluate(() => {
      const s = document.createElement("style");
      s.textContent =
        "*, *::before, *::after { transition: none !important; animation: none !important; }";
      document.head.appendChild(s);
      document.querySelectorAll(".item").forEach((el) =>
        el.classList.add("visible")
      );
      document.querySelectorAll("img[loading='lazy']").forEach((img) => {
        img.loading = "eager";
        const src = img.src;
        img.src = "";
        img.src = src;
      });
    });
    const scrollHeight = await page.evaluate(
      () => document.documentElement.scrollHeight
    );
    await page.setViewport({ width, height: Math.max(scrollHeight, 100) });
    return await page.screenshot({ type: "png", fullPage: false });
  } finally {
    await browser.close();
  }
}
