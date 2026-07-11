import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildSite } from "../src/build.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEMO_PATH = path.join(__dirname, "..", "demo", "beads.yaml");

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "historymap-beads-test-"));
}

function writeYaml(dir, contents, filename = "data.yaml") {
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, contents, "utf8");
  return filePath;
}

test("demo/beads.yaml builds HTML with every item title and required markers", () => {
  const dir = makeTmpDir();
  const outDir = path.join(dir, "dist");

  const { html, outPath } = buildSite({ dataPath: DEMO_PATH, outDir });

  assert.ok(fs.existsSync(outPath), "dist/index.html should be written");

  const expectedTitles = [
    "プロジェクト キックオフ",
    "基本設計完了",
    "試作機組立",
    "実地フィールド試験",
    "認証取得",
    "量産ライン立ち上げ",
    "Virelia CT-500 発売",
    "初回稼働レビュー",
  ];
  for (const title of expectedTitles) {
    assert.ok(html.includes(title), `expected HTML to include "${title}"`);
  }

  // historymap:height marker (from build.mjs -> dist/index.html directly,
  // and from shared.mjs buildHeightScript via wrapDocument).
  assert.match(html, /postMessage/);
  assert.match(html, /historymap:height/);

  // beads-specific structural markers.
  assert.match(html, /class="beads-timeline"/);
  assert.match(html, /class="beads-item beads-item--left"/);
  assert.match(html, /class="beads-item beads-item--right"/);
  assert.match(html, /beads-node beads-node--start/);
  assert.match(html, /beads-node beads-node--end/);
  assert.match(html, /class="beads-node-label"/);
  assert.match(html, /class="beads-content"/);
  assert.match(html, /class="beads-image"/);

  // Mobile responsive breakpoint must be present.
  assert.match(html, /@media \(max-width: 640px\)/);

  // Credit footer from shared.mjs creditFooter().
  assert.match(html, /Generated with historymap/);

  assert.match(html, /<!DOCTYPE html>/i);
});

test("items are date-ascending in DOM order regardless of input order", () => {
  const dir = makeTmpDir();
  const dataPath = writeYaml(
    dir,
    `
title: "Order Test"
layout: beads
items:
  - date: 2020
    title: "Newer Item"
  - date: 1999
    title: "Older Item"
  - date: 2010
    title: "Middle Item"
`
  );

  const { html } = buildSite({ dataPath, outDir: path.join(dir, "dist") });

  const olderIndex = html.indexOf("Older Item");
  const middleIndex = html.indexOf("Middle Item");
  const newerIndex = html.indexOf("Newer Item");
  assert.ok(olderIndex !== -1 && middleIndex !== -1 && newerIndex !== -1);
  assert.ok(olderIndex < middleIndex && middleIndex < newerIndex);
});

test("a single item still gets a start/finish node without breaking", () => {
  const dir = makeTmpDir();
  const dataPath = writeYaml(
    dir,
    `
title: "Single Item Beads"
layout: beads
items:
  - date: 2020-01-01
    title: "Only Milestone"
`
  );

  const { html } = buildSite({ dataPath, outDir: path.join(dir, "dist") });

  assert.match(html, /Only Milestone/);
  // The single item is both first and last: it must carry both modifier
  // classes on the same node (union, not two separate nodes) without
  // throwing or producing a malformed class attribute.
  assert.match(html, /class="beads-node beads-node--start beads-node--end"/);
  // Exactly one node in the whole document (the label span's class starts
  // with the same prefix, so match on the exact node class attribute).
  const nodeCount = (html.match(/class="beads-node beads-node--start beads-node--end"/g) || []).length;
  assert.equal(nodeCount, 1);
});

test("item with an image renders a circular thumbnail inside the content block", () => {
  const dir = makeTmpDir();
  const dataPath = writeYaml(
    dir,
    `
title: "Image Test"
layout: beads
items:
  - date: 2020-01-01
    title: "No Photo"
  - date: 2021-01-01
    title: "With Photo"
    image: "https://example.com/photo.png"
`
  );

  const { html } = buildSite({ dataPath, outDir: path.join(dir, "dist") });
  assert.match(html, /class="beads-image"/);
  assert.match(html, /src="https:\/\/example\.com\/photo\.png"/);
});

test("item with a link wraps the content block in an anchor", () => {
  const dir = makeTmpDir();
  const dataPath = writeYaml(
    dir,
    `
title: "Link Test"
layout: beads
items:
  - date: 2020-01-01
    title: "Linked Milestone"
    link: "https://example.com/milestone"
  - date: 2021-01-01
    title: "Unlinked Milestone"
`
  );

  const { html } = buildSite({ dataPath, outDir: path.join(dir, "dist") });
  assert.match(html, /<a class="beads-link" href="https:\/\/example\.com\/milestone"/);
});

test("hostile input (script tags in title/subtitle/description) is escaped, not executed", () => {
  const dir = makeTmpDir();
  const dataPath = writeYaml(
    dir,
    `
title: "Hostile Beads"
layout: beads
items:
  - date: 2020-01-01
    title: "<script>alert(1)</script>"
    subtitle: "<img src=x onerror=alert(2)>"
    description: "</style><script>alert(3)</script>"
  - date: 2021-01-01
    title: "Second milestone \\"quoted\\" & <b>bold</b>"
`
  );

  const { html } = buildSite({ dataPath, outDir: path.join(dir, "dist") });

  // No raw <script> tag anywhere in the output; escapeHtml must have
  // converted every "<" that came from user data.
  assert.ok(!html.includes("<script>alert"), "raw <script>alert must not appear in output");
  assert.ok(!/<img src=x onerror=/.test(html), "raw onerror attribute must not appear in output");
  assert.ok(!html.includes("</style><script>"), "must not be able to break out of the <style> block");

  // The escaped forms must be present instead.
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /&lt;img src=x onerror=alert\(2\)&gt;/);
  assert.match(html, /&lt;\/style&gt;&lt;script&gt;alert\(3\)&lt;\/script&gt;/);
  assert.match(html, /&quot;quoted&quot;/);
  assert.match(html, /&amp; &lt;b&gt;bold&lt;\/b&gt;/);
});
