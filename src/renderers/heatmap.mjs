// heatmap renderer: GitHub-contributions-style activity density grid.
// Rows = years (oldest to newest, including years with zero items so the
// grid is a continuous run), columns = the 12 calendar months plus an
// "unknown month" column for year-only precision dates. Below the grid, a
// full item listing grouped by year carries the actual content
// (displayLabel/title/subtitle/description/link) — that listing is the
// substantive body of the page, the grid is a navigational overview.

import { escapeHtml, creditFooter, wrapDocument } from "./shared.mjs";
import { parseItemDate } from "../validate.mjs";

const MONTH_COUNT = 12;
const UNKNOWN_COL = 12; // index into the 13-slot counts/titles arrays
const MONTH_LABELS = Array.from({ length: MONTH_COUNT }, (_, i) => String(i + 1));
const UNKNOWN_LABEL = "—";
const LEVEL_TITLES = ["0", "1", "2", "3", "4+"];

// heatmap reserves `id="y-<year>"` for year-section anchors (see
// renderYearSection) and `href="#y-<year>"` for grid-cell links (see
// renderCell). If a user-supplied item id also matches this pattern, it
// would collide with a year anchor's id in the DOM, so the build must fail
// loudly rather than silently render two elements sharing one id.
const YEAR_ANCHOR_ID_RE = /^y-\d+$/;

/**
 * Fails the build if any item's id collides with the reserved
 * `y-<year>` anchor id pattern used for year sections/links in this layout.
 * @param {Array<{id:string, title:string}>} items
 */
function assertNoYearAnchorIdCollision(items) {
  for (const item of items) {
    if (YEAR_ANCHOR_ID_RE.test(item.id)) {
      throw new Error(
        `historymap: heatmap layout reserves ids matching y-<year> for year anchors; rename item "${item.title}" (id "${item.id}").`
      );
    }
  }
}

function levelForCount(count) {
  if (count <= 0) return 0;
  if (count >= 4) return 4;
  return count;
}

function emptyRow(year) {
  return {
    year,
    counts: new Array(MONTH_COUNT + 1).fill(0),
    titles: Array.from({ length: MONTH_COUNT + 1 }, () => []),
    items: [],
  };
}

/**
 * Groups items by year and, within each year, by month (0-11) or the
 * "unknown month" bucket (index 12) for year-only precision dates. Fills in
 * every year between the earliest and latest item — even a year with zero
 * items gets a row — so the grid shows an unbroken run of years.
 *
 * Month precision is re-derived from `parseItemDate`'s `hasMonth`, never
 * from `displayLabel`'s string shape, per the v2 renderer contract.
 *
 * @param {Array} items - already sorted ascending by date (build.mjs)
 * @returns {Array<{year:number, counts:number[], titles:string[][], items:Array}>}
 */
function buildYearRows(items) {
  const byYear = new Map();
  let minYear = Infinity;
  let maxYear = -Infinity;

  for (const item of items) {
    const { year, hasMonth, date } = parseItemDate(item.date, `heatmap: item "${item.title}"`);
    minYear = Math.min(minYear, year);
    maxYear = Math.max(maxYear, year);

    if (!byYear.has(year)) byYear.set(year, emptyRow(year));
    const row = byYear.get(year);
    const col = hasMonth ? date.getUTCMonth() : UNKNOWN_COL;
    row.counts[col] += 1;
    row.titles[col].push(item.title);
    row.items.push(item); // items arrive pre-sorted by date, so this stays sorted
  }

  const rows = [];
  for (let year = minYear; year <= maxYear; year++) {
    rows.push(byYear.get(year) || emptyRow(year));
  }
  return rows;
}

function colKey(col) {
  return col === UNKNOWN_COL ? "none" : String(col + 1);
}

function renderLegend() {
  const swatches = LEVEL_TITLES.map(
    (label, level) => `<span class="hm-cell hm-cell--level-${level}" title="${label}"></span>`
  ).join("");
  return `
  <div class="hm-legend" aria-hidden="true">${swatches}
  </div>`;
}

