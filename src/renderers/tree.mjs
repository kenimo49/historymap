// tree renderer — vertical descent-tree ("派生系譜図") built from
// `items[].relations.parent`. Renders parent/child product lineages as a
// nested <ul>/<li> outline; connecting lines are pure CSS (border-left for
// the vertical trunk, border-top for each node's horizontal tick — no JS
// layout calculation, per DESIGN.md).

import { escapeHtml, wrapDocument, creditFooter } from "./shared.mjs";

const TRUNK_INDENT = 32; // px, desktop indent per generation
const TRUNK_INDENT_MOBILE = 18; // px, indent per generation on narrow screens
const TICK_OFFSET = 30; // px, fixed vertical offset for the horizontal tick.
// Fixed (not content-height-aware) on purpose: zigzag's connector uses the
// same "top: 22px regardless of description length" approach, and DESIGN.md
// requires tree to be CSS-only with no JS layout calculation, so a dynamic
// per-node center is out of scope here.

function getParentId(item) {
  return item.relations && item.relations.parent !== undefined ? item.relations.parent : undefined;
}

/**
 * Validates relations.parent references (existence + cycles) and groups
 * items into { roots, childrenOf }. Throws a descriptive Error naming the
 * offending item's title/id on any problem, per DESIGN.md "tree" contract.
 * @param {Array<object>} items - normalized, date-sorted items
 * @returns {{roots: Array<object>, childrenOf: Map<string, Array<object>>}}
 */
function buildTree(items) {
  const byId = new Map(items.map((item) => [item.id, item]));

  for (const item of items) {
    const parentId = getParentId(item);
    if (parentId !== undefined && !byId.has(parentId)) {
      throw new Error(
        `historymap: tree layout — item "${item.title}" (id: "${item.id}") has relations.parent "${parentId}", but no item with that id exists.`
      );
    }
  }

  detectCycles(items, byId);

  const childrenOf = new Map();
  const roots = [];
  for (const item of items) {
    const parentId = getParentId(item);
    if (parentId === undefined) {
      roots.push(item);
      continue;
    }
    if (!childrenOf.has(parentId)) childrenOf.set(parentId, []);
    childrenOf.get(parentId).push(item);
  }

  return { roots, childrenOf };
}

/**
 * Walks the parent chain from every item; if the same id is revisited
 * before reaching a root, that is a cycle. Safe to call only after parent
 * references have already been confirmed to exist (see buildTree above),
 * so byId.get(parentId) is never undefined mid-walk.
 */
function detectCycles(items, byId) {
  for (const item of items) {
    const path = [];
    let current = item;
    while (current) {
      const repeatIndex = path.indexOf(current.id);
      if (repeatIndex !== -1) {
        const cycle = [...path.slice(repeatIndex), current.id];
        throw new Error(
          `historymap: tree layout — circular relations.parent reference detected: ${cycle
            .map((id) => `"${id}"`)
            .join(" -> ")} (discovered while resolving item "${item.title}", id: "${item.id}").`
        );
      }
      path.push(current.id);
      const parentId = getParentId(current);
      current = parentId !== undefined ? byId.get(parentId) : undefined;
    }
  }
}

function renderImage(item) {
  if (!item.image) return "";
  return `
          <span class="tree-node-image">
            <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" loading="lazy" />
          </span>`;
}

function renderNodeBody(item) {
  const subtitle = item.subtitle
    ? `<p class="tree-node-subtitle">${escapeHtml(item.subtitle)}</p>`
    : "";
  const imageHtml = renderImage(item);

  const inner = `${imageHtml}
          <span class="tree-node-text">
            <span class="tree-node-year">${escapeHtml(item.displayLabel)}</span>
            <h3 class="tree-node-title">${escapeHtml(item.title)}</h3>
            ${subtitle}
          </span>`;

  if (item.link) {
    return `
        <a class="tree-node-body tree-node-link" href="${escapeHtml(item.link)}" target="_blank" rel="noopener">${inner}
        </a>`;
  }

  return `
        <div class="tree-node-body">${inner}
        </div>`;
}

/**
 * Renders one item (and, recursively, its descendants) as an <li>.
 * @param {object} item
 * @param {Map<string, Array<object>>} childrenOf
 * @param {boolean} isRoot - roots get the plain `.tree-root` class (no
 *   connector styling — multiple roots are simply stacked, per DESIGN.md).
 */
function renderNodeLi(item, childrenOf, isRoot) {
  const kids = childrenOf.get(item.id) || [];
  const childrenHtml =
    kids.length > 0
      ? `
      <ul class="tree-children">${kids.map((kid) => renderNodeLi(kid, childrenOf, false)).join("")}
      </ul>`
      : "";

  const liClass = isRoot ? "tree-root" : "tree-node";
  return `
    <li class="${liClass}" id="${escapeHtml(item.id)}">${renderNodeBody(item)}${childrenHtml}
    </li>`;
}

