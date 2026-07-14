import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildSite } from "../src/build.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEMO_PATH = path.join(__dirname, "..", "demo", "heatmap.yaml");

const DEMO_TITLES = [
  "Virelia Pulse Alpha",
  "Virelia Pulse Beta",
  "Virelia Pulse 1.0",
  "Virelia Pulse 1.1",
  "Virelia Grid Connector",
  "Virelia Pulse 2021年振り返り",
  "Virelia Grid Connector 2.0",
  "Virelia Beacon",
  "Virelia Beacon Hotfix",
  "Virelia Sensor Mesh",
  "Virelia Pulse 2024年振り返り",
  "Virelia Sensor Mesh 2.0",
  "Virelia EdgeSync",
  "Virelia EdgeSync LTS",
];

const tmpDirs = [];
function makeTmpDir() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "historymap-heatmap-test-")); tmpDirs.push(d); return d;
}

function writeYaml(dir, contents, filename = "data.yaml") {
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, contents, "utf8");
  return filePath;
}

function buildDemo() {
  const outDir = path.join(makeTmpDir(), "dist");
  return buildSite({ dataPath: DEMO_PATH, outDir });
}

// Finds the single grid cell tag (`<a ...>` or `<span ...>`) for a given
// year/column pair. Our markup always emits `data-year="Y" data-col="C"`
// as consecutive attributes in that order, so this regex pins down exactly
// one cell without matching neighboring cells that share the same year.
function findCellTag(html, year, col) {
  const re = new RegExp(`<(?:a|span)[^>]*data-year="${year}"\\s+data-col="${col}"[^>]*>`);
  const match = html.match(re);
  return match ? match[0] : null;
}

test("demo/heatmap.yaml builds a self-contained HTML document with required markers", () => {
  const { html } = buildDemo();

  for (const title of DEMO_TITLES) {
    assert.ok(html.includes(title), `expected html to contain item title "${title}"`);
  }

  // iframe height auto-notify script must be present.
  assert.match(html, /postMessage/);
  assert.match(html, /historymap:height/);

  // Year anchors for every year that has at least one item.
  for (const year of [2019, 2020, 2021, 2023, 2024, 2025, 2026]) {
    assert.match(html, new RegExp(`id="y-${year}"`), `expected a year section anchor for ${year}`);
  }

  // Mobile responsive breakpoint must be present.
  assert.match(html, /@media \(max-width: 640px\)/);

  assert.match(html, /<!DOCTYPE html>/i);
});

test("year-only precision items land in the unknown-month column, not January", () => {
  const { html } = buildDemo();

  // 2021 has both a year-only item (date: 2021) and a month-precision item
  // (2021-07-01). The year-only item must be counted in the "none" column...
  const noneCell = findCellTag(html, 2021, "none");
  assert.ok(noneCell, "expected an unknown-month cell for 2021");
  assert.match(noneCell, /title="[^"]*Virelia Pulse 2021年振り返り[^"]*"/);
  assert.match(noneCell, /data-count="1"/);

  // ...and must NOT be counted in January (col "1") for that year, which
  // should be empty since no month-precision item falls in January 2021.
  const janCell = findCellTag(html, 2021, "1");
  assert.ok(janCell, "expected a January cell for 2021");
  assert.match(janCell, /data-count="0"/);
  assert.doesNotMatch(janCell, /振り返り/);

  // The month-precision item that year (July) is counted in its own month
  // column, separate from the year-only item.
  const julCell = findCellTag(html, 2021, "7");
  assert.ok(julCell, "expected a July cell for 2021");
  assert.match(julCell, /data-count="1"/);
  assert.match(julCell, /title="[^"]*Virelia Grid Connector 2\.0[^"]*"/);
  assert.doesNotMatch(julCell, /振り返り/);
});

test("a year with no items still gets a grid row", () => {
  const { html } = buildDemo();

  // 2022 is intentionally item-less in demo/heatmap.yaml (between the 2021
  // and 2023 items), and the grid must still show a full 2022 row.
  assert.match(html, /<tr class="hm-row" data-year="2022" data-year-count="0">/);

  // No item listing section is expected for an empty year.
  assert.ok(!html.includes('id="y-2022"'), "empty year should not get an item-list section anchor");

  // Every month column plus the unknown column for 2022 must be at count 0.
  for (const col of ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "none"]) {
    const cell = findCellTag(html, 2022, col);
    assert.ok(cell, `expected a cell for 2022 col ${col}`);
    assert.match(cell, /data-count="0"/);
  }
});

test("an item id colliding with the y-<year> anchor pattern fails the build with a clear error", () => {
  const dir = makeTmpDir();
  const dataPath = writeYaml(
    dir,
    `
title: "Anchor Collision"
layout: heatmap
items:
  - id: y-2021
    date: 2021-05-01
    title: "Colliding Item"
  - date: 2022
    title: "Unrelated Item"
`
  );

  assert.throws(
    () => buildSite({ dataPath, outDir: path.join(dir, "dist") }),
    (err) => {
      assert.match(err.message, /y-<year>/);
      assert.match(err.message, /Colliding Item/);
      assert.match(err.message, /"y-2021"/);
      return true;
    }
  );
});

after(() => {
  for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
});
