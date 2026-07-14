import { test } from "node:test";
import assert from "node:assert/strict";
import { screenshotHtml } from "../src/screenshot.mjs";

test("screenshotHtml is exported as an async function", () => {
  assert.equal(typeof screenshotHtml, "function");
  assert.equal(screenshotHtml.constructor.name, "AsyncFunction");
});

test("Chrome launch failure message mentions fix options", async () => {
  // Force a launch failure by pointing to a non-existent binary.
  const orig = process.env.PUPPETEER_EXECUTABLE_PATH;
  process.env.PUPPETEER_EXECUTABLE_PATH = "/nonexistent/chrome";
  try {
    await screenshotHtml("/tmp/dummy.html");
    assert.fail("should have thrown");
  } catch (err) {
    assert.ok(
      err.message.includes("Chrome could not be launched") ||
      err.message.includes("PNG export requires puppeteer"),
      `unexpected error: ${err.message}`
    );
    assert.ok(
      err.message.includes("PUPPETEER_EXECUTABLE_PATH") ||
      err.message.includes("puppeteer browsers install"),
      "error should mention how to fix"
    );
  } finally {
    if (orig === undefined) delete process.env.PUPPETEER_EXECUTABLE_PATH;
    else process.env.PUPPETEER_EXECUTABLE_PATH = orig;
  }
});
