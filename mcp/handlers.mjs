import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildSite } from "../src/build.mjs";
import { screenshotHtml } from "../src/screenshot.mjs";
import { VALID_LAYOUTS } from "../src/validate.mjs";

export const LAYOUT_DESCRIPTIONS = {
  zigzag:   "Classic alternating left-right timeline. Best for 5–20 milestones in chronological order.",
  skyline:  "Horizontal axis with bars extending up/down alternately. Best for 4–8 milestones over months.",
  steps:    "Numbered pill cards in a linear flow. Best for sequential process phases (3–8 steps).",
  road:     "Winding SVG road with drop-pin milestones. Best for journey/growth narratives (4–10 items).",
  snake:    "4-column serpentine track with U-turn folds. Best for dense timelines (10–30 items).",
  beads:    "Items strung like beads on a thick vertical axis. Best for compact year-only timelines.",
  lollipop: "Road variant with stemmed circular badges. Best for product launch stages (5–12 items).",
  metro:    "Subway-map style with tags as lines. Best when items share category tags (multi-track).",
  heatmap:  "GitHub-contribution grid (year × month). Best for activity density over 1–5 years.",
  tree:     "Family-tree branching via relations.parent. Best for showing derivation / fork history.",
};

export async function handleListLayouts() {
  const lines = VALID_LAYOUTS.map(
    (name) => `${name}: ${LAYOUT_DESCRIPTIONS[name]}`
  );
  return {
    content: [{ type: "text", text: lines.join("\n") }],
  };
}

/**
 * @param {object} args
 * @param {string} [args.yaml]       YAML string (mutually exclusive with yamlPath)
 * @param {string} [args.yamlPath]   Absolute path to a YAML file
 * @param {string} [args.layout]
 * @param {"html"|"png"} [args.format="png"]
 * @param {number} [args.width=1400]
 */
export async function handleGenerateTimeline({ yaml, yamlPath, layout, format = "png", width = 1400 } = {}) {
  if (yaml === undefined && yamlPath === undefined) {
    throw new Error('generate_timeline: provide either "yaml" (string) or "yamlPath" (file path).');
  }
  if (yaml !== undefined && yamlPath !== undefined) {
    throw new Error('generate_timeline: "yaml" and "yamlPath" are mutually exclusive.');
  }
  if (yaml !== undefined && (typeof yaml !== "string" || yaml.trim() === "")) {
    throw new Error('generate_timeline: "yaml" must be a non-empty string.');
  }

  const base = path.join(os.tmpdir(), "historymap");
  fs.mkdirSync(base, { recursive: true });
  const tmpDir = fs.mkdtempSync(path.join(base, "gen-"));

  try {
    let resolvedYamlPath;
    if (yamlPath) {
      resolvedYamlPath = path.resolve(yamlPath);
    } else {
      resolvedYamlPath = path.join(tmpDir, "data.yaml");
      fs.writeFileSync(resolvedYamlPath, yaml, "utf8");
    }

    const { outPath: htmlPath } = buildSite({
      dataPath: resolvedYamlPath,
      outDir: tmpDir,
      ...(layout ? { layoutOverride: layout } : {}),
    });

    if (format === "html") {
      return {
        content: [{ type: "text", text: fs.readFileSync(htmlPath, "utf8") }],
      };
    }

    const pngBuffer = await screenshotHtml(htmlPath, { width });
    return {
      content: [
        {
          type: "image",
          data: pngBuffer.toString("base64"),
          mimeType: "image/png",
        },
      ],
    };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