function buildStyle(theme) {
  return `
    :root {
      --hm-accent: ${theme.accent};
      --hm-background: ${theme.background};
      --hm-text: ${theme.text};
      --hm-line: ${theme.line};
      --hm-trunk-indent: ${TRUNK_INDENT}px;
      --hm-tick-offset: ${TICK_OFFSET}px;
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
      max-width: 780px;
      margin: 0 auto;
      padding: 56px 24px 32px;
    }

    .hm-header {
      text-align: center;
      margin-bottom: 48px;
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

    .tree-forest {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .tree-root {
      margin: 0 0 40px;
    }

    .tree-root:last-child {
      margin-bottom: 0;
    }

    .tree-children {
      list-style: none;
      margin: 0;
      padding: 0 0 0 var(--hm-trunk-indent);
      position: relative;
    }

    .tree-children::before {
      content: "";
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      width: 0;
      border-left: 1px solid var(--hm-line);
    }

    .tree-children > li {
      position: relative;
    }

    .tree-children > li::before {
      content: "";
      position: absolute;
      top: var(--hm-tick-offset);
      left: calc(-1 * var(--hm-trunk-indent));
      width: var(--hm-trunk-indent);
      height: 0;
      border-top: 1px solid var(--hm-line);
    }

    /* Trim the trunk below the last sibling's tick so it doesn't run past
       the tree, by painting over the leftover segment with the page
       background (the trunk line itself lives on .tree-children::before,
       which always spans the container's full height). */
    .tree-children > li:last-child::after {
      content: "";
      position: absolute;
      top: var(--hm-tick-offset);
      bottom: 0;
      left: calc(-1 * var(--hm-trunk-indent) - 1px);
      width: 3px;
      background: var(--hm-background);
    }

    .tree-node,
    .tree-root {
      padding: 10px 0;
    }

    .tree-node-body {
      display: flex;
      align-items: center;
      gap: 16px;
      color: inherit;
      text-decoration: none;
    }

    a.tree-node-link:hover .tree-node-title {
      text-decoration: underline;
    }

    .tree-node-image {
      flex: 0 0 auto;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: #ffffff;
      border: 1px solid var(--hm-line);
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 6px;
    }

    .tree-node-image img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .tree-node-text {
      flex: 1 1 auto;
      min-width: 0;
    }

    .tree-node-year {
      display: block;
      font-size: 15px;
      font-weight: 700;
      color: var(--hm-accent);
      line-height: 1.3;
    }

    .tree-node-title {
      font-size: 16px;
      font-weight: 700;
      margin: 2px 0 0;
    }

    .tree-node-subtitle {
      font-size: 13px;
      opacity: 0.7;
      margin: 2px 0 0;
    }

    .hm-footer {
      text-align: center;
      margin-top: 56px;
    }

    .hm-credit {
      font-size: 10px;
      color: var(--hm-text);
      opacity: 0.45;
      text-decoration: none;
    }

    .hm-credit:hover {
      text-decoration: underline;
    }

    @media (max-width: 640px) {
      .hm-page {
        padding: 32px 16px 24px;
      }

      .tree-children {
        padding-left: ${TRUNK_INDENT_MOBILE}px;
      }

      .tree-children > li::before {
        left: -${TRUNK_INDENT_MOBILE}px;
        width: ${TRUNK_INDENT_MOBILE}px;
      }

      .tree-children > li:last-child::after {
        left: -${TRUNK_INDENT_MOBILE + 1}px;
      }

      .tree-node-image {
        width: 40px;
        height: 40px;
      }

      .tree-node-body {
        gap: 10px;
      }

      .tree-node-title {
        font-size: 14px;
      }
    }`;
}

/**
 * Renders the tree ("派生系譜図") layout as a complete self-contained HTML
 * document: items whose `relations.parent` is absent become roots (stacked
 * vertically when there is more than one); everything else nests under its
 * parent as a CSS-only connected outline.
 *
 * @param {{title:string, description?:string, lang?:string, items:Array}} data
 *   `data.items` must already be sorted and normalized (id, displayLabel set).
 * @param {object} theme - resolved theme, see src/themes.mjs `resolveTheme`.
 * @returns {string}
 */
export function render(data, theme) {
  const lang = data.lang || "en";
  const description = data.description || "";
  const { roots, childrenOf } = buildTree(data.items);

  const forestHtml = roots.map((root) => renderNodeLi(root, childrenOf, true)).join("");

  const bodyHtml = `
<div class="hm-page">
  <header class="hm-header">
    <h1 class="hm-title">${escapeHtml(data.title)}</h1>
    ${description ? `<p class="hm-description">${escapeHtml(description)}</p>` : ""}
  </header>
  <ul class="tree-forest">${forestHtml}
  </ul>${creditFooter()}
</div>`;

  return wrapDocument({
    lang,
    title: data.title,
    description,
    styleCss: buildStyle(theme),
    bodyHtml,
  });
}
