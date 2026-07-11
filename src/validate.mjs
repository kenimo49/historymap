// Schema validation for data.yaml. Throws Error with a clear, actionable
// message on the first problem found (fail fast, fail loud).

const VALID_LAYOUTS = ["zigzag"];
const STRING_ITEM_FIELDS = ["id", "subtitle", "description", "image", "link"];

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

  if (typeof data.title !== "string" || data.title.trim() === "") {
    throw new Error('data.yaml: "title" is required and must be a non-empty string.');
  }

  if (data.description !== undefined && typeof data.description !== "string") {
    throw new Error('data.yaml: "description" must be a string.');
  }

  if (data.lang !== undefined && typeof data.lang !== "string") {
    throw new Error('data.yaml: "lang" must be a string.');
  }

  const layout = data.layout ?? "zigzag";
  if (!VALID_LAYOUTS.includes(layout)) {
    throw new Error(
      `data.yaml: "layout: ${layout}" is not supported in v1. Valid values: ${VALID_LAYOUTS.join(", ")}.`
    );
  }

  if (
    data.theme !== undefined &&
    (typeof data.theme !== "object" || Array.isArray(data.theme) || data.theme === null)
  ) {
    throw new Error('data.yaml: "theme" must be a mapping (object).');
  }

  if (!Array.isArray(data.items) || data.items.length === 0) {
    throw new Error('data.yaml: "items" is required and must be a non-empty array with at least 1 item.');
  }

  data.items.forEach((item, index) => validateItem(item, index));

  return { ...data, layout };
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

  for (const field of STRING_ITEM_FIELDS) {
    if (item[field] !== undefined && typeof item[field] !== "string") {
      throw new Error(`${label}: "${field}" must be a string.`);
    }
  }

  if (item.tags !== undefined && !Array.isArray(item.tags)) {
    throw new Error(`${label}: "tags" must be an array.`);
  }

  if (
    item.relations !== undefined &&
    (typeof item.relations !== "object" || Array.isArray(item.relations) || item.relations === null)
  ) {
    throw new Error(`${label}: "relations" must be a mapping (object). (v1 does not use its contents.)`);
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
