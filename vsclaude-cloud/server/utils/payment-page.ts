import { ARRIVAL_CSS } from "./arrival-page.ts"
import { APP_MARK, APP_MARK_URL, WORDMARK, WORDMARK_CSS } from "./brand.ts"
import { html, raw, type SafeHtml } from "./html.ts"

/**
 * The shell of the payment page — `/pay/<code>` (bank transfer, in
 * Vietnamese): the landing's palette and
 * type, the app's mark at the top, and one card every state of the page is
 * drawn in. One self-contained document, like the landing — somebody arrives
 * here from the studio mid-purchase, and it should look like the same product.
 */

const PAYMENT_CSS = `
  :root {
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
    --accent-soft: #c4b5fd;
    --ok: #86efac;
    --warn: #fcd34d;
    --sans: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    --mono: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace;
    font-family: var(--sans);
    -webkit-font-smoothing: antialiased;
  }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: flex; flex-direction: column;
    background: var(--page); color: var(--ink); font-size: 15px; line-height: 1.55; }
  /* The landing's haze from above, smaller: the same light, a shorter page. */
  body::before { content: ""; position: fixed; inset: 0 0 auto; height: 560px; pointer-events: none; z-index: -1;
    background: radial-gradient(900px 440px at 50% -140px, rgb(124 92 246 / 0.34), rgb(76 52 160 / 0.1) 55%, transparent 80%); }
  .wrap { width: min(44rem, 100% - 2rem); margin-inline: auto; }
  .wrap.narrow { width: min(27rem, 100% - 2rem); }

  .top { border-bottom: 1px solid var(--edge); }
  .top .wrap { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1rem 0; }
  .logo { display: flex; align-items: center; gap: 0.6rem; font-weight: 600; letter-spacing: -0.015em; }
  .logo > svg { width: 1.6rem; height: 1.6rem; }
  ${WORDMARK_CSS}
  .secure { display: inline-flex; align-items: center; gap: 0.4rem; color: var(--muted); font-size: 0.8rem; }
  .secure svg { width: 0.9rem; height: 0.9rem; }

  main { flex: 1; padding: 3rem 0 2.5rem; }
  .panel { border: 1px solid var(--edge-strong); border-radius: 16px; background: var(--raised);
    box-shadow: 0 30px 80px rgb(0 0 0 / 0.45); padding: 1.75rem; }
  .kicker { margin: 0; color: var(--faint); font-family: var(--mono); font-size: 0.7rem;
    letter-spacing: 0.12em; text-transform: uppercase; }
  h1 { margin: 0.55rem 0 0; font-size: 1.6rem; font-weight: 500; letter-spacing: -0.035em; line-height: 1.2; text-wrap: balance; }
  .lede { margin: 0.4rem 0 0; color: var(--muted); text-wrap: pretty; }

  .status { display: flex; align-items: center; gap: 0.65rem; margin: 1.5rem 0 0; padding: 0.75rem 0.95rem;
    border: 1px solid var(--edge); border-radius: 10px; background: rgb(255 255 255 / 0.03); color: var(--body); font-size: 0.9rem; }
  .status .dot { flex: none; width: 0.55rem; height: 0.55rem; border-radius: 50%; background: var(--accent);
    box-shadow: 0 0 0 4px rgb(139 92 246 / 0.18); animation: pulse 1.4s ease-in-out infinite; }
  .status.done { border-color: rgb(134 239 172 / 0.28); background: rgb(134 239 172 / 0.07); color: var(--ok); }
  .status.done .dot { background: var(--ok); box-shadow: 0 0 0 4px rgb(134 239 172 / 0.16); animation: none; }
  .status.warn { border-color: rgb(252 211 77 / 0.3); background: rgb(252 211 77 / 0.07); color: var(--warn); }
  .status.warn .dot { background: var(--warn); box-shadow: 0 0 0 4px rgb(252 211 77 / 0.16); animation: none; }

  .foot { padding: 0 0 2rem; color: var(--faint); font-size: 0.78rem; text-align: center; }

  @keyframes pulse { 0%, 100% { opacity: 0.4; transform: scale(0.85); } 50% { opacity: 1; transform: scale(1); } }
  @keyframes spin { to { transform: rotate(360deg); } }
  @media (max-width: 420px) { .secure span { display: none; } }
  @media (prefers-reduced-motion: reduce) { .status .dot { animation: none; } }`

const LOCK = raw(
  `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/></svg>`
)

export function paymentDocument(input: {
  lang: string
  title: string
  /** What the top bar says beside the lock, in the page's language. */
  secure: string
  /** The page's own CSS, on top of the shell's. A constant: CSS is not
   * escaped, since `.logo > svg` written as `&gt;` is no selector at all. */
  css: string
  /** `<main>`'s content; the scripts go after it. */
  main: SafeHtml
  narrow?: boolean
  foot?: string
  scripts?: SafeHtml
}): SafeHtml {
  const wrap = input.narrow ? "wrap narrow" : "wrap"
  return html`<!doctype html>
    <html lang="${input.lang}">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#09090c" />
        <meta name="robots" content="noindex" />
        <title>${input.title}</title>
        <link rel="icon" href="${APP_MARK_URL}" />
        <style>
          ${raw(PAYMENT_CSS + input.css + ARRIVAL_CSS)}
        </style>
      </head>
      <body>
        <header class="top">
          <div class="${wrap}">
            <span class="logo">${raw(APP_MARK)}${raw(WORDMARK)}</span>
            <span class="secure" title="${input.secure}"
              >${LOCK}<span>${input.secure}</span></span
            >
          </div>
        </header>
        <main><div class="${wrap}">${input.main}</div></main>
        ${input.foot && html`<footer class="foot wrap">${input.foot}</footer>`}
        ${input.scripts}
      </body>
    </html>`
}
