import { APP_MARK, WORDMARK, WORDMARK_CSS } from "./brand.ts"
import { COPY, LANGS, pathOf, type Lang } from "./landing-copy.ts"

/**
 * What the home page and the user's guide (`docs/`, VitePress) share: the
 * palette, the haze at the top and the bar across it. One module, so the guide
 * cannot drift from the page it is linked from — the guide's theme draws
 * `siteNav` in place of VitePress's own bar, and puts these styles in its head.
 */

export const RELEASES_URL =
  "https://github.com/vsclaude/visual-studio-claude/releases/latest"

/** Where the guide lives in each language — VitePress's locales. */
export function docsPathOf(lang: Lang): string {
  return lang === "en" ? "/docs/" : `/docs/${lang}/`
}

export const ICON = {
  download:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
  arrow:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>',
  globe:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3z"/></svg>',
}

/** A button in two parts — the words, and an icon in a cell of its own. The
 * hero's download buttons carry `data-download-label`, which the home page's
 * script rewrites to name the visitor's platform. */
export function splitButton(
  kind: "primary" | "ghost",
  href: string,
  label: string,
  icon: string,
  options: { download?: boolean; relabel?: boolean } = {}
): string {
  return `<a class="button ${kind}${options.download ? " download" : ""}" href="${href}"><span${options.relabel ? " data-download-label" : ""}>${label}</span><i>${icon}</i></a>`
}

/** The `EN | VI` switch: plain links, so it works with no script at all.
 * `hrefOf` is where each language's copy of *this* page is. */
function languageSwitch(current: Lang, hrefOf: (lang: Lang) => string): string {
  return `<div class="lang" role="group" aria-label="${COPY[current].nav.language}">${ICON.globe}${LANGS.map(
    (lang) =>
      `<a href="${hrefOf(lang)}" hreflang="${COPY[lang].htmlLang}" lang="${COPY[lang].htmlLang}"${lang === current ? ' aria-current="true"' : ""}>${COPY[lang].short}</a>`
  ).join("")}</div>`
}

/** The bar's left half: the mark, and the pill of links. On the home page the
 * links are the page's own anchors; anywhere else they lead back to them. */
export function navStart(lang: Lang, onHome = false): string {
  const t = COPY[lang].nav
  const home = pathOf(lang)
  const at = onHome ? "" : home
  return `<a class="logo" href="${home}">${APP_MARK}${WORDMARK}</a>
    <div class="pill">
      <a href="${at}#why">${t.why}</a>
      <a href="${at}#features">${t.features}</a>
      <a href="${at}#credits">${t.pricing}</a>
      <a href="${at}#faq">${t.faq}</a>
      <a href="${docsPathOf(lang)}">${t.docs}</a>
    </div>`
}

/** The bar's right half, the inside of `.nav-end`. Two halves because the
 * guide's search is a Vue component, which cannot live inside an HTML string:
 * it sits between them, at the head of `.nav-end`. */
export function navEnd(
  lang: Lang,
  langHref: (lang: Lang) => string = pathOf
): string {
  return `${languageSwitch(lang, langHref)}
      ${splitButton("ghost", RELEASES_URL, COPY[lang].nav.download, ICON.arrow, { download: true })}`
}

/** The bar across the top, whole — the home page's. */
export function siteNav(lang: Lang, onHome = false): string {
  return `<nav class="site-nav">
    ${navStart(lang, onHome)}
    <div class="nav-end">
      ${navEnd(lang)}
    </div>
  </nav>`
}

/** The palette and the type, as custom properties. */
export const SITE_TOKENS_CSS = `:root {
    color-scheme: dark;
    --page: #09090c;
    --raised: #0f0f13;
    --edge: rgb(255 255 255 / 0.08);
    --edge-strong: rgb(255 255 255 / 0.14);
    --ink: #f4f4f5;
    --body: #c9c9d1;
    --muted: #8e8e99;
    --faint: #5f5f69;
    --accent: #8b5cf6;
    --accent-hover: #7c4ff0;
    --accent-soft: #c4b5fd;
    --sans: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    /* Cambria and Palatino ahead of Georgia: Windows' Georgia has no "ế",
       and the browser draws it as "ê" with a loose acute beside it. */
    --serif: ui-serif, "New York", "Iowan Old Style", Charter, Cambria, "Palatino Linotype", Georgia, serif;
    --mono: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace;
  }`

