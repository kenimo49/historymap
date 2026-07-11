// Theme presets for historymap. A theme is a flat object of CSS-relevant values.
// `theme.preset` in data.yaml selects one of these as a base; any of the
// individual fields (accent/background/text/font) in data.yaml override the
// preset's value for that field only.

const SYSTEM_FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Sans", "Noto Sans JP", Meiryo, sans-serif';

export const PRESETS = {
  "navy-mono": {
    accent: "#0f2a43",
    background: "#f7f7f5",
    text: "#1a1a1a",
    line: "#c8c8c4",
    font: "",
  },
  plain: {
    accent: "#333333",
    background: "#ffffff",
    text: "#111111",
    line: "#d9d9d9",
    font: "",
  },
};

const DEFAULT_PRESET = "navy-mono";

/**
 * Resolve the effective theme by merging a preset with explicit overrides
 * from data.yaml's `theme:` block.
 * @param {object} themeInput - the raw `theme` object from data.yaml (may be undefined)
 * @returns {{accent:string, background:string, text:string, line:string, font:string, fontStack:string}}
 */
export function resolveTheme(themeInput = {}) {
  const presetName = themeInput.preset || DEFAULT_PRESET;
  const preset = PRESETS[presetName];
  if (!preset) {
    throw new Error(
      `Unknown theme.preset "${presetName}". Valid values: ${Object.keys(PRESETS).join(", ")}`
    );
  }

  const merged = { ...preset };
  for (const key of ["accent", "background", "text", "line", "font"]) {
    if (themeInput[key] !== undefined && themeInput[key] !== "") {
      merged[key] = themeInput[key];
    }
  }

  merged.fontStack = merged.font && merged.font.trim() !== "" ? merged.font : SYSTEM_FONT_STACK;

  return merged;
}
