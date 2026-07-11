import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildSite } from "../src/build.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const DEMO_METRO_YAML = path.join(REPO_ROOT, "demo", "metro.yaml");

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "historymap-metro-test-"));
}

function writeYaml(dir, contents, filename = "data.yaml") {
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, contents, "utf8");
  return filePath;
}

test("demo/metro.yaml builds HTML with all item titles, height marker, and legend", () => {
  const outDir = path.join(makeTmpDir(), "dist");
  const { html, outPath } = buildSite({ dataPath: DEMO_METRO_YAML, outDir });

  assert.ok(fs.existsSync(outPath), "dist/index.html should be written");

  const expectedTitles = [
    "Virelia RC-1",
    "Virelia RC-5",
    "Virelia OS 1.0",
    "Virelia RC-Cloud",
    "Virelia OS 2.0",
    "Virelia Care Plan",
    "Virelia MX-30",
    "Virelia OS Suite",
    "Virelia EdgeLink",
    "Virelia Care+",
    "Virelia Nexus",
  ];
  for (const title of expectedTitles) {
    assert.match(html, new RegExp(title.replace(/[+]/g, "\\+")), `expected "${title}" in HTML`);
  }

  // iframe height auto-notify marker.
  assert.match(html, /historymap:height/);
  assert.match(html, /postMessage/);

  // Legend must list every route (tag) name.
  assert.match(html, /コントローラ系/);
  assert.match(html, /ソフトウェア系/);
  assert.match(html, /サービス系/);
  assert.match(html, /metro-legend/);

  // Interchange stations render as the wider marker variant.
  assert.match(html, /metro-station--interchange/);

  // Mobile responsive breakpoint must be present.
  assert.match(html, /@media \(max-width: 640px\)/);

  assert.match(html, /<!DOCTYPE html>/i);

  // Line continuity regression guard: rows must not carry vertical margins,
  // otherwise the stripes (drawn inside each row's box) break into dashes.
  // Spacing must come from .metro-content padding instead.
  const rowRule = html.match(/\.metro-row \{[^}]*\}/);
  assert.ok(rowRule, ".metro-row rule should exist in the generated CSS");
  assert.match(rowRule[0], /margin: 0;/, ".metro-row must have zero margin so stripes stay continuous");
  assert.ok(!/margin-bottom/.test(rowRule[0]), ".metro-row must not reintroduce vertical margins");
});

test("items with no tags at all still build successfully as a single fallback line", () => {
  const dir = makeTmpDir();
  const dataPath = writeYaml(
    dir,
    `
title: "No Tags Metro"
layout: metro
items:
  - date: 2019
    title: "First Stop"
  - date: 2021
    title: "Second Stop"
  - date: 2023
    title: "Third Stop"
`
  );

  const { html } = buildSite({ dataPath, outDir: path.join(dir, "dist") });

  assert.match(html, /First Stop/);
  assert.match(html, /Second Stop/);
  assert.match(html, /Third Stop/);
  // No legend markup should render when there are no real tags to show
  // (the CSS rules for .metro-legend-item still exist in <style>, so check
  // for the actual list markup rather than the class name substring).
  assert.ok(!html.includes("<ul class=\"metro-legend\">"));
  // The single fallback line still renders a station per item.
  assert.match(html, /metro-station--single/);
});

test("second line uses the palette's second color (lines are visually distinguished)", () => {
  const dir = makeTmpDir();
  const dataPath = writeYaml(
    dir,
    `
title: "Palette Test"
layout: metro
items:
  - date: 2020
    title: "Line A Item"
    tags: ["Line A"]
  - date: 2021
    title: "Line B Item"
    tags: ["Line B"]
`
  );

  const { html } = buildSite({ dataPath, outDir: path.join(dir, "dist") });

  // First line prefers theme.accent (navy-mono default "#0f2a43").
  assert.match(html, /#0f2a43/);
  // Second line falls back to the fixed palette's second color (teal).
  assert.match(html, /#2f6f6a/);
  assert.match(html, /Line A/);
  assert.match(html, /Line B/);
});

test("a station with 3 tags is treated as a triple interchange spanning all three lanes", () => {
  const dir = makeTmpDir();
  const dataPath = writeYaml(
    dir,
    `
title: "Triple Interchange"
layout: metro
items:
  - date: 2020
    title: "Alpha"
    tags: ["A"]
  - date: 2021
    title: "Beta"
    tags: ["B"]
  - date: 2022
    title: "Gamma"
    tags: ["C"]
  - date: 2023
    title: "Nexus"
    tags: ["A", "B", "C"]
`
  );

  const { html } = buildSite({ dataPath, outDir: path.join(dir, "dist") });

  assert.match(html, /metro-station--interchange/);
  // Spans from lane 0 to lane 2 (width factor 2).
  assert.match(html, /var\(--metro-lane-width\) \* 2 \+ var\(--metro-interchange-size\)/);
});

test("an item with a duplicate tag (e.g. tags: [A, A]) renders as a normal single-lane station, not an interchange", () => {
  const dir = makeTmpDir();
  const dataPath = writeYaml(
    dir,
    `
title: "Duplicate Tag"
layout: metro
items:
  - date: 2020
    title: "Solo Stop"
    tags: ["A", "A"]
`
  );

  const { html } = buildSite({ dataPath, outDir: path.join(dir, "dist") });

  assert.match(html, /Solo Stop/);
  // Check the actual markup class list, not just the substring
  // "metro-station--interchange" — that string also appears as a CSS
  // selector in the always-present <style> block (see the no-tags test
  // above for the same caveat with .metro-legend-item).
  assert.match(html, /class="metro-station metro-station--single"/);
  assert.ok(!html.includes('class="metro-station metro-station--interchange"'));
});
