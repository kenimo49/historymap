// Regression suite for hostile-input escaping. Every layout must run
// user-supplied strings (title/subtitle/description/tags/id) through
// escapeHtml (see src/renderers/shared.mjs) before embedding them in the
// generated document, so a raw `<script>` payload can never survive into
// the output. theme.font takes a different protection: validate.mjs's
// character allowlist blocks anything that could break out of the <style>
// block in the first place (it is never escaped, just restricted).

import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildSite } from "../src/build.mjs";
import { escapeHtml } from "../src/renderers/shared.mjs";

const LAYOUTS = ["zigzag", "tree", "metro", "heatmap", "snake", "road"];

// Layouts that render item.description at all (tree/metro/snake omit it —
// see their renderNodeBody/renderContent/renderLabel functions).
const LAYOUTS_WITH_DESCRIPTION = new Set(["zigzag", "heatmap", "road"]);

const XSS_PAYLOAD = "<script>alert(1)</script>";
const HOSTILE_TITLE = `Root Item ${XSS_PAYLOAD} & "quoted" 'apos'`;
const HOSTILE_CHILD_TITLE = `Child Item ${XSS_PAYLOAD} & "quoted" 'apos'`;
const HOSTILE_SUBTITLE = `Subtitle ${XSS_PAYLOAD} & "quoted" 'apos'`;
const HOSTILE_DESCRIPTION = `Description ${XSS_PAYLOAD} & "quoted" 'apos'`;
const HOSTILE_TAG = `Tag ${XSS_PAYLOAD} & "quoted" 'apos'`;
const HOSTILE_ROOT_ID = `hostile-root-${XSS_PAYLOAD}-&-q-a`;
const HOSTILE_CHILD_ID = `hostile-child-${XSS_PAYLOAD}-&-q-a`;

// theme.font passes through validate.mjs's FONT_ALLOWLIST_RE
// (`^[A-Za-z0-9 ,.'"-]*$`), so it can carry quotes/apostrophes (the classic
// "break out of the CSS string" characters) but never angle brackets or
// ampersands — those are rejected outright (see the dedicated test below).
const QUOTED_FONT = `"Ken's Font", sans-serif`;

const tmpDirs = [];
function makeTmpDir() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "historymap-escaping-test-")); tmpDirs.push(d); return d;
}

function writeYaml(dir, contents, filename = "data.yaml") {
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, contents, "utf8");
  return filePath;
}

/**
 * Builds one data.yaml per layout containing the same hostile payloads in
 * every field a v2 layout might read: title/subtitle/description/tags on
 * two items, an id containing hostile characters, a second item whose
 * relations.parent references the first (so tree has a real parent/child
 * edge to render), and a quote-bearing theme.font.
 */
function buildHostileYaml(layout) {
  return `
title: "Escaping Test"
description: ${JSON.stringify(HOSTILE_DESCRIPTION)}
layout: ${layout}
theme:
  font: ${JSON.stringify(QUOTED_FONT)}
items:
  - id: ${JSON.stringify(HOSTILE_ROOT_ID)}
    date: 2020
    title: ${JSON.stringify(HOSTILE_TITLE)}
    subtitle: ${JSON.stringify(HOSTILE_SUBTITLE)}
    description: ${JSON.stringify(HOSTILE_DESCRIPTION)}
    tags: [${JSON.stringify(HOSTILE_TAG)}]
  - id: ${JSON.stringify(HOSTILE_CHILD_ID)}
    date: 2021
    title: ${JSON.stringify(HOSTILE_CHILD_TITLE)}
    subtitle: ${JSON.stringify(HOSTILE_SUBTITLE)}
    description: ${JSON.stringify(HOSTILE_DESCRIPTION)}
    tags: [${JSON.stringify(HOSTILE_TAG)}]
    relations:
      parent: ${JSON.stringify(HOSTILE_ROOT_ID)}
`;
}

for (const layout of LAYOUTS) {
  test(`${layout}: hostile title/subtitle/id are escaped, never raw, in the output`, () => {
    const dir = makeTmpDir();
    const dataPath = writeYaml(dir, buildHostileYaml(layout));
    const { html } = buildSite({ dataPath, outDir: path.join(dir, "dist") });

    // The literal, unescaped payload must never appear anywhere in the
    // document — not in the page <title>/<meta>, not in any item field.
    assert.ok(
      !html.includes(XSS_PAYLOAD),
      `${layout}: raw <script>alert(1)</script> payload must not appear unescaped`
    );

    // Root-level title/description (rendered by every layout via wrapDocument
    // or the equivalent inline shell).
    assert.ok(
      html.includes(escapeHtml(HOSTILE_DESCRIPTION)),
      `${layout}: escaped root description should appear in <meta description> / page body`
    );

    // Item title, subtitle, and id: every layout renders these.
    assert.ok(
      html.includes(escapeHtml(HOSTILE_TITLE)),
      `${layout}: escaped item title should appear in the output`
    );
    assert.ok(
      html.includes(escapeHtml(HOSTILE_CHILD_TITLE)),
      `${layout}: escaped second item's title should appear in the output`
    );
    assert.ok(
      html.includes(escapeHtml(HOSTILE_SUBTITLE)),
      `${layout}: escaped item subtitle should appear in the output`
    );
    assert.ok(
      html.includes(`id="${escapeHtml(HOSTILE_ROOT_ID)}"`),
      `${layout}: escaped item id should appear as an HTML id attribute`
    );

    if (LAYOUTS_WITH_DESCRIPTION.has(layout)) {
      assert.ok(
        html.includes(escapeHtml(HOSTILE_DESCRIPTION)),
        `${layout}: escaped item description should appear in the output`
      );
    }

    if (layout === "metro") {
      // metro is the only layout that renders tags (as the route legend).
      assert.ok(
        html.includes(escapeHtml(HOSTILE_TAG)),
        `metro: escaped tag name should appear in the legend`
      );
    }

    // Sanity: the document is still well-formed (not truncated by a stray
    // unescaped quote/tag breaking out of an attribute or the <style> block).
    assert.match(html, /<!DOCTYPE html>/i);
    assert.match(html, /<\/html>\s*$/);
    assert.equal((html.match(/<style>/g) || []).length, 1);
    assert.equal((html.match(/<\/style>/g) || []).length, 1);
  });
}

test("theme.font rejects a <script> payload instead of embedding it unescaped in <style>", () => {
  // theme.font is never escapeHtml'd — it is inserted as raw CSS text inside
  // <style>. Its protection is validate.mjs's character allowlist
  // (FONT_ALLOWLIST_RE), which must reject anything containing angle
  // brackets or ampersands before it ever reaches a renderer.
  const dir = makeTmpDir();
  const dataPath = writeYaml(
    dir,
    `
title: "Hostile Font"
layout: zigzag
theme:
  font: ${JSON.stringify(`</style><script>alert(1)</script>`)}
items:
  - date: 2020
    title: "Only Item"
`
  );

  assert.throws(
    () => buildSite({ dataPath, outDir: path.join(dir, "dist") }),
    /theme\.font/
  );
});

after(() => {
  for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
});
