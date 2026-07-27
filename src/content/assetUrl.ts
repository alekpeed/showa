/**
 * Resolves a content asset path against wherever the app is being served from.
 *
 * Content JSON stores web-absolute paths like `/assets/thumbnails/showa/x.webp`,
 * which is right for the packaged app -- it is served from the root. A web
 * preview on GitHub Pages is served from a subpath instead, where a leading
 * slash would resolve to the domain root and 404 every thumbnail and photograph.
 *
 * Prefixing with Vite's BASE_URL makes the same manifests work in both, so the
 * browser preview shows exactly what the desktop app shows.
 */

export function assetUrl(path: string): string {
  // Absolute URLs (anything a manifest points at off-site) pass through.
  if (/^[a-z]+:\/\//i.test(path)) return path;

  const base = import.meta.env.BASE_URL || "/";
  return `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}
