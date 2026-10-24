/** What the bar and the home page both link to, and the icons they draw. */

export const RELEASES_URL =
  "https://github.com/veystudioapp/vey-studio-releases/releases/latest"

export const ICON = {
  download:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
  arrow:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>',
  globe:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3z"/></svg>',
}

/** `vi/docs/credits.md` → `docs/credits`: the page's path inside its locale,
 * so the language switch can go to the same page in the other one. */
export function slugOf(relativePath: string): string {
  return relativePath
    .replace(/^vi\//, "")
    .replace(/\.md$/, "")
    .replace(/(^|\/)index$/, "$1")
}
