import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildSite } from "../src/build.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEMO_PATH = path.join(__dirname, "..", "demo", "snake.yaml");

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "historymap-snake-test-"));
}

function writeYaml(dir, contents, filename = "data.yaml") {
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, contents, "utf8");
  return filePath;
}

test("demo/snake.yaml builds HTML with every item title and required markers", () => {
  const dir = makeTmpDir();
  const outDir = path.join(dir, "dist");

  const { html, outPath } = buildSite({ dataPath: DEMO_PATH, outDir });

  assert.ok(fs.existsSync(outPath), "dist/index.html should be written");

  const expectedTitles = [
    "コンセプト実証機 FR-0",
    "Virelia FR-10",
    "Virelia FR-15",
    "Virelia FR-20",
    "Manipulator Kit",
    "Virelia FR-30",
    "Fleet Ops Console",
    "Virelia FR-40",
    "Vision Module V2",
    "Virelia FR-50",
  ];
  for (const title of expectedTitles) {
    assert.ok(html.includes(title), `expected HTML to include "${title}"`);
  }

  // iframe height auto-notify marker (shared.mjs buildHeightScript).
  assert.match(html, /postMessage/);
  assert.match(html, /historymap:height/);

  // snake-specific structural markers.
  assert.match(html, /class="snake-track"/);
  assert.match(html, /class="snake-row/);
  assert.match(html, /class="snake-track-line"/);
  assert.match(html, /class="snake-turn snake-turn--right"/);
  assert.match(html, /class="snake-turn snake-turn--left"/);
  assert.match(html, /class="snake-node/);
  assert.match(html, /class="snake-label/);

  // Mobile responsive breakpoint must be present.
  assert.match(html, /@media \(max-width: 640px\)/);

  // Credit footer from shared.mjs creditFooter().
  assert.match(html, /Generated with historymap/);

  assert.match(html, /<!DOCTYPE html>/i);
});

test("snake layout builds successfully with only 2 items (a single, sub-full row)", () => {
  const dir = makeTmpDir();
  const dataPath = writeYaml(
    dir,
    `
title: "Minimal Snake"
layout: snake
items:
  - date: 2021-01-01
    title: "First Milestone"
  - date: 2022-06-01
    title: "Second Milestone"
`
  );

  const { html } = buildSite({ dataPath, outDir: path.join(dir, "dist") });

  assert.match(html, /First Milestone/);
  assert.match(html, /Second Milestone/);
  // Only one row of 2 items exists, so there must be no U-turn connector
  // element in the body (the CSS ruleset for .snake-turn--* is always
  // present in <style>, so check for the actual rendered <div>, not the
  // bare class name).
  assert.ok(!html.includes('<div class="snake-turn snake-turn--right"'));
  assert.ok(!html.includes('<div class="snake-turn snake-turn--left"'));
});

test("snake layout builds successfully with a single item", () => {
  const dir = makeTmpDir();
  const dataPath = writeYaml(
    dir,
    `
title: "Single Item Snake"
layout: snake
items:
  - date: 2020-01-01
    title: "Only Milestone"
`
  );

  const { html } = buildSite({ dataPath, outDir: path.join(dir, "dist") });
  assert.match(html, /Only Milestone/);
});

test("item title DOM order follows date-ascending order, matching the row/reverse pattern", () => {
  const dir = makeTmpDir();
  const dataPath = writeYaml(
    dir,
    `
title: "Order Test"
layout: snake
items:
  - date: 2018
    title: "Item C (row0, pos2)"
  - date: 2010
    title: "Item A (row0, pos0)"
  - date: 2030
    title: "Item F (row1, pos1 DOM / visually reversed)"
  - date: 2015
    title: "Item B (row0, pos1)"
  - date: 2020
    title: "Item D (row0, pos3)"
  - date: 2025
    title: "Item E (row1, pos0 DOM / visually reversed)"
`
  );

  const { html } = buildSite({ dataPath, outDir: path.join(dir, "dist") });

  const titles = [
    "Item A (row0, pos0)",
    "Item B (row0, pos1)",
    "Item C (row0, pos2)",
    "Item D (row0, pos3)",
    "Item E (row1, pos0 DOM / visually reversed)",
    "Item F (row1, pos1 DOM / visually reversed)",
  ];

  const indices = titles.map((t) => html.indexOf(t));
  for (const idx of indices) {
    assert.notEqual(idx, -1, "every title must be present in the output");
  }
  for (let i = 1; i < indices.length; i++) {
    assert.ok(
      indices[i - 1] < indices[i],
      `expected "${titles[i - 1]}" to appear before "${titles[i]}" (date-ascending DOM order)`
    );
  }
});

test("item with an image renders a circular thumbnail node", () => {
  const dir = makeTmpDir();
  const dataPath = writeYaml(
    dir,
    `
title: "Image Node Test"
layout: snake
items:
  - date: 2020-01-01
    title: "No Photo"
  - date: 2021-01-01
    title: "With Photo"
    image: "https://example.com/photo.png"
`
  );

  const { html } = buildSite({ dataPath, outDir: path.join(dir, "dist") });
  assert.match(html, /class="snake-node snake-node--image"/);
  assert.match(html, /src="https:\/\/example\.com\/photo\.png"/);
});
