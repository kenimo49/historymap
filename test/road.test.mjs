import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildSite } from "../src/build.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const DEMO_PATH = path.join(REPO_ROOT, "demo", "road.yaml");

const tmpDirs = [];
function makeTmpDir() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "historymap-road-test-")); tmpDirs.push(d); return d;
}

function writeYaml(dir, contents, filename = "data.yaml") {
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, contents, "utf8");
  return filePath;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test("demo/road.yaml builds HTML with required markers for every item", () => {
  const outDir = path.join(makeTmpDir(), "dist");
  const { html, outPath, data } = buildSite({ dataPath: DEMO_PATH, outDir });

  assert.ok(fs.existsSync(outPath), "dist/index.html should be written");
  assert.equal(data.layout, "road");
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
layout: road
items:
  - date: 2026-01-01
    title: "Launch Day"
    description: "The only milestone so far."
`
  );

  const { html } = buildSite({ dataPath, outDir: path.join(dir, "dist") });

  assert.match(html, /Launch Day/);
  assert.match(html, /<svg/);
  assert.match(html, /<text class="road-pin-number"[^>]*>1<\/text>/);
});

test("pin numbers 1..N appear in the rendered SVG", () => {
  const outDir = path.join(makeTmpDir(), "dist");
  const { html, data } = buildSite({ dataPath: DEMO_PATH, outDir });

  for (let i = 1; i <= data.items.length; i++) {
    const re = new RegExp(`<text class="road-pin-number"[^>]*>${i}</text>`);
    assert.match(html, re, `missing pin number ${i}`);
  }
});

after(() => {
  for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
});