function renderCell(row, col) {
  const count = row.counts[col];
  const level = levelForCount(count);
  const key = colKey(col);
  const attrs = `data-year="${row.year}" data-col="${key}" data-count="${count}"`;

  if (count === 0) {
    return `<td class="hm-cell-wrap"><span class="hm-cell hm-cell--level-0" ${attrs}></span></td>`;
  }

  const titleAttr = escapeHtml(row.titles[col].join(", "));
  return `<td class="hm-cell-wrap"><a class="hm-cell hm-cell--level-${level}" href="#y-${row.year}" title="${titleAttr}" ${attrs}></a></td>`;
}

function renderRow(row) {
  const hasItems = row.items.length > 0;
  const yearLabel = hasItems
    ? `<a href="#y-${row.year}">${row.year}</a>`
    : `<span class="hm-year-label--empty">${row.year}</span>`;

  const cells = [];
  for (let col = 0; col < MONTH_COUNT; col++) cells.push(renderCell(row, col));
  cells.push(renderCell(row, UNKNOWN_COL));

  return `<tr class="hm-row" data-year="${row.year}" data-year-count="${row.items.length}"><th scope="row">${yearLabel}</th>${cells.join("")}</tr>`;
}

function renderGrid(rows) {
  const headerCells = MONTH_LABELS.map((label) => `<th scope="col">${label}</th>`).join("");
  const rowsHtml = rows.map(renderRow).join("\n        ");

  return `
  <div class="hm-grid-wrap">
    <table class="hm-grid">
      <thead>
        <tr><th scope="col" class="hm-corner"></th>${headerCells}<th scope="col" class="hm-col-unknown">${UNKNOWN_LABEL}</th></tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  </div>`;
}

function renderEntry(item) {
  const subtitle = item.subtitle
    ? `<p class="hm-entry-subtitle">${escapeHtml(item.subtitle)}</p>`
    : "";
  const description = item.description
    ? `<p class="hm-entry-description">${escapeHtml(item.description)}</p>`
    : "";
  const inner = `
        <span class="hm-entry-date">${escapeHtml(item.displayLabel)}</span>
        <h3 class="hm-entry-title">${escapeHtml(item.title)}</h3>
        ${subtitle}
        ${description}`;

  if (item.link) {
    return `
      <li class="hm-entry" id="${escapeHtml(item.id)}">
        <a class="hm-entry-link" href="${escapeHtml(item.link)}" target="_blank" rel="noopener">${inner}
        </a>
      </li>`;
  }

  return `
      <li class="hm-entry" id="${escapeHtml(item.id)}">${inner}
      </li>`;
}

function renderYearSection(row) {
  if (row.items.length === 0) return "";
  const entries = row.items.map(renderEntry).join("\n");
  return `
    <section class="hm-year" id="y-${row.year}">
      <h2 class="hm-year-heading">${row.year}</h2>
      <ul class="hm-year-list">${entries}
      </ul>
    </section>`;
}