/** The bar, its buttons and the haze behind it. */
export const SITE_NAV_CSS = `/* The haze at the top, and one curved hairline through it: light from
     above rather than coloured blobs. Clipped in a box of its own, so it can
     be wider than the page without the page scrolling sideways. */
  .sky { position: absolute; inset: 0 0 auto; height: 820px; overflow: hidden; pointer-events: none; z-index: -1; }
  .sky::before {
    content: ""; position: absolute; inset: 0;
    background: radial-gradient(1100px 560px at 50% -120px, rgb(124 92 246 / 0.42), rgb(76 52 160 / 0.14) 55%, transparent 80%);
  }
  .sky::after {
    /* High enough to pass over the chip and not through the headline. */
    content: ""; position: absolute; left: -30%; right: -30%; top: -880px; height: 1020px; border-radius: 50%;
    border-bottom: 1px solid rgb(255 255 255 / 0.10);
    background: radial-gradient(closest-side, rgb(255 255 255 / 0.035), transparent);
  }

  /* ---- Navigation ---- */
  .site-nav { display: flex; align-items: center; gap: 1.5rem; padding: 1.1rem 0; border-bottom: 1px solid var(--edge); }
  .logo { display: flex; align-items: center; gap: 0.6rem; font-weight: 600; letter-spacing: -0.015em; white-space: nowrap; }
  .logo > svg { width: 1.75rem; height: 1.75rem; }
  ${WORDMARK_CSS}
  .pill { display: flex; gap: 2px; margin: 0 auto; padding: 4px; border-radius: 10px; border: 1px solid var(--edge-strong); background: rgb(255 255 255 / 0.04); }
  .pill a { padding: 0.32rem 0.85rem; border-radius: 7px; font-size: 0.86rem; color: var(--body); }
  .pill a:hover { background: rgb(255 255 255 / 0.07); color: var(--ink); }
  .nav-end { display: flex; align-items: center; gap: 1rem; }
  .lang { display: inline-flex; align-items: center; gap: 0.15rem; color: var(--muted); }
  .lang svg { width: 0.9rem; height: 0.9rem; margin-right: 0.3rem; }
  .lang a { padding: 0.15rem 0.35rem; border-radius: 4px; font-size: 0.74rem; font-weight: 600; letter-spacing: 0.06em; color: var(--faint); }
  .lang a:hover { color: var(--ink); }
  .lang a[aria-current] { color: var(--ink); }

  /* ---- Buttons: words, then an icon in its own cell ---- */
  .button {
    display: inline-flex; align-items: stretch; border-radius: 7px; font-weight: 500; font-size: 0.92rem;
    border: 1px solid var(--edge-strong); white-space: nowrap; overflow: hidden; transition: background 0.15s, border-color 0.15s;
  }
  .button span { padding: 0.62rem 1rem; }
  .button i { display: grid; place-items: center; padding: 0 0.75rem; border-left: 1px solid var(--edge-strong); }
  .button svg { width: 1rem; height: 1rem; }
  .button.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
  .button.primary i { border-left-color: rgb(255 255 255 / 0.28); }
  .button.primary:hover { background: var(--accent-hover); }
  .button.ghost { background: rgb(255 255 255 / 0.02); }
  .button.ghost:hover { background: rgb(255 255 255 / 0.06); }
  .site-nav .button { font-size: 0.84rem; }
  .site-nav .button span { padding: 0.42rem 0.8rem; }
  .site-nav .button i { padding: 0 0.55rem; }

  @media (max-width: 900px) {
    .pill { display: none; }
    .nav-end { margin-left: auto; }
  }
  /* A phone has room for the name and the language, not a third control —
     and the hero's own download button is the next thing on screen. */
  @media (max-width: 480px) {
    .site-nav .download { display: none; }
  }`
