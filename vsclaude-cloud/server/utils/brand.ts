/**
 * The app's mark — a copy of the app's `resources/logo.svg`, without its
 * comment. Inlined rather than served, so a page that draws it is still one
 * response. Its gradient ids are prefixed `vsc-`, so two copies in one page
 * agree on what they point at.
 */
export const APP_MARK = `<svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<defs>
  <linearGradient id="vsc-plate" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#6D28D9"/>
    <stop offset="0.25" stop-color="#8B5CF6"/>
    <stop offset="0.5" stop-color="#C76BC4"/>
    <stop offset="0.75" stop-color="#F0956A"/>
    <stop offset="1" stop-color="#FCC63A"/>
  </linearGradient>
  <linearGradient id="vsc-sheen" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.2"/>
    <stop offset="0.5" stop-color="#FFFFFF" stop-opacity="0"/>
  </linearGradient>
</defs>
<rect width="100" height="100" rx="22.5" fill="url(#vsc-plate)"/>
<rect width="100" height="100" rx="22.5" fill="url(#vsc-sheen)"/>
<svg x="21" y="23" width="58" height="54" viewBox="8.85 -0.05 64.5 60.1">
<g transform="skewX(-12) translate(10 0)" stroke="#FFFFFF" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"><polyline points="5,5 20,55 35,5"/><path d="M61 13C57 6 49 4.5 44 6C36 8.5 36 19 43 24C48 27.5 56 30 60 35C66 43 60 55 49 55C43 55 38 52.5 35 47"/></g>
</svg>
</svg>`

/** The same mark as a `data:` URL, for a page's favicon. */
export const APP_MARK_URL = `data:image/svg+xml,${encodeURIComponent(APP_MARK)}`

/**
 * "Vey Studio" as the brand writes it, for a page's own CSS to size. Drawn
 * beside `APP_MARK`, so it carries no lettermark of its own: the "VS" glyph it
 * used to start with sat next to the mark's own white VS and read as the logo
 * twice.
 */
export const WORDMARK = `<span class="wordmark">Vey Studio</span>`

/** What a page needs to draw `WORDMARK`. */
export const WORDMARK_CSS = `.wordmark { white-space: nowrap; }`
