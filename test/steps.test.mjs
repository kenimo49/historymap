import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildSite } from "../src/build.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const DEMO_PATH = path.join(REPO_ROOT, "demo", "steps.yaml");

const tmpDirs = [];
function makeTmpDir() {
  const _base = path.join(os.tmpdir(), "historymap"); fs.mkdirSync(_base, { recursive: true }); const d = fs.mkdtempSync(path.join(_base, "test-")); tmpDirs.push(d); return d;
}

function writeYaml(dir, contents, filename = "data.yaml") {
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, contents, "utf8");
  return filePath;
}

test("demo/steps.yaml builds HTML with titles, height marker, and zero-padded step numbers", () => {
  const outDir = path.join(makeTmpDir(), "dist");
  const { html } = buildSite({ dataPath: DEMO_PATH, outDir });

  const demoTitles = [
    "要件ヒアリング",
    "現行設備アセスメント",
    "構成設計",
    "機材調達",
    "設置・配線",
    "試運転・検証",
    "引き渡し",
  ];

  for (const title of demoTitles) {
    assert.match(html, new RegExp(title), `expected html to contain title "${title}"`);
  }

  // Zero-padded step numbers 01..07 must appear in order in the markup.
  for (let i = 1; i <= demoTitles.length; i += 1) {
    const number = String(i).padStart(2, "0");
    assert.match(
      html,
      new RegExp(`<span class="step-number">${number}</span>`),
      `expected step number "${number}" in markup`
    );
  }

  // iframe height auto-notify script must be present.
  assert.match(html, /postMessage/);
  assert.match(html, /historymap:height/);

  // Mobile responsive breakpoint must be present.
  assert.match(html, /@media \(max-width: 640px\)/);

  assert.match(html, /<!DOCTYPE html>/i);
});

test("a single item still renders a valid steps list", () => {
  const dir = makeTmpDir();
  const dataPath = writeYaml(
    dir,
    `
title: "Single Step"
layout: steps
items:
  - date: 2025-01-01
    title: "Only Step"
    description: "The only step in this process."
`
  );

  const { html } = buildSite({ dataPath, outDir: path.join(dir, "dist") });

  assert.match(html, /Only Step/);
  assert.match(html, /<span class="step-number">01<\/span>/);
  // No connector line should be needed/rendered incorrectly for a lone item;
  // the CSS rule that suppresses it on :last-child covers this structurally,
  // but at minimum the single row must still build without error.
  assert.match(html, /class="step-row"/);
});

test("hostile input in title/subtitle/description is escaped, not rendered as raw markup", () => {
  const dir = makeTmpDir();
  const payload = "<script>alert(1)</script>";
  const dataPath = writeYaml(
    dir,
    `
title: "Hostile Title ${payload}"
description: "Hostile Description ${payload}"
layout: steps
items:
  - date: 2025-01-01
    title: "Hostile Item ${payload}"
    subtitle: "Hostile Subtitle ${payload}"
    description: "Hostile Body ${payload}"
`
  );

  const { html } = buildSite({ dataPath, outDir: path.join(dir, "dist") });

  assert.ok(!html.includes("<script>alert"), "raw <script>alert must not appear in output");
  // The escaped form should be present instead, proving the string made it
  // through the renderer (not silently dropped) but safely encoded.
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

after(() => {
  for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
});
