import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildSite } from "../src/build.mjs";
import { screenshotHtml } from "../src/screenshot.mjs";
import { VALID_LAYOUTS } from "../src/validate.mjs";

export async function handleListLayouts() {
  return {
    content: [{ type: "text", text: VALID_LAYOUTS.join("\n") }],
  };
}

/**
 * @param {object} args
 * @param {string} args.yaml
 * @param {string} [args.layout]
 * @param {"html"|"png"} [args.format="png"]
 * @param {number} [args.width]
 */
export async function handleGenerateTimeline({ yaml, layout, format = "png", width } = {}) {
  if (typeof yaml !== "string" || yaml.trim() === "") {
    throw new Error('generate_timeline: "yaml" must be a non-empty string.');
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "historymap-"));
  try {
    const yamlPath = path.join(tmpDir, "data.yaml");
    fs.writeFileSync(yamlPath, yaml, "utf8");

    const { outPath: htmlPath } = buildSite({
      dataPath: yamlPath,
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
