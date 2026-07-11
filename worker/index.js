/**
 * kenimoto.dev deployment shim — NOT part of the historymap tool itself.
 *
 * Injects the shared /products/ overlay (support links + analytics, served from
 * https://kenimoto.dev/assets/products-overlay.js) into HTML responses.
 *
 * Host-gated: injection only happens when the request hostname is exactly
 * `kenimoto.dev`. Forks deploying anywhere else (workers.dev, your own domain)
 * get plain static file serving — no injection, no external requests.
 * If you fork this repo you can simply delete this directory and the
 * `main` / `assets.binding` lines in wrangler.jsonc.
 */
const OVERLAY_TAG =
  '<script src="https://kenimoto.dev/assets/products-overlay.js" defer></script>';

export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);

    if (new URL(request.url).hostname !== 'kenimoto.dev') return response;

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return response;

    return new HTMLRewriter()
      .on('body', {
        element(el) {
          el.append(OVERLAY_TAG, { html: true });
        },
      })
      .transform(response);
  },
};
