import { test } from "node:test";
import assert from "node:assert/strict";
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

// --- list_layouts ---

test("list_layouts returns one line per layout", async () => {
  const { content } = await handleListLayouts();
  assert.equal(content.length, 1);
  assert.equal(content[0].type, "text");
  const lines = content[0].text.split("\n").filter(Boolean);
  assert.deepEqual(lines, VALID_LAYOUTS);
});

// --- generate_timeline: input validation ---

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
  // steps renderer emits step-pill-body which zigzag does not
  assert.ok(content[0].text.includes("step-pill-body"));
});

test("generate_timeline all valid layouts produce HTML without error", async () => {
  for (const layout of VALID_LAYOUTS) {
    const { content } = await handleGenerateTimeline({
      yaml: VALID_YAML,
      layout,
      format: "html",
    });
    assert.equal(content[0].type, "text", `layout ${layout} should return text`);
    assert.ok(
      content[0].text.toLowerCase().includes("<!doctype html"),
      `layout ${layout} should produce a full HTML document`
    );
  }
});

test("generate_timeline default format is png when puppeteer is absent", async () => {
  // If puppeteer is installed with Chrome this test would actually screenshot.
  // Without Chrome, it should throw with a puppeteer-related error (not a yaml/schema error).
  // We only verify the error is NOT a validation error so the PNG path was reached.
  try {
    await handleGenerateTimeline({ yaml: VALID_YAML });
    // If we reach here puppeteer worked — that's fine too.
  } catch (err) {
    assert.ok(
      !String(err.message).includes('"yaml" must be'),
      "error should come from puppeteer, not yaml validation"
    );
  }
});
