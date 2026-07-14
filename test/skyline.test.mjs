import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildSite } from "../src/build.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const DEMO_SKYLINE_YAML = path.join(REPO_ROOT, "demo", "skyline.yaml");

const tmpDirs = [];
function makeTmpDir() {
  const _base = path.join(os.tmpdir(), "historymap"); fs.mkdirSync(_base, { recursive: true }); const d = fs.mkdtempSync(path.join(_base, "test-")); tmpDirs.push(d); return d;
}

function writeYaml(dir, contents, filename = "data.yaml") {
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, contents, "utf8");
  return filePath;
}

test("demo/skyline.yaml builds HTML with all item titles, height marker, and skyline-specific markup", () => {
  const outDir = path.join(makeTmpDir(), "dist");
  const { html, outPath } = buildSite({ dataPath: DEMO_SKYLINE_YAML, outDir });

  assert.ok(fs.existsSync(outPath), "dist/index.html should be written");

  const expectedTitles = [
    "Virelia CT-100",
    "Virelia CT-220",
    "Virelia MX-10",
    "Virelia MX-20",
    "Virelia OS 1.0",
    "Virelia RC-Cloud",
    "Virelia EdgeCore",
    "Virelia Nexus",
    "Virelia Care+",
  ];
  for (const title of expectedTitles) {
    assert.match(html, new RegExp(title.replace(/[+]/g, "\\+")), `expected "${title}" in HTML`);
  }

  // iframe height auto-notify marker.
  assert.match(html, /historymap:height/);
  assert.match(html, /postMessage/);

  // skyline-specific structural classes: central axis, per-item bars, and
  // the alternating up/down variants.
  assert.match(html, /class="skyline-track"/);
  assert.match(html, /class="skyline-axis"/);
  assert.match(html, /class="skyline-items"/);
  assert.match(html, /class="skyline-item skyline-item--up"/);
  assert.match(html, /class="skyline-item skyline-item--down"/);
  assert.match(html, /class="skyline-bar"/);
  assert.match(html, /class="skyline-label"/);

  // Description is rendered when present (skyline-description class).
  assert.match(html, /class="skyline-description"/);

  // Horizontal-scroll container so many items don't blow out the page.
  assert.match(html, /skyline-scroll/);
  assert.match(html, /overflow-x: auto/);

  // Mobile responsive breakpoint must be present.
  assert.match(html, /@media \(max-width: 640px\)/);

  // Page shell sanity.
  assert.match(html, /<!DOCTYPE html>/i);
  assert.match(html, /Generated with historymap/);
});

test("a single-item dataset still builds successfully", () => {
  const dir = makeTmpDir();
  const dataPath = writeYaml(
    dir,
    `
title: "Solo Skyline"
layout: skyline
items:
  - date: 2026-01-01
    title: "Launch Day"
    subtitle: "Only milestone"
`
  );

  const { html } = buildSite({ dataPath, outDir: path.join(dir, "dist") });

  assert.match(html, /Launch Day/);
  assert.match(html, /class="skyline-item skyline-item--up"/);
  assert.match(html, /<!DOCTYPE html>/i);
});

test("hostile item fields are escaped, not executed as markup", () => {
  const dir = makeTmpDir();
  const dataPath = writeYaml(
    dir,
    `
title: "Hostile Skyline"
layout: skyline
items:
  - date: 2020
    title: "<script>alert(1)</script>"
    subtitle: "<img src=x onerror=alert(2)>"
    link: "https://example.com/safe"
  - date: 2021
    title: "Second Item"
`
  );

  const { html } = buildSite({ dataPath, outDir: path.join(dir, "dist") });

  // The raw hostile markup must never appear unescaped in the output.
  assert.ok(!html.includes("<script>alert"), "raw <script> tag must not appear in output");
  assert.ok(!html.includes("<img src=x onerror"), "raw <img onerror> must not appear in output");

  // The escaped form must be present instead.
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /&lt;img src=x onerror=alert\(2\)&gt;/);
});

after(() => {
  for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
});
