import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildSite } from "../src/build.mjs";

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "historymap-test-"));
}

function writeYaml(dir, contents, filename = "data.yaml") {
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, contents, "utf8");
  return filePath;
}

const VALID_YAML = `
title: "Test History"
description: "A test timeline"
lang: en
layout: zigzag
theme:
  preset: navy-mono
items:
  - id: alpha
    date: 2010-01-01
    title: "Alpha Widget"
    subtitle: "First"
    description: "The original."
  - id: beta
    date: 2020-06-15
    title: "Beta Widget"
    subtitle: "Second"
    description: "The successor."
`;

test("valid data.yaml builds HTML with required markers", () => {
  const dir = makeTmpDir();
  const dataPath = writeYaml(dir, VALID_YAML);
  const outDir = path.join(dir, "dist");

  const { html, outPath } = buildSite({ dataPath, outDir });

  assert.ok(fs.existsSync(outPath), "dist/index.html should be written");
  assert.equal(fs.readFileSync(outPath, "utf8"), html);

  // Each item's title must appear.
  assert.match(html, /Alpha Widget/);
  assert.match(html, /Beta Widget/);

  // postMessage code for iframe height notification must be present.
  assert.match(html, /postMessage/);
  assert.match(html, /historymap:height/);

  // Mobile responsive breakpoint must be present.
  assert.match(html, /@media \(max-width: 640px\)/);

  // Page title / doctype sanity.
  assert.match(html, /<!DOCTYPE html>/i);
  assert.match(html, /<title>Test History<\/title>/);
});

test("items are sorted chronologically regardless of input order", () => {
  const dir = makeTmpDir();
  const dataPath = writeYaml(
    dir,
    `
title: "Order Test"
items:
  - date: 2020
    title: "Newer Item"
  - date: 1999
    title: "Older Item"
`
  );

  const { html } = buildSite({ dataPath, outDir: path.join(dir, "dist") });

  const olderIndex = html.indexOf("Older Item");
  const newerIndex = html.indexOf("Newer Item");
  assert.ok(olderIndex !== -1 && newerIndex !== -1);
  assert.ok(olderIndex < newerIndex, "older item should render before newer item");
});

test("theme overrides are reflected in the generated CSS", () => {
  const dir = makeTmpDir();
  const dataPath = writeYaml(
    dir,
    `
title: "Theme Test"
theme:
  preset: navy-mono
  accent: "#ff00aa"
items:
  - date: 2020
    title: "Only Item"
`
  );

  const { html } = buildSite({ dataPath, outDir: path.join(dir, "dist") });
  assert.match(html, /#ff00aa/);
});

test("local relative image paths are copied into dist and referenced", () => {
  const dir = makeTmpDir();
  fs.writeFileSync(path.join(dir, "photo.png"), "fake-png-bytes");
  const dataPath = writeYaml(
    dir,
    `
title: "Image Test"
items:
  - date: 2020
    title: "With Photo"
    image: "photo.png"
`
  );

  const outDir = path.join(dir, "dist");
  const { html } = buildSite({ dataPath, outDir });

  assert.match(html, /src="photo\.png"/);
  assert.ok(fs.existsSync(path.join(outDir, "photo.png")), "image should be copied into dist/");
});

test("missing required top-level field (title) fails with a clear error", () => {
  const dir = makeTmpDir();
  const dataPath = writeYaml(
    dir,
    `
items:
  - date: 2020
    title: "Something"
`
  );

  assert.throws(() => buildSite({ dataPath, outDir: path.join(dir, "dist") }), /title/i);
});

test("missing required item field (date) fails with a clear error", () => {
  const dir = makeTmpDir();
  const dataPath = writeYaml(
    dir,
    `
title: "Missing Date"
items:
  - title: "No date here"
`
  );

  assert.throws(() => buildSite({ dataPath, outDir: path.join(dir, "dist") }), /date/i);
});

test("missing required item field (title) fails with a clear error", () => {
  const dir = makeTmpDir();
  const dataPath = writeYaml(
    dir,
    `
title: "Missing Title"
items:
  - date: 2020
`
  );

  assert.throws(() => buildSite({ dataPath, outDir: path.join(dir, "dist") }), /title/i);
});

test("empty items array fails with a clear error", () => {
  const dir = makeTmpDir();
  const dataPath = writeYaml(
    dir,
    `
title: "No Items"
items: []
`
  );

  assert.throws(() => buildSite({ dataPath, outDir: path.join(dir, "dist") }), /items/i);
});

test("unsupported layout value fails with a clear error", () => {
  const dir = makeTmpDir();
  const dataPath = writeYaml(
    dir,
    `
title: "Bad Layout"
layout: tree
items:
  - date: 2020
    title: "Something"
`
  );

  assert.throws(() => buildSite({ dataPath, outDir: path.join(dir, "dist") }), /layout/i);
});

test("malformed date value fails with a clear error", () => {
  const dir = makeTmpDir();
  const dataPath = writeYaml(
    dir,
    `
title: "Bad Date"
items:
  - date: "not-a-date"
    title: "Something"
`
  );

  assert.throws(() => buildSite({ dataPath, outDir: path.join(dir, "dist") }), /date/i);
});

test("item image is wrapped in a link when link is present", () => {
  const dir = makeTmpDir();
  const dataPath = writeYaml(dir, `
title: "Test History"
layout: zigzag
items:
  - date: 2020-06-15
    title: "Linked Widget"
    image: "https://example.com/cover.png"
    link: "https://example.com/product"
  - date: 2021-06-15
    title: "Unlinked Widget"
    image: "https://example.com/cover2.png"
`);
  const { html } = buildSite({ dataPath, outDir: path.join(dir, "dist") });

  assert.match(html, /<a class="item-image-link" href="https:\/\/example\.com\/product"/);
  // The unlinked item's image must not be wrapped in an image-link anchor.
  const linkWraps = html.match(/item-image-link/g) || [];
  assert.equal(linkWraps.filter((s) => s === "item-image-link").length >= 1, true);
  assert.ok(!html.includes('<a class="item-image-link" href="https://example.com/cover2.png"'));
});
