// Shared helpers for all renderers: HTML escaping, the iframe height
// auto-notify script, the credit footer, and the common document shell.
// Every renderer must escape user-supplied strings with escapeHtml and
// embed buildHeightScript() (or use wrapDocument, which does both shell
// concerns for you).

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return ch;
    }
  });
}

export function buildHeightScript() {
  return `
    (function () {
      function sendHeight() {
        var height = document.documentElement.scrollHeight;
        parent.postMessage({ type: "historymap:height", height: height }, "*");
      }
      if (typeof ResizeObserver !== "undefined") {
        var observer = new ResizeObserver(sendHeight);
        observer.observe(document.documentElement);
      }
      window.addEventListener("load", sendHeight);
      sendHeight();
    })();`;
}

export function creditFooter() {
  return `
  <footer class="hm-footer">
    <a class="hm-credit" href="https://github.com/kenimo49/historymap" target="_blank" rel="noopener">Generated with historymap</a>
  </footer>`;
}

/**
 * Wraps renderer-specific body markup in the common document shell:
 * doctype, <head> (charset/viewport/title/description/inline style),
 * the body content, and the iframe height auto-notify script.
 *
 * The credit footer is NOT injected automatically — include creditFooter()
 * inside bodyHtml wherever the layout wants it (usually last inside the
 * page wrapper), so it inherits the page's max-width and padding.
 *
 * @param {object} options
 * @param {string} [options.lang] - html lang attribute (default "en")
 * @param {string} options.title - page title (escaped here)
 * @param {string} [options.description] - meta description (escaped here)
 * @param {string} options.styleCss - full CSS text for the inline <style> block
 * @param {string} options.bodyHtml - everything inside <body> (already escaped by the caller)
 * @returns {string}
 */
export function wrapDocument({ lang = "en", title, description = "", styleCss, bodyHtml }) {
  return `<!DOCTYPE html>
<html lang="${escapeHtml(lang)}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
${description ? `<meta name="description" content="${escapeHtml(description)}" />\n` : ""}<style>${styleCss}
</style>
</head>
<body>
${bodyHtml}
<script>${buildHeightScript()}
</script>
</body>
</html>
`;
}
