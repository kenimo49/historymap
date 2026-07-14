import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { handleListLayouts, handleGenerateTimeline } from "../mcp/handlers.mjs";
import { VALID_LAYOUTS } from "../src/validate.mjs";

const VALID_YAML = `
title: "Test Timeline"
layout: zigzag
items:
  - date: 2020
    title: "First milestone"
  - date: "2023-06-01"
    title: "Second milestone"
`;

const tmpDirs = [];
function makeTmpDir() {
  const base = path.join(os.tmpdir(), "historymap");
  fs.mkdirSync(base, { recursive: true });
  const d = fs.mkdtempSync(path.join(base, "test-"));
  tmpDirs.push(d);
  return d;
}

after(() => {
  for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
});

// --- list_layouts ---

test("list_layouts returns one line per layout", async () => {
  const { content } = await handleListLayouts();
  assert.equal(content.length, 1);
  assert.equal(content[0].type, "text");
  const lines = content[0].text.split("\n").filter(Boolean);
  assert.equal(lines.length, VALID_LAYOUTS.length);
  for (const name of VALID_LAYOUTS) {
    assert.ok(lines.some((l) => l.startsWith(name + ":")), `${name} should appear in list_layouts`);
  }
});

test("list_layouts includes when-to-use description for each layout", async () => {
  const { content } = await handleListLayouts();
  const text = content[0].text;
  assert.ok(text.includes("skyline"), "should include skyline");
  assert.ok(text.includes("Best for"), "should include usage guidance");
});

// --- generate_timeline: input validation ---

test("generate_timeline throws when neither yaml nor yamlPath is given", async () => {
  await assert.rejects(
    () => handleGenerateTimeline({ format: "html" }),
    /provide either "yaml".*or "yamlPath"/i
  );
});

test("generate_timeline throws when both yaml and yamlPath are given", async () => {
  await assert.rejects(
    () => handleGenerateTimeline({ yaml: VALID_YAML, yamlPath: "/some/path.yaml", format: "html" }),
    /mutually exclusive/i
  );
});

test("generate_timeline throws on empty yaml", async () => {
  await assert.rejects(
    () => handleGenerateTimeline({ yaml: "", format: "html" }),
    /yaml.*must be a non-empty string/i
  );
});

test("generate_timeline throws on whitespace-only yaml", async () => {
  await assert.rejects(
    () => handleGenerateTimeline({ yaml: "   \n  ", format: "html" }),
    /yaml.*must be a non-empty string/i
  );
});

test("generate_timeline throws when yaml is not a string", async () => {
  await assert.rejects(
    () => handleGenerateTimeline({ yaml: 42, format: "html" }),
    /yaml.*must be a non-empty string/i
  );
});

test("generate_timeline throws on schema violation: missing title", async () => {
  const yaml = `items:\n  - date: 2020\n    title: "Item"`;
  await assert.rejects(
    () => handleGenerateTimeline({ yaml, format: "html" }),
    /"title" is required/
  );
});

test("generate_timeline throws on schema violation: missing items", async () => {
  const yaml = `title: "Test"`;
  await assert.rejects(
    () => handleGenerateTimeline({ yaml, format: "html" }),
    /"items" is required/
  );
});

test("generate_timeline throws on malformed YAML", async () => {
  await assert.rejects(
    () => handleGenerateTimeline({ yaml: "key: [unclosed bracket", format: "html" }),
    Error
  );
});

// --- generate_timeline: yamlPath ---

test("generate_timeline yamlPath reads from file", async () => {
  const dir = makeTmpDir();
  const yamlPath = path.join(dir, "my-data.yaml");
  fs.writeFileSync(yamlPath, VALID_YAML, "utf8");
  const { content } = await handleGenerateTimeline({ yamlPath, format: "html" });
  assert.equal(content[0].type, "text");
  assert.ok(content[0].text.includes("Test Timeline"));
});

test("generate_timeline yamlPath throws on non-existent file", async () => {
  await assert.rejects(
    () => handleGenerateTimeline({ yamlPath: "/nonexistent/data.yaml", format: "html" }),
    Error
  );
});

// --- generate_timeline: HTML output ---

test("generate_timeline format=html returns text content with DOCTYPE", async () => {
  const { content } = await handleGenerateTimeline({ yaml: VALID_YAML, format: "html" });
  assert.equal(content.length, 1);
  assert.equal(content[0].type, "text");
  assert.ok(content[0].text.toLowerCase().includes("<!doctype html"));
});

test("generate_timeline format=html embeds the title from yaml", async () => {
  const { content } = await handleGenerateTimeline({ yaml: VALID_YAML, format: "html" });
  assert.ok(content[0].text.includes("Test Timeline"));
});

test("generate_timeline format=html contains historymap root element", async () => {
  const { content } = await handleGenerateTimeline({ yaml: VALID_YAML, format: "html" });
  assert.ok(content[0].text.includes("hm-page"));
});

test("generate_timeline layout override switches renderer", async () => {
  const { content } = await handleGenerateTimeline({
    yaml: VALID_YAML,
    layout: "steps",
    format: "html",
  });
  assert.ok(content[0].text.includes("step-pill-body"));
});

test("generate_timeline all valid layouts produce HTML without error", async () => {
  for (const layout of VALID_LAYOUTS) {
    const { content } = await handleGenerateTimeline({ yaml: VALID_YAML, layout, format: "html" });
    assert.equal(content[0].type, "text", `layout ${layout} should return text`);
    assert.ok(
      content[0].text.toLowerCase().includes("<!doctype html"),
      `layout ${layout} should produce a full HTML document`
    );
  }
});

test("generate_timeline default format reaches PNG path (not validation error)", async () => {
  try {
    await handleGenerateTimeline({ yaml: VALID_YAML });
  } catch (err) {
    assert.ok(
      !String(err.message).includes('"yaml" must be'),
      "error should come from puppeteer, not yaml validation"
    );
  }
});
