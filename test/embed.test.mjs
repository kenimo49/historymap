// Unit tests for embed.js (the parent-page resize snippet).
//
// embed.js is a browser script, so we load it with minimal window/document
// stubs and capture the "message" listener it registers. Each test then calls
// that listener directly with a synthetic event -- no jsdom needed.

import test from "node:test";
import assert from "node:assert/strict";

const state = { messageListener: undefined, iframes: [] };

globalThis.window = {
  addEventListener(type, fn) {
    if (type === "message") state.messageListener = fn;
  },
};
globalThis.document = {
  querySelectorAll() {
    return state.iframes;
  },
};

await import("../embed.js");

function messageListener(event) {
  state.messageListener(event);
}

function makeIframe() {
  return { contentWindow: {}, style: { height: "" } };
}

function heightEvent(source, height, overrides = {}) {
  return {
    data: { type: "historymap:height", height },
    origin: "https://example.github.io",
    source,
    ...overrides,
  };
}

test.beforeEach(() => {
  state.iframes = [];
  delete globalThis.window.HISTORYMAP_ALLOWED_ORIGINS;
});

test("registers a message listener on load", () => {
  assert.equal(typeof state.messageListener, "function");
});

test("resizes only the iframe whose contentWindow matches event.source", () => {
  const a = makeIframe();
  const b = makeIframe();
  state.iframes = [a, b];

  messageListener(heightEvent(b.contentWindow, 2860));

  assert.equal(a.style.height, "");
  assert.equal(b.style.height, "2860px");
});

test("ignores messages without the historymap:height type", () => {
  const a = makeIframe();
  state.iframes = [a];

  messageListener(heightEvent(a.contentWindow, 500, { data: { type: "other", height: 500 } }));
  messageListener(heightEvent(a.contentWindow, 500, { data: null }));

  assert.equal(a.style.height, "");
});

test("ignores non-finite, non-numeric, and negative heights", () => {
  const a = makeIframe();
  state.iframes = [a];

  for (const bad of [NaN, Infinity, -Infinity, -1, "500", null, undefined, {}]) {
    messageListener(heightEvent(a.contentWindow, bad));
  }

  assert.equal(a.style.height, "");
});

test("clamps heights above 100000 to 100000", () => {
  const a = makeIframe();
  state.iframes = [a];

  messageListener(heightEvent(a.contentWindow, 100001));

  assert.equal(a.style.height, "100000px");
});

test("accepts zero height", () => {
  const a = makeIframe();
  state.iframes = [a];

  messageListener(heightEvent(a.contentWindow, 0));

  assert.equal(a.style.height, "0px");
});

test("blocks origins outside HISTORYMAP_ALLOWED_ORIGINS when set", () => {
  const a = makeIframe();
  state.iframes = [a];
  globalThis.window.HISTORYMAP_ALLOWED_ORIGINS = ["https://trusted.example"];

  messageListener(heightEvent(a.contentWindow, 800, { origin: "https://evil.example" }));
  assert.equal(a.style.height, "");

  messageListener(heightEvent(a.contentWindow, 800, { origin: "https://trusted.example" }));
  assert.equal(a.style.height, "800px");
});

test("allows all origins when the allowlist is undefined or empty", () => {
  const a = makeIframe();
  state.iframes = [a];

  messageListener(heightEvent(a.contentWindow, 300, { origin: "https://anywhere.example" }));
  assert.equal(a.style.height, "300px");

  a.style.height = "";
  globalThis.window.HISTORYMAP_ALLOWED_ORIGINS = [];
  messageListener(heightEvent(a.contentWindow, 400, { origin: "https://anywhere.example" }));
  assert.equal(a.style.height, "400px");
});

test("does nothing when no iframe matches event.source", () => {
  const a = makeIframe();
  state.iframes = [a];

  messageListener(heightEvent({ someOther: "window" }, 700));

  assert.equal(a.style.height, "");
});
