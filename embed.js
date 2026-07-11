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
 * Security note: this listens for messages from any origin (`event.origin`
 * is not checked) so it works out of the box for any historymap deployment.
 * If you control both domains, tighten it by restricting to your own
 * historymap origin(s), e.g.:
 *
 *   if (event.origin !== "https://your-user.github.io") return;
 */
(function () {
  function onMessage(event) {
    var data = event.data;
    if (!data || data.type !== "historymap:height" || typeof data.height !== "number") {
      return;
    }

    var iframes = document.querySelectorAll("iframe[data-historymap]");
    for (var i = 0; i < iframes.length; i++) {
      var iframe = iframes[i];
      if (iframe.contentWindow === event.source) {
        iframe.style.height = data.height + "px";
        break;
      }
    }
  }

  window.addEventListener("message", onMessage);
})();
