import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildSite } from "../src/build.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const DEMO_PATH = path.join(REPO_ROOT, "demo", "lollipop.yaml");

const tmpDirs = [];
function makeTmpDir() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "historymap-lollipop-test-")); tmpDirs.push(d); return d;
}

function writeYaml(dir, contents, filename = "data.yaml") {
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, contents, "utf8");
  return filePath;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test("demo/lollipop.yaml builds HTML with required markers for every item", () => {
  const outDir = path.join(makeTmpDir(), "dist");
  const { html, outPath, data } = buildSite({ dataPath: DEMO_PATH, outDir });

  assert.ok(fs.existsSync(outPath), "dist/index.html should be written");
  assert.equal(data.layout, "lollipop");
  assert.ok(data.items.length >= 6, "demo data should have several milestones");

  for (const item of data.items) {
    assert.match(html, new RegExp(escapeRegExp(item.title)), `missing title: ${item.title}`);
  }

  // iframe height auto-notify script must be present.
  assert.match(html, /postMessage/);
  assert.match(html, /historymap:height/);

  // The winding road itself: an inline SVG with a dashed centerline.
  assert.match(html, /<svg/);
  assert.match(html, /stroke-dasharray/);

  // Stem + circular badge markup.
  assert.match(html, /lollipop-stem/);
  assert.match(html, /lollipop-badge-circle/);

  // Image-badge labels must escape on the side away from the stem. The demo
  // deliberately has image items on both an even index (stem down -> label
  // top) and an odd index (stem up -> label bottom), so both side classes
  // must be emitted.
  assert.match(html, /lollipop-badge--label-top/);
  assert.match(html, /lollipop-badge--label-bottom/);

  // description must NOT be rendered by this layout (title/subtitle only).
  assert.ok(
    !/lollipop-description/.test(html),
    "lollipop layout has no description block by design"
  );

  // Mobile responsive breakpoint must be present.
  assert.match(html, /@media \(max-width: 640px\)/);

  // Page shell sanity.
  assert.match(html, /<!DOCTYPE html>/i);
  assert.match(html, /Generated with historymap/);
});

test("a single item is enough to build successfully (N=1)", () => {
  const dir = makeTmpDir();
  const dataPath = writeYaml(
    dir,
    `
title: "Solo Milestone"
layout: lollipop
items:
  - date: 2026-01-01
    title: "Launch Day"
    subtitle: "The only milestone so far."
`
  );

  const { html } = buildSite({ dataPath, outDir: path.join(dir, "dist") });

  assert.match(html, /Launch Day/);
  assert.match(html, /<svg/);
  assert.match(html, /lollipop-badge-circle/);
});

test("hostile input (script tag in title) is escaped, not injected raw", () => {
  const dir = makeTmpDir();
  const dataPath = writeYaml(
    dir,
    `
title: "Hostile Data"
layout: lollipop
items:
  - id: hostile-one
    date: 2020-01-01
    title: "<script>alert(1)</script>"
    subtitle: "<img src=x onerror=alert(2)>"
    link: "https://example.com/safe"
  - id: hostile-two
    date: 2021-01-01
    title: "Second Item"
    subtitle: "Fine"
`
  );

  const { html } = buildSite({ dataPath, outDir: path.join(dir, "dist") });

  // The raw hostile payload must never appear unescaped in the output.
  assert.ok(!html.includes("<script>alert"), "raw <script> tag must not be present");
  assert.ok(!html.includes("<img src=x onerror"), "raw onerror image tag must not be present");

  // The escaped form must be present instead (proves the title/subtitle
  // still reached the page, just safely encoded).
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /&lt;img src=x onerror=alert\(2\)&gt;/);
});

after(() => {
  for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
});
