// Schema validation for data.yaml. Throws Error with a clear, actionable
// message on the first problem found (fail fast, fail loud).

import { PRESETS } from "./themes.mjs";

export const VALID_LAYOUTS = ["zigzag", "tree", "metro", "heatmap", "snake", "road", "skyline", "steps", "beads", "lollipop"];
const STRING_ITEM_FIELDS = ["id", "subtitle", "description", "image", "link"];

// Only these URL schemes are allowed for items[].link. Anything without a
// scheme (relative URLs) or with any other scheme (javascript:, data:, etc.)
// fails the build with a clear error.
const ALLOWED_LINK_SCHEMES = ["http:", "https:", "mailto:", "tel:"];
const SCHEME_RE = /^([a-zA-Z][a-zA-Z0-9+.-]*):/;

// theme.accent/background/text/line must be a hex color; theme.font is
// restricted to an allowlist so it can never break out of the generated
// <style> block (e.g. via "</style><script>...").
const HEX_COLOR_RE = /^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$|^#[0-9a-fA-F]{8}$/;
const FONT_ALLOWLIST_RE = /^[A-Za-z0-9 ,.'"-]*$/;
const THEME_COLOR_FIELDS = ["accent", "background", "text", "line"];

/**
 * Validates the parsed data.yaml object against the v1 schema.
 * Returns a shallow copy with `layout` defaulted, so callers always
 * see an explicit value.
 * @param {*} data
 * @returns {object}
 */
export function validate(data) {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("data.yaml: top level must be a YAML mapping (object).");
  }

  validateRootFields(data);
  const layout = resolveLayout(data.layout);
  validateTheme(data.theme);

  if (!Array.isArray(data.items) || data.items.length === 0) {
    throw new Error('data.yaml: "items" is required and must be a non-empty array with at least 1 item.');
  }

  data.items.forEach((item, index) => validateItem(item, index));

  return { ...data, layout };
}

function validateRootFields(data) {
  if (typeof data.title !== "string" || data.title.trim() === "") {
    throw new Error('data.yaml: "title" is required and must be a non-empty string.');
  }

  if (data.description !== undefined && typeof data.description !== "string") {
    throw new Error('data.yaml: "description" must be a string.');
  }

  if (data.lang !== undefined && typeof data.lang !== "string") {
    throw new Error('data.yaml: "lang" must be a string.');
  }
}

function resolveLayout(rawLayout) {
  const layout = rawLayout ?? "zigzag";
  if (!VALID_LAYOUTS.includes(layout)) {
    throw new Error(
      `data.yaml: "layout: ${layout}" is not supported. Valid values: ${VALID_LAYOUTS.join(", ")}.`
    );
  }
  return layout;
}

function validateItem(item, index) {
  const label = `data.yaml: items[${index}]`;

  if (item === null || typeof item !== "object" || Array.isArray(item)) {
    throw new Error(`${label} must be a mapping (object).`);
  }

  if (item.date === undefined || item.date === null || item.date === "") {
    throw new Error(`${label}: "date" is required.`);
  }
  // Throws a descriptive error if malformed.
  parseItemDate(item.date, label);

  if (typeof item.title !== "string" || item.title.trim() === "") {
    throw new Error(`${label}: "title" is required and must be a non-empty string.`);
  }

  validateItemOptionalFields(item, label);
}

function validateItemOptionalFields(item, label) {
  for (const field of STRING_ITEM_FIELDS) {
    if (item[field] !== undefined && typeof item[field] !== "string") {
      throw new Error(`${label}: "${field}" must be a string.`);
    }
  }

  validateLink(item.link, label);

  if (item.tags !== undefined) {
    if (!Array.isArray(item.tags)) {
      throw new Error(`${label}: "tags" must be an array.`);
    }
    item.tags.forEach((tag, tagIndex) => {
      if (typeof tag !== "string" || tag.trim() === "") {
        throw new Error(`${label}: "tags[${tagIndex}]" must be a non-empty string.`);
      }
    });
  }

  if (item.relations !== undefined) {
    if (typeof item.relations !== "object" || Array.isArray(item.relations) || item.relations === null) {
      throw new Error(`${label}: "relations" must be a mapping (object).`);
    }
    if (item.relations.parent !== undefined && typeof item.relations.parent !== "string") {
      throw new Error(
        `${label}: "relations.parent" must be a string (the id of another item). Reference integrity is checked by the tree renderer.`
      );
    }
  }
}

