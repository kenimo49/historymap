import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildAllLayouts, buildSite } from "../src/build.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const DEMO_TREE_YAML = path.join(REPO_ROOT, "demo", "tree.yaml");

const ALL_LAYOUTS = [
  "zigzag",
  "tree",
  "metro",
  "heatmap",
  "snake",
  "road",
  "skyline",
  "steps",
  "beads",
  "lollipop",
];

const tmpDirs = [];
function makeTmpDir() {
  const _base = path.join(os.tmpdir(), "historymap"); fs.mkdirSync(_base, { recursive: true }); const d = fs.mkdtempSync(path.join(_base, "test-")); tmpDirs.push(d); return d;
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

test("buildAllLayouts writes a root index.html plus one subdirectory per registered layout", () => {
  const dir = makeTmpDir();
  const dataPath = writeYaml(dir, VALID_YAML);
  const outDir = path.join(dir, "dist");

  const result = buildAllLayouts({ dataPath, outDir });

  assert.equal(result.defaultLayout, "zigzag");
  assert.deepEqual([...result.layouts].sort(), [...ALL_LAYOUTS].sort());

  assert.ok(fs.existsSync(path.join(outDir, "index.html")), "root index.html should exist");
  for (const layout of ALL_LAYOUTS) {
    const layoutIndex = path.join(outDir, layout, "index.html");
    assert.ok(fs.existsSync(layoutIndex), `${layout}/index.html should exist`);
  }
});

test("root index.html contains the layout-switcher redirect script with an allowlist", () => {
  const dir = makeTmpDir();
  const dataPath = writeYaml(dir, VALID_YAML);
  const outDir = path.join(dir, "dist");

  buildAllLayouts({ dataPath, outDir });

  const rootHtml = fs.readFileSync(path.join(outDir, "index.html"), "utf8");

  // The allowlist of layout names must be embedded (build-time constant),
  // and the redirect must be driven by an allowlist lookup, not the raw
  // query value.
  assert.match(rootHtml, /ALLOWED_LAYOUTS/);
  assert.match(rootHtml, /"tree"/);
  assert.match(rootHtml, /"metro"/);
  assert.match(rootHtml, /location\.replace/);
  assert.match(rootHtml, /indexOf\(wanted\)/);
  assert.match(rootHtml, /ALLOWED_LAYOUTS\[index\]/);

  // The script must be injected right before </head>, and only once.
  const headCloseCount = (rootHtml.match(/<\/head>/g) || []).length;
  assert.equal(headCloseCount, 1, "generated document shell should still have exactly one </head>");
  assert.ok(
    rootHtml.indexOf("ALLOWED_LAYOUTS") < rootHtml.indexOf("</head>"),
    "layout-switcher script must be injected before </head>"
  );
});

test("the tree/ subdirectory build contains tree-layout markup", () => {
  const dir = makeTmpDir();
  const dataPath = writeYaml(dir, VALID_YAML);
  const outDir = path.join(dir, "dist");

  buildAllLayouts({ dataPath, outDir });

  const treeHtml = fs.readFileSync(path.join(outDir, "tree", "index.html"), "utf8");
  assert.match(treeHtml, /tree-node-title/);
  assert.match(treeHtml, /Alpha Widget/);
  assert.match(treeHtml, /Beta Widget/);
});

test("data with relations.parent (tree-specific field) builds every layout without error", () => {
  const dir = makeTmpDir();
  const outDir = path.join(dir, "dist");

  // demo/tree.yaml exercises a tree-only field (relations.parent) plus
  // items without images/links, which the other 9 layouts must simply
  // ignore rather than fail on.
  const result = buildAllLayouts({ dataPath: DEMO_TREE_YAML, outDir });

  assert.deepEqual([...result.layouts].sort(), [...ALL_LAYOUTS].sort());
  for (const layout of ALL_LAYOUTS) {
    const layoutIndex = path.join(outDir, layout, "index.html");
    assert.ok(fs.existsSync(layoutIndex), `${layout}/index.html should exist for relations-bearing data`);
  }
});

test("the root page and every layout subdirectory page contain the layout-switcher UI marker", () => {
  const dir = makeTmpDir();
  const dataPath = writeYaml(dir, VALID_YAML);
  const outDir = path.join(dir, "dist");

  buildAllLayouts({ dataPath, outDir });

  const rootHtml = fs.readFileSync(path.join(outDir, "index.html"), "utf8");
  assert.match(rootHtml, /hm-layout-switcher/);

  for (const layout of ALL_LAYOUTS) {
    const layoutHtml = fs.readFileSync(path.join(outDir, layout, "index.html"), "utf8");
    assert.match(layoutHtml, /hm-layout-switcher/, `${layout}/index.html should contain the layout-switcher UI marker`);
  }
});

test("the layout-switcher UI script embeds the current page's own layout as CURRENT_LAYOUT", () => {
  const dir = makeTmpDir();
  const dataPath = writeYaml(dir, VALID_YAML);
  const outDir = path.join(dir, "dist");

  const { defaultLayout } = buildAllLayouts({ dataPath, outDir });
  assert.equal(defaultLayout, "zigzag");

  const rootHtml = fs.readFileSync(path.join(outDir, "index.html"), "utf8");
  assert.match(rootHtml, /CURRENT_LAYOUT = "zigzag"/);

  const treeHtml = fs.readFileSync(path.join(outDir, "tree", "index.html"), "utf8");
  assert.match(treeHtml, /CURRENT_LAYOUT = "tree"/);

  const metroHtml = fs.readFileSync(path.join(outDir, "metro", "index.html"), "utf8");
  assert.match(metroHtml, /CURRENT_LAYOUT = "metro"/);
});

test("a single-layout buildSite() build does not get the layout-switcher UI script", () => {
  const dir = makeTmpDir();
  const dataPath = writeYaml(dir, VALID_YAML);
  const outDir = path.join(dir, "dist");

  buildSite({ dataPath, outDir });

  const html = fs.readFileSync(path.join(outDir, "index.html"), "utf8");
  assert.doesNotMatch(html, /hm-layout-switcher/);
  assert.doesNotMatch(html, /ALLOWED_LAYOUTS/);
});

test("the layout-switcher UI script navigates using an allowlist element reference, never select.value directly", () => {
  const dir = makeTmpDir();
  const dataPath = writeYaml(dir, VALID_YAML);
  const outDir = path.join(dir, "dist");

  buildAllLayouts({ dataPath, outDir });

  const rootHtml = fs.readFileSync(path.join(outDir, "index.html"), "utf8");
  assert.match(rootHtml, /ALLOWED_LAYOUTS\[index\]/);
  assert.doesNotMatch(rootHtml, /location\.href = prefix \+ select\.value/);
});

test("the layout-switcher UI script guards against running inside an embedding iframe", () => {
  const dir = makeTmpDir();
  const dataPath = writeYaml(dir, VALID_YAML);
  const outDir = path.join(dir, "dist");

  buildAllLayouts({ dataPath, outDir });

  const rootHtml = fs.readFileSync(path.join(outDir, "index.html"), "utf8");
  assert.match(rootHtml, /window\.self !== window\.top/);
});

test("local relative images are copied into every layout subdirectory independently", () => {
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

  buildAllLayouts({ dataPath, outDir });

  assert.ok(fs.existsSync(path.join(outDir, "photo.png")), "image should be copied next to root index.html");
  for (const layout of ALL_LAYOUTS) {
    assert.ok(
      fs.existsSync(path.join(outDir, layout, "photo.png")),
      `image should be copied into ${layout}/ as well`
    );
  }
});

after(() => {
  for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
});