function buildStyle(theme) {
  return `
    :root {
      --hm-accent: ${theme.accent};
      --hm-background: ${theme.background};
      --hm-text: ${theme.text};
      --hm-line: ${theme.line};
    }

    * {
      box-sizing: border-box;
    }

    html, body {
      margin: 0;
      padding: 0;
    }

    body {
      background: var(--hm-background);
      color: var(--hm-text);
      font-family: ${theme.fontStack};
      line-height: 1.6;
    }

    .hm-page {
      max-width: 880px;
      margin: 0 auto;
      padding: 56px 24px 32px;
    }

    .hm-header {
      text-align: center;
      margin-bottom: 40px;
    }

    .hm-title {
      font-size: 28px;
      font-weight: 700;
      margin: 0 0 12px;
      letter-spacing: 0.02em;
    }

    .hm-description {
      font-size: 15px;
      color: var(--hm-text);
      opacity: 0.75;
      margin: 0;
    }

    .hm-legend {
      display: flex;
      justify-content: flex-end;
      gap: 4px;
      margin-bottom: 8px;
    }

    .hm-grid-wrap {
      overflow-x: auto;
      padding-bottom: 4px;
      margin-bottom: 48px;
    }

    .hm-grid {
      border-collapse: collapse;
      min-width: 560px;
      width: 100%;
    }

    .hm-grid th,
    .hm-grid td {
      padding: 0;
    }

    .hm-grid thead th {
      font-size: 11px;
      font-weight: 400;
      opacity: 0.55;
      text-align: center;
      padding-bottom: 6px;
    }

    .hm-grid .hm-col-unknown {
      border-left: 1px solid var(--hm-line);
    }

    .hm-grid tbody th {
      text-align: right;
      padding-right: 10px;
      font-size: 13px;
      font-weight: 700;
      white-space: nowrap;
    }

    .hm-grid tbody th a {
      color: var(--hm-accent);
      text-decoration: none;
    }

    .hm-grid tbody th a:hover {
      text-decoration: underline;
    }

    .hm-year-label--empty {
      opacity: 0.4;
      font-weight: 400;
    }

    .hm-cell-wrap {
      padding: 2px;
    }

    .hm-cell {
      display: block;
      width: 16px;
      height: 16px;
      border-radius: 2px;
    }

    a.hm-cell {
      cursor: pointer;
    }

    .hm-cell--level-0 {
      background: color-mix(in srgb, var(--hm-line) 40%, var(--hm-background));
    }

    .hm-cell--level-1 {
      background: color-mix(in srgb, var(--hm-accent) 25%, var(--hm-background));
    }

    .hm-cell--level-2 {
      background: color-mix(in srgb, var(--hm-accent) 50%, var(--hm-background));
    }

    .hm-cell--level-3 {
      background: color-mix(in srgb, var(--hm-accent) 75%, var(--hm-background));
    }

    .hm-cell--level-4 {
      background: var(--hm-accent);
    }

    .hm-years {
      border-top: 1px solid var(--hm-line);
    }

    .hm-year {
      padding: 28px 0;
      border-bottom: 1px solid var(--hm-line);
    }

    .hm-year:last-child {
      border-bottom: none;
    }

    .hm-year-heading {
      font-size: 22px;
      font-weight: 700;
      color: var(--hm-accent);
      margin: 0 0 16px;
    }

    .hm-year-list {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .hm-entry {
      padding: 12px 0;
      border-top: 1px solid var(--hm-line);
    }

    .hm-entry:first-child {
      border-top: none;
      padding-top: 0;
    }

    .hm-entry-link {
      color: inherit;
      text-decoration: none;
      display: block;
    }

    .hm-entry-link:hover .hm-entry-title {
      text-decoration: underline;
    }

    .hm-entry-date {
      display: block;
      font-size: 13px;
      font-weight: 700;
      color: var(--hm-accent);
      opacity: 0.85;
      margin-bottom: 2px;
    }

    .hm-entry-title {
      font-size: 16px;
      font-weight: 700;
      margin: 0 0 4px;
    }

    .hm-entry-subtitle {
      font-size: 13px;
      opacity: 0.7;
      margin: 0 0 6px;
    }

    .hm-entry-description {
      font-size: 14px;
      line-height: 1.8;
      margin: 0;
      opacity: 0.9;
    }

    @media (max-width: 640px) {
      .hm-page {
        padding: 32px 16px 24px;
      }

      .hm-grid-wrap {
        margin-left: -16px;
        margin-right: -16px;
        padding-left: 16px;
        padding-right: 16px;
      }

      .hm-year-heading {
        font-size: 19px;
      }
    }`;
}

/**
 * Renders the heatmap (activity density grid) layout as a complete
 * self-contained HTML document.
 * @param {{title:string, description?:string, lang?:string, items:Array}} data
 *   `data.items` must already be sorted and normalized (id, displayLabel set).
 * @param {object} theme - resolved theme, see src/themes.mjs `resolveTheme`.
 * @returns {string}
 */
export function render(data, theme) {
  const lang = data.lang || "en";
  const description = data.description || "";
  assertNoYearAnchorIdCollision(data.items);
  const rows = buildYearRows(data.items);
  const yearSectionsHtml = rows.map(renderYearSection).join("\n");

  const bodyHtml = `
<div class="hm-page">
  <header class="hm-header">
    <h1 class="hm-title">${escapeHtml(data.title)}</h1>
    ${description ? `<p class="hm-description">${escapeHtml(description)}</p>` : ""}
  </header>
  ${renderLegend()}
  ${renderGrid(rows)}
  <div class="hm-years">${yearSectionsHtml}
  </div>
  ${creditFooter()}
</div>`;

  return wrapDocument({
    lang,
    title: data.title,
    description,
    styleCss: buildStyle(theme),
    bodyHtml,
  });
}
