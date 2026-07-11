import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildSite } from "../src/build.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const DEMO_TREE_YAML = path.join(REPO_ROOT, "demo", "tree.yaml");

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "historymap-tree-test-"));
}

function writeYaml(dir, contents, filename = "data.yaml") {
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, contents, "utf8");
  return filePath;
}

test("demo/tree.yaml builds HTML with every item's title, height marker, and tree markup", () => {
  const dir = makeTmpDir();
  const outDir = path.join(dir, "dist");

  const { html, outPath, data } = buildSite({ dataPath: DEMO_TREE_YAML, outDir });

  assert.ok(fs.existsSync(outPath), "dist/index.html should be written");
  assert.equal(fs.readFileSync(outPath, "utf8"), html);

  // Every item's title must appear in the rendered output.
  for (const item of data.items) {
    assert.ok(
      html.includes(item.title),
      `expected rendered HTML to include item title "${item.title}"`
    );
  }

  // iframe height auto-notify marker.
  assert.match(html, /postMessage/);
  assert.match(html, /historymap:height/);

  // tree-specific markup: nested forest/children lists and node bodies.
  assert.match(html, /class="tree-forest"/);
  assert.match(html, /class="tree-root"/);
  assert.match(html, /class="tree-children"/);
  assert.match(html, /class="tree-node-body/);

  // Mobile responsive breakpoint must be present.
  assert.match(html, /@media \(max-width: 640px\)/);

  // Doctype / title sanity.
  assert.match(html, /<!DOCTYPE html>/i);
});

test("relations.parent referencing a non-existent id fails with an actionable error", () => {
  const dir = makeTmpDir();
  const dataPath = writeYaml(
    dir,
    `
title: "Broken Tree"
layout: tree
items:
  - id: root-item
    date: 2020
    title: "Root Item"
  - id: orphan-item
    date: 2021
    title: "Orphan Item"
    relations:
      parent: does-not-exist
`
  );

  assert.throws(
    () => buildSite({ dataPath, outDir: path.join(dir, "dist") }),
    /Orphan Item/
  );
  assert.throws(
    () => buildSite({ dataPath, outDir: path.join(dir, "dist") }),
    /does-not-exist/
  );
});

test("circular relations.parent references fail with an actionable error", () => {
  const dir = makeTmpDir();
  const dataPath = writeYaml(
    dir,
    `
title: "Cyclic Tree"
layout: tree
items:
  - id: item-a
    date: 2020
    title: "Item A"
    relations:
      parent: item-b
  - id: item-b
    date: 2021
    title: "Item B"
    relations:
      parent: item-a
`
  );

  assert.throws(
    () => buildSite({ dataPath, outDir: path.join(dir, "dist") }),
    /circular/i
  );
});

test("relations.parent referencing the item's own id (self-reference) fails as a circular reference", () => {
  const dir = makeTmpDir();
  const dataPath = writeYaml(
    dir,
    `
title: "Self-Referencing Tree"
layout: tree
items:
  - id: self-item
    date: 2020
    title: "Self Item"
    relations:
      parent: self-item
`
  );

  assert.throws(
    () => buildSite({ dataPath, outDir: path.join(dir, "dist") }),
    /circular/i
  );
});
