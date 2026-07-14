import { test } from "node:test";
import assert from "node:assert/strict";
import { screenshotHtml } from "../src/screenshot.mjs";

test("screenshotHtml is exported as an async function", () => {
  assert.equal(typeof screenshotHtml, "function");
  assert.equal(screenshotHtml.constructor.name, "AsyncFunction");
});
