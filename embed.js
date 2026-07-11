/*!
 * historymap embed.js
 *
 * Drop this on the parent page that embeds a historymap iframe. It listens
 * for `historymap:height` messages posted by the generated page and resizes
 * the matching <iframe data-historymap> element accordingly, so the embed
 * never shows its own scrollbar and never leaves dead space below it.
 *
 * Usage:
 *   <iframe data-historymap src="https://your-user.github.io/your-repo/" ...></iframe>
 *   <script src="embed.js"></script>
 *
 * Multiple embeds on the same page are supported: the resize is matched by
 * `event.source` (the iframe's window), not by URL, so it's safe even if two
 * iframes point at the same src.
 *
 * Security notes:
 *  - Height values are sanity-checked: only finite, non-negative numbers are
 *    applied; a value above 100000 is clamped to 100000, and a non-finite
 *    value (NaN/Infinity) is ignored outright.
 *  - By default this listens for messages from any origin (`event.origin` is
 *    not checked) so it works out of the box for any historymap deployment.
 *    To restrict it to your own historymap origin(s), define an allowlist
 *    BEFORE loading this script:
 *
 *      <script>
 *        window.HISTORYMAP_ALLOWED_ORIGINS = ["https://your-user.github.io"];
 *      </script>
 *      <script src="embed.js"></script>
 *
 *    When `HISTORYMAP_ALLOWED_ORIGINS` is a non-empty array, messages whose
 *    `event.origin` is not in the list are ignored. When it is left undefined
 *    (the default), all origins are accepted, same as before.
 */
(function () {
  var MAX_HEIGHT = 100000;

  function isOriginAllowed(origin) {
    var allowed = window.HISTORYMAP_ALLOWED_ORIGINS;
    if (!Array.isArray(allowed) || allowed.length === 0) {
      return true;
    }
    return allowed.indexOf(origin) !== -1;
  }

  function onMessage(event) {
    var data = event.data;
    if (!data || data.type !== "historymap:height") {
      return;
    }
    if (!isOriginAllowed(event.origin)) {
      return;
    }

    var height = data.height;
    if (!Number.isFinite(height) || height < 0) {
      return;
    }
    if (height > MAX_HEIGHT) {
      height = MAX_HEIGHT;
    }

    var iframes = document.querySelectorAll("iframe[data-historymap]");
    for (var i = 0; i < iframes.length; i++) {
      var iframe = iframes[i];
      if (iframe.contentWindow === event.source) {
        iframe.style.height = height + "px";
        break;
      }
    }
  }

  window.addEventListener("message", onMessage);
})();