/**
 * Validates items[].link: only http:, https:, mailto:, and tel: schemes are
 * allowed (case-insensitive). Relative URLs (no scheme) and any other scheme
 * (javascript:, data:, etc.) fail the build with a clear error, since `link`
 * is rendered as a raw `href` and a hostile scheme would run in the visitor's
 * browser.
 * @param {*} link - raw item.link value (already type-checked as string|undefined)
 * @param {string} label
 */
function validateLink(link, label) {
  if (link === undefined || link === "") return;

  const trimmed = link.trim();
  const match = SCHEME_RE.exec(trimmed);
  if (!match) {
    throw new Error(
      `${label}: "link" must start with one of the allowed schemes (${ALLOWED_LINK_SCHEMES.join(", ")}); got "${link}", which has no URL scheme (relative URLs are not allowed).`
    );
  }

  const scheme = `${match[1].toLowerCase()}:`;
  if (!ALLOWED_LINK_SCHEMES.includes(scheme)) {
    throw new Error(
      `${label}: "link" scheme "${scheme}" is not allowed. Allowed schemes: ${ALLOWED_LINK_SCHEMES.join(", ")}. Got "${link}".`
    );
  }
}

/**
 * Validates the `theme` block: preset must be a known preset, the color
 * fields must be hex colors, and `font` is restricted to an allowlist of
 * characters so it can never break out of the generated <style> block.
 * @param {*} theme - raw data.theme value (already type-checked as object|undefined)
 */
function validateTheme(theme) {
  if (theme === undefined) return;

  if (typeof theme !== "object" || Array.isArray(theme) || theme === null) {
    throw new Error('data.yaml: "theme" must be a mapping (object).');
  }

  if (theme.preset !== undefined && (typeof theme.preset !== "string" || !PRESETS[theme.preset])) {
    throw new Error(
      `data.yaml: "theme.preset" must be one of: ${Object.keys(PRESETS).join(", ")}. Got "${theme.preset}".`
    );
  }

  validateThemeColors(theme);
  validateThemeFont(theme);
}

function validateThemeColors(theme) {
  for (const field of THEME_COLOR_FIELDS) {
    const value = theme[field];
    if (value === undefined || value === "") continue;
    if (typeof value !== "string" || !HEX_COLOR_RE.test(value)) {
      throw new Error(
        `data.yaml: "theme.${field}" must be a hex color (#rgb, #rrggbb, or #rrggbbaa), got "${value}".`
      );
    }
  }
}

function validateThemeFont(theme) {
  if (theme.font !== undefined && theme.font !== "") {
    if (typeof theme.font !== "string" || !FONT_ALLOWLIST_RE.test(theme.font)) {
      throw new Error(
        `data.yaml: "theme.font" contains disallowed characters. Only letters, digits, spaces, and , . ' " - are allowed, got "${theme.font}".`
      );
    }
  }
}

/**
 * Parses an item's `date` field into a normalized { date: Date, year: number }.
 *
 * Accepts, per DESIGN.md:
 *  - "YYYY-MM-DD" or "YYYY" as a string
 *  - a JS Date instance (js-yaml auto-parses unquoted "YYYY-MM-DD" via its
 *    built-in !!timestamp type)
 *  - a plain integer (js-yaml auto-parses unquoted "YYYY" as a number)
 *
 * @param {string|number|Date} raw
 * @param {string} [label]
 * @returns {{date: Date, year: number, hasMonth: boolean}}
 */
export function parseItemDate(raw, label = "date") {
  let date;

  if (raw instanceof Date) {
    date = raw;
  } else if (typeof raw === "number" && Number.isInteger(raw)) {
    date = new Date(Date.UTC(raw, 0, 1));
  } else if (typeof raw === "string") {
    const yearOnly = /^\d{4}$/;
    const fullDate = /^\d{4}-\d{2}-\d{2}$/;
    if (yearOnly.test(raw)) {
      date = new Date(Date.UTC(Number(raw), 0, 1));
    } else if (fullDate.test(raw)) {
      date = new Date(`${raw}T00:00:00Z`);
    } else {
      throw new Error(`${label}: "date" must be "YYYY-MM-DD" or "YYYY", got "${raw}".`);
    }
  } else {
    throw new Error(`${label}: "date" must be "YYYY-MM-DD" or "YYYY".`);
  }

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label}: "date" value "${String(raw)}" is not a valid calendar date.`);
  }

  // hasMonth: true when the source value carried month precision (full date
  // string, or a Date produced by js-yaml from an unquoted YYYY-MM-DD).
  // Year-only inputs ("2026" / 2026) collapse to Jan 1 and must not display a month.
  const hasMonth = raw instanceof Date || (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw));
  return { date, year: date.getUTCFullYear(), hasMonth };
}
