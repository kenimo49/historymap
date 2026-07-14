#!/usr/bin/env node
import { parseArgs } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSite, buildAllLayouts } from "./build.mjs";
import { screenshotHtml } from "./screenshot.mjs";
import { VALID_LAYOUTS } from "./validate.mjs";
import fs from "node:fs";
import os from "node:os";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const USAGE = `
Usage: historymap [options]

Options:
  --data <path>      Path to YAML data file (default: <repo>/data.yaml)
  --out <dir>        Output directory (default: <repo>/dist)
  --layout <name>    Layout override. One of: ${VALID_LAYOUTS.join(", ")}
  --format <fmt>     Output format: html (default) or png
  --width <px>       Viewport width for PNG output (default: 1400)
  --all              Build all 10 layouts into subdirectories
  --help             Show this help

Examples:
  historymap
  historymap --data ./roadmap.yaml --out ./output --layout skyline
  historymap --data ./roadmap.yaml --format png --width 1400
  historymap --all --out ./dist
`.trim();

function parseCliArgs() {
  let parsed;
  try {
    parsed = parseArgs({
      args: process.argv.slice(2),
      options: {
        data:   { type: "string" },
        out:    { type: "string" },
        layout: { type: "string" },
        format: { type: "string" },
        width:  { type: "string" },
        all:    { type: "boolean", default: false },
        help:   { type: "boolean", default: false },
      },
      strict: true, // unknown flags → error
    });
  } catch (err) {
    console.error(`historymap: ${err.message}\n`);
    console.error(USAGE);
    process.exitCode = 1;
    return null;
  }
  return parsed.values;
}

async function main() {
  const args = parseCliArgs();
  if (!args) return;

  if (args.help) {
    console.log(USAGE);
    return;
  }

  const format = args.format ?? "html";
  if (format !== "html" && format !== "png") {
    console.error(`historymap: --format must be "html" or "png", got "${format}"`);
    process.exitCode = 1;
    return;
  }

  if (args.layout && !VALID_LAYOUTS.includes(args.layout)) {
    console.error(
      `historymap: --layout "${args.layout}" is not valid. Choose from: ${VALID_LAYOUTS.join(", ")}`
    );
    process.exitCode = 1;
    return;
  }

  const width = args.width ? Number(args.width) : 1400;
  if (isNaN(width) || width <= 0) {
    console.error(`historymap: --width must be a positive number, got "${args.width}"`);
    process.exitCode = 1;
    return;
  }

  const dataPath = args.data ? path.resolve(args.data) : undefined;
  const outDir   = args.out  ? path.resolve(args.out)  : undefined;

  try {
    if (args.all) {
      const { outDir: built, layouts } = buildAllLayouts({ dataPath, outDir });
      console.log(
        `historymap: built ${layouts.length} layouts into ${built}`
      );
      return;
    }

    const { outPath: htmlPath } = buildSite({
      dataPath,
      outDir,
      ...(args.layout ? { layoutOverride: args.layout } : {}),
    });

    if (format === "html") {
      console.log(`historymap: built ${htmlPath}`);
      return;
    }

    // PNG
    const pngPath = htmlPath.replace(/index\.html$/, "index.png");
    const buf = await screenshotHtml(htmlPath, { width });
    fs.writeFileSync(pngPath, buf);
    console.log(`historymap: built ${pngPath}`);
  } catch (err) {
    console.error(err.message || err);
    process.exitCode = 1;
  }
}

main();
