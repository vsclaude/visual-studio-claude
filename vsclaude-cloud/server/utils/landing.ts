import { CREDIT_PACKS, type CreditItem } from "./billing.ts"
import { APP_MARK, APP_MARK_URL, WORDMARK, WORDMARK_CSS } from "./brand.ts"
import { FEATURE_ART, type FeatureArt } from "./landing-art.ts"
import { COPY, LANGS, pathOf, type Copy, type Lang } from "./landing-copy.ts"

/**
 * The home page: what VS Claude is, what credits cost, and where to
 * download it.
 *
 * One self-contained document, like the sign-in page — no stylesheet, font or
 * script from anywhere else — so it is a single response from the Worker and
 * nothing on it can go missing.
 *
 * **The prices are `CREDIT_PACKS`'**, the table the checkout charges from, so
 * this page cannot advertise a price `/api/orders` will not ask. What the
 * server's table does not carry — the bonus each pack is sold with and which
 * one is steered toward — is `PACK_EXTRAS` below, and it must say what the
 * studio's own dialog says (`src/shared/credits.ts` in the app). The words are
 * `landing-copy.ts`', one set per language.
 *
 * **Restraint is the look.** The first version had a gradient on every
 * headline, glows, twinkling sparks and a ring of light round a price — and
 * read as generated. What is left: one accent colour, hairlines, small radii,
 * cells that share their borders like a table, a serif italic where a
 * headline wants weight, and motion only where it shows the product working.
 * The violet-to-amber gradient is the logo's and nothing else's.
 */

export const RELEASES_URL =
  "https://github.com/vsclaude/visual-studio-claude/releases/latest"

const PACK_EXTRAS: Record<CreditItem, { bonus?: number; popular?: boolean }> = {
  "credits-20k": {},
  "credits-60k": { bonus: 10, popular: true },
  "credits-100k": { bonus: 20 },
}

const VND = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
})

/** `3.3M`, `250,000` — the studio's own `formatCredits`. */
export function formatCredits(credits: number): string {
  return credits >= 1_000_000
    ? `${Number((credits / 1_000_000).toFixed(1))}M`
    : credits.toLocaleString("en-US")
}

/** The packs as the page draws them, cheapest first. */
export function packsForSale(): {
  id: CreditItem
  price: string
  credits: string
  bonus?: number
  popular: boolean
}[] {
  return (Object.keys(CREDIT_PACKS) as CreditItem[])
    .sort((a, b) => CREDIT_PACKS[a].price - CREDIT_PACKS[b].price)
    .map((id) => ({
      id,
      price: VND.format(CREDIT_PACKS[id].price),
      credits: formatCredits(CREDIT_PACKS[id].credits),
      bonus: PACK_EXTRAS[id].bonus,
      popular: PACK_EXTRAS[id].popular === true,
    }))
}

const SPARKLE =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9.94 14.06 4 12l5.94-2.06L12 4l2.06 5.94L20 12l-5.94 2.06L12 20z"/></svg>'

const ICON = {
  download:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
  arrow:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>',
  globe:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3z"/></svg>',
}

/** Which illustration sits over each feature, in the order `Copy` lists them. */
const FEATURE_ORDER: FeatureArt[] = [
  "chats",
  "diff",
  "worktrees",
  "modes",
  "terminal",
  "meter",
]

/** The three problems' illustrations, in the order `Copy` lists them. */
const PILLAR_ORDER: FeatureArt[] = ["profiles", "handoff", "accounts"]

/** What the studio runs, for the "works with" strip. Names, not logos. */
const WORKS_WITH = [
  "Claude Code",
  "Claude Haiku",
  "Claude Sonnet",
  "Claude Opus",
  "Git",
  "macOS",
  "Windows",
  "Linux",
]

/** `01`, `02` — the cells' numbers. */
const nth = (i: number) => String(i + 1).padStart(2, "0")

function featureCell(
  feature: Copy["features"]["items"][number],
  i: number,
  order: FeatureArt[] = FEATURE_ORDER
): string {
  return `<article class="cell reveal" style="--d:${(i % 3) * 0.06}s">
      <span class="num">${nth(i)}</span>
      <div class="art">${FEATURE_ART[order[i]]()}</div>
      <h3>${feature.title}</h3>
      <p>${feature.body}</p>
    </article>`
}

function packCell(
  t: Copy["pricing"],
  pack: ReturnType<typeof packsForSale>[number],
  i: number
): string {
  return `<article class="cell pack reveal${pack.popular ? " popular" : ""}" style="--d:${i * 0.06}s">
      <span class="num">${pack.popular ? `<em>${t.popular}</em>` : nth(i)}</span>
      <p class="pack-credits"><strong>${pack.credits}</strong> ${t.credits}</p>
      <p class="pack-bonus">${pack.bonus ? t.bonus(pack.bonus) : t.starter}</p>
      <p class="pack-price">${pack.price}</p>
      <p class="pack-note">${t.note}</p>
    </article>`
}

/** The `EN | VI` switch: plain links, so it works with no script at all. */
function languageSwitch(current: Lang, t: Copy): string {
  return `<div class="lang" role="group" aria-label="${t.nav.language}">${ICON.globe}${LANGS.map(
    (lang) =>
      `<a href="${pathOf(lang)}" hreflang="${COPY[lang].htmlLang}" lang="${COPY[lang].htmlLang}"${lang === current ? ' aria-current="true"' : ""}>${COPY[lang].short}</a>`
  ).join("")}</div>`
}

/** A button in two parts — the words, and an icon in a cell of its own. The
 * hero's download buttons carry `data-download-label`, which the script below
 * rewrites to name the visitor's platform. */
function splitButton(
  kind: "primary" | "ghost",
  href: string,
  label: string,
  icon: string,
  options: { download?: boolean; relabel?: boolean } = {}
): string {
  return `<a class="button ${kind}${options.download ? " download" : ""}" href="${href}"><span${options.relabel ? " data-download-label" : ""}>${label}</span><i>${icon}</i></a>`
}

/** The page, whole, in one language. `year` is an argument so a test can pin it. */
export function landingPage(
  lang: Lang = "en",
  year = new Date().getFullYear()
): string {
  const t = COPY[lang]
  const home = pathOf(lang)
  const download = (kind: "primary" | "ghost") =>
    splitButton(kind, RELEASES_URL, t.cta.download, ICON.download, {
      download: true,
      relabel: true,
    })
  return `<!doctype html>
<html lang="${t.htmlLang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${t.title}</title>
<meta name="description" content="${t.description}">
<meta property="og:title" content="VS Claude">
<meta property="og:description" content="${t.ogDescription}">
<meta name="theme-color" content="#09090c">
<link rel="icon" href="${APP_MARK_URL}">
${LANGS.map((l) => `<link rel="alternate" hreflang="${COPY[l].htmlLang}" href="${pathOf(l)}">`).join("\n")}
<link rel="alternate" hreflang="x-default" href="/">
<script>document.documentElement.classList.add("js")</script>
<style>
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
    --accent-hover: #7c4ff0;
    --accent-soft: #c4b5fd;
    --sans: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    --serif: ui-serif, "New York", "Iowan Old Style", Charter, Georgia, serif;
    --mono: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace;
    font-family: var(--sans);
    -webkit-font-smoothing: antialiased;
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body { margin: 0; background: var(--page); color: var(--ink); line-height: 1.55; font-size: 15px; }
  a { color: inherit; text-decoration: none; }
  .wrap { width: min(1080px, 100% - 3rem); margin-inline: auto; }
  em.accent { font-family: var(--serif); font-style: italic; font-weight: 400; letter-spacing: -0.02em; color: #d8d4ea; }

  /* The haze at the top, and one curved hairline through it: light from
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
  nav { display: flex; align-items: center; gap: 1.5rem; padding: 1.1rem 0; border-bottom: 1px solid var(--edge); }
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
  nav .button { font-size: 0.84rem; }
  nav .button span { padding: 0.42rem 0.8rem; }
  nav .button i { padding: 0 0.55rem; }

  /* ---- Hero ---- */
  header.hero { position: relative; padding: 6.5rem 0 2rem; text-align: center; }
  .chip {
    display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.38rem 0.8rem; border-radius: 6px;
    border: 1px solid var(--edge-strong); background: rgb(255 255 255 / 0.06); color: var(--body); font-size: 0.8rem;
  }
  .chip svg { width: 0.8rem; height: 0.8rem; color: var(--ink); }
  h1 { font-size: clamp(2.4rem, 5.6vw, 4.1rem); line-height: 1.04; font-weight: 500; letter-spacing: -0.045em; margin: 1.5rem auto 1.25rem; max-width: 24ch; text-wrap: balance; }
  h1 em.accent { display: block; }
  .lede { font-size: 1.05rem; color: var(--muted); max-width: 37rem; margin: 0 auto 2rem; text-wrap: pretty; }
  .ctas { display: flex; gap: 0.6rem; justify-content: center; flex-wrap: wrap; }
  .fine { margin-top: 1.1rem; color: var(--faint); font-family: var(--mono); font-size: 0.72rem; letter-spacing: 0.02em; }

  /* The studio in miniature — drawn, not screenshotted, so it stays sharp. */
  figure.window-frame { margin: 4rem auto 0; max-width: 960px; }
  .window {
    border-radius: 10px; overflow: hidden; text-align: left; border: 1px solid var(--edge-strong); background: var(--raised);
    box-shadow: 0 30px 80px rgb(0 0 0 / 0.5);
  }
  figcaption { margin-top: 0.9rem; color: var(--faint); font-size: 0.78rem; }
  .titlebar { display: flex; align-items: center; gap: 0.45rem; padding: 0.65rem 0.85rem; border-bottom: 1px solid var(--edge); }
  .titlebar i { width: 0.65rem; height: 0.65rem; border-radius: 50%; background: #2c2c33; }
  .titlebar span { margin: 0 auto; padding: 0.18rem 3.5rem; border-radius: 5px; background: rgb(255 255 255 / 0.04); color: var(--faint); font-size: 0.7rem; }
  .panes { display: grid; grid-template-columns: 200px 1fr 260px; min-height: 350px; font-size: 0.78rem; }
  .side, .diff { padding: 0.9rem; background: rgb(0 0 0 / 0.2); }
  .side { border-right: 1px solid var(--edge); }
  .diff { border-left: 1px solid var(--edge); font-family: var(--mono); font-size: 0.72rem; }
  .label { color: var(--faint); font-family: var(--mono); font-size: 0.64rem; letter-spacing: 0.08em; text-transform: uppercase; margin: 0 0 0.6rem; }
  .row { display: flex; align-items: center; gap: 0.5rem; padding: 0.36rem 0.5rem; border-radius: 5px; color: var(--muted); }
  .row.on { background: rgb(255 255 255 / 0.06); color: var(--ink); }
  .row b { font-weight: 600; color: var(--ink); }
  .dot { width: 0.4rem; height: 0.4rem; border-radius: 50%; background: var(--accent); margin-left: auto; }
  .spin { width: 0.7rem; height: 0.7rem; margin-left: auto; border-radius: 50%; border: 2px solid rgb(255 255 255 / 0.15); border-top-color: var(--accent-soft); animation: spin 0.9s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .chat { display: flex; flex-direction: column; gap: 0.75rem; padding: 1rem 1.1rem; }
  .bubble { align-self: flex-end; max-width: 80%; padding: 0.55rem 0.8rem; border-radius: 8px; background: #19191f; border: 1px solid var(--edge); }
  .tool { display: flex; gap: 0.5rem; align-items: center; color: var(--faint); font-family: var(--mono); font-size: 0.68rem; }
  .tool::before { content: ""; width: 0.36rem; height: 0.36rem; border-radius: 50%; background: #4ade80; }
  .reply { color: var(--body); }
  .composer { margin-top: auto; border: 1px solid var(--edge-strong); border-radius: 8px; padding: 0.6rem 0.7rem; background: #131318; }
  .composer p { margin: 0 0 0.6rem; color: var(--faint); }
  .toolbar { display: flex; align-items: center; gap: 0.9rem; color: var(--faint); font-size: 0.7rem; }
  .toolbar .credits { display: inline-flex; align-items: center; gap: 0.35rem; color: var(--ink); }
  .toolbar .credits svg { width: 0.95rem; height: 0.95rem; }
  .meter { display: inline-flex; align-items: center; gap: 0.35rem; margin-left: auto; }
  .meter span { display: block; width: 1.8rem; height: 0.25rem; border-radius: 999px; background: rgb(255 255 255 / 0.1); overflow: hidden; }
  .meter span::after { content: ""; display: block; width: 72%; height: 100%; background: var(--accent-soft); }
  .add { color: #4ade80; background: rgb(74 222 128 / 0.07); }
  .del { color: #f87171; background: rgb(248 113 113 / 0.07); }
  .diff div { padding: 0.08rem 0.4rem; border-radius: 3px; white-space: pre; overflow: hidden; text-overflow: ellipsis; }

  /* ---- "Works with": names in a row between two hairlines ---- */
  .works { margin-top: 5rem; padding: 1.6rem 0; border-block: 1px solid var(--edge); text-align: center; }
  .works p { margin: 0 0 0.9rem; }
  .works ul { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; justify-content: center; gap: 0.6rem 1.8rem; color: var(--muted); font-size: 0.92rem; }

  /* ---- Sections ---- */
  section { padding: 6rem 0 0; }
  .head { text-align: center; max-width: 36rem; margin: 0 auto 3rem; }
  .head h2 { font-size: clamp(1.75rem, 3.3vw, 2.4rem); font-weight: 500; letter-spacing: -0.035em; line-height: 1.12; margin: 0.8rem 0 0.8rem; text-wrap: balance; }
  .head p { color: var(--muted); margin: 0; text-wrap: pretty; }
  .kicker { color: var(--faint); font-family: var(--mono); font-size: 0.7rem; letter-spacing: 0.12em; text-transform: uppercase; }
  .kicker::before { content: "// "; }

  /* Cells that share their borders, like a table — one outline, hairlines
     between, no gaps and no lift. */
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); border: 1px solid var(--edge); border-radius: 10px; overflow: hidden; background: var(--raised); }
  .cell { position: relative; padding: 1.5rem; border-right: 1px solid var(--edge); border-bottom: 1px solid var(--edge); transition: background 0.2s; }
  .grid > .cell:nth-child(3n) { border-right: 0; }
  .grid > .cell:nth-last-child(-n + 3) { border-bottom: 0; }
  .cell:hover { background: rgb(255 255 255 / 0.015); }
  .num { position: absolute; top: 1.1rem; right: 1.2rem; color: var(--faint); font-family: var(--mono); font-size: 0.68rem; letter-spacing: 0.06em; }
  .num em { font-style: normal; color: var(--accent-soft); text-transform: uppercase; }
  .cell h3 { margin: 1.2rem 0 0.4rem; font-size: 1rem; font-weight: 500; letter-spacing: -0.01em; }
  .cell p { margin: 0; color: var(--muted); font-size: 0.9rem; text-wrap: pretty; }
  .pillars { border-color: rgb(139 92 246 / 0.32); background: linear-gradient(rgb(139 92 246 / 0.06), var(--raised) 60%); }
  .pillars .cell h3 { font-size: 1.08rem; }
  .art { margin-top: 1.4rem; border-radius: 7px; border: 1px solid var(--edge); background: rgb(0 0 0 / 0.25); }
  .art svg { display: block; width: 100%; height: auto; }

  .packs { max-width: 860px; margin: 0 auto; }
  .pack { padding: 2.2rem 1.5rem 1.8rem; }
  .pack.popular { background: linear-gradient(rgb(139 92 246 / 0.07), transparent 70%); box-shadow: inset 0 2px 0 var(--accent); }
  .pack-credits { margin: 0; color: var(--muted); }
  .pack-credits strong { font-size: 2.5rem; font-weight: 500; letter-spacing: -0.04em; color: var(--ink); margin-right: 0.2rem; }
  .pack-bonus { margin: 0.2rem 0 0; font-size: 0.82rem; color: var(--accent-soft); }
  .pack:not(.popular) .pack-bonus { color: var(--muted); }
  .pack-price { margin: 1.6rem 0 0.1rem; font-size: 1.15rem; font-weight: 500; }
  .pack-note { margin: 0; color: var(--faint); font-size: 0.78rem; }
  .pay { margin: 1.4rem auto 0; max-width: 40rem; text-align: center; color: var(--muted); font-size: 0.86rem; }

  .steps .cell h3 { margin-top: 2rem; }
  .steps .num { left: 1.5rem; right: auto; top: 1.4rem; color: var(--accent-soft); }

  .faq { max-width: 720px; margin: 0 auto; border-top: 1px solid var(--edge); }
  details { border-bottom: 1px solid var(--edge); padding: 1.1rem 0.2rem; }
  summary { cursor: pointer; list-style: none; display: flex; justify-content: space-between; gap: 1rem; font-weight: 500; }
  summary::-webkit-details-marker { display: none; }
  summary::after { content: "+"; color: var(--faint); font-family: var(--mono); transition: transform 0.2s; }
  details[open] summary::after { transform: rotate(45deg); }
  details p { margin: 0.7rem 0 0; color: var(--muted); max-width: 60ch; }

  /* ---- Closing: the mark, on a little stack of windows ---- */
  .closing { padding: 7rem 0 6rem; text-align: center; }
  .stack { position: relative; width: 280px; height: 200px; margin: 0 auto 2.6rem; }
  .stack span { position: absolute; inset: 24px 30px; border-radius: 12px; border: 1px solid var(--edge-strong); background: linear-gradient(#17171d, #0f0f13); }
  .stack span:nth-child(1) { transform: rotate(-8deg) translate(-18px, 6px); }
  .stack span:nth-child(2) { transform: rotate(5deg) translate(20px, 2px); }
  .stack svg { position: absolute; left: 50%; top: 50%; width: 128px; height: 128px; transform: translate(-50%, -50%); filter: drop-shadow(0 18px 40px rgb(0 0 0 / 0.6)); }
  .closing h2 { font-size: clamp(1.9rem, 4vw, 2.8rem); font-weight: 500; letter-spacing: -0.04em; margin: 0 0 1.8rem; }

  /* ---- Footer: columns ---- */
  footer { border-top: 1px solid var(--edge); padding: 3rem 0 4rem; color: var(--muted); font-size: 0.86rem; }
  footer .wrap { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 2rem; }
  footer h4 { margin: 0 0 0.9rem; color: var(--faint); font-family: var(--mono); font-size: 0.68rem; font-weight: 400; letter-spacing: 0.12em; text-transform: uppercase; }
  footer ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.55rem; }
  footer a:hover { color: var(--ink); }
  footer .brand p { margin: 0.8rem 0 0; }
  footer .copy { margin-top: 1.4rem; color: var(--faint); font-family: var(--mono); font-size: 0.7rem; letter-spacing: 0.08em; text-transform: uppercase; }

  /* ---- Motion: only where it shows the product doing something. Every
     animation arrives at what the markup already draws, so taking it away
     (reduced motion, no script) leaves the page whole. ---- */
  .enter { animation: rise 0.7s cubic-bezier(0.2, 0.7, 0.2, 1) both; animation-delay: var(--d, 0s); }
  @keyframes rise { from { opacity: 0; transform: translateY(10px); } }
  /* The window plays one turn: asked, read, edited, answered. */
  .seq { animation: rise 0.5s cubic-bezier(0.2, 0.7, 0.2, 1) both; animation-delay: var(--d, 0s); }
  .diff .add.seq { animation-name: wipe; }
  @keyframes wipe { from { opacity: 0; transform: translateX(-10px); } }
  .caret { display: inline-block; width: 1px; height: 0.95em; margin-left: 2px; vertical-align: -0.12em; background: var(--muted); animation: blink 1.1s steps(1) infinite; }
  .meter span::after { animation: drain 9s ease-in-out infinite; }
  @keyframes drain { 0%, 100% { width: 72%; } 50% { width: 64%; } }

  /* Sections come up as they are reached; \`.js\` is set before first paint,
     so without a script nothing is ever hidden. */
  .js .reveal { opacity: 0; transform: translateY(10px); transition: opacity 0.6s ease, transform 0.6s cubic-bezier(0.2, 0.7, 0.2, 1); transition-delay: var(--d, 0s); }
  .js .reveal.in { opacity: 1; transform: none; }
  /* An illustration waits for its cell, so it plays where it is seen. */
  .js .reveal:not(.in) .art * { animation-play-state: paused; }

  /* The illustrations' own vocabulary (server/utils/landing-art.ts). */
  .art * { transform-box: fill-box; transform-origin: center; }
  .a-type { transform-origin: left center; animation: type 6s ease-out infinite both; animation-delay: var(--d, 0s); }
  @keyframes type { 0%, 6% { transform: scaleX(0); } 22%, 100% { transform: scaleX(1); } }
  .a-pop { animation: pop 6s cubic-bezier(0.3, 1.5, 0.5, 1) infinite both; animation-delay: var(--d, 0s); }
  @keyframes pop { 0% { opacity: 0; transform: scale(0.5); } 8%, 100% { opacity: 1; transform: none; } }
  .a-slide { animation: slide 6s cubic-bezier(0.2, 0.7, 0.2, 1) infinite both; animation-delay: var(--d, 0s); }
  @keyframes slide { 0% { opacity: 0; transform: translateX(-10px); } 8%, 100% { opacity: 1; transform: none; } }
  .a-draw { stroke-dasharray: 1; animation: draw 6s ease-in-out infinite both; animation-delay: var(--d, 0s); }
  @keyframes draw { 0% { stroke-dashoffset: 1; } 18%, 100% { stroke-dashoffset: 0; } }
  .a-typein { transform-origin: left center; animation: type 6s steps(12) infinite both; }
  .a-blink { animation: blink 1.1s steps(1) infinite; }
  @keyframes blink { 50% { opacity: 0; } }
  .a-dot { animation: bounce 1.2s ease-in-out infinite; animation-delay: var(--d, 0s); }
  @keyframes bounce { 30% { transform: translateY(-3px); } 60% { transform: none; } }
  .a-spin { transform-box: view-box; animation: spin 0.9s linear infinite; }
  .a-float { animation: float 4s ease-in-out infinite; }
  @keyframes float { 50% { transform: translateY(-4px); } }
  /* Plan, Ask, Edits, Read, Full — a chat changing its mind about what it may touch. */
  .a-knob { animation: knob 10s cubic-bezier(0.6, 0, 0.3, 1) infinite; }
  @keyframes knob {
    0%, 14% { transform: translateX(0); }
    20%, 34% { transform: translateX(116px); }
    40%, 54% { transform: translateX(174px); }
    60%, 74% { transform: translateX(58px); }
    80%, 94% { transform: translateX(232px); }
    100% { transform: translateX(0); }
  }
  .a-switch { animation: toggle 5s cubic-bezier(0.6, 0, 0.3, 1) infinite; }
  @keyframes toggle { 0%, 40% { transform: none; } 50%, 90% { transform: translateX(14px); } 100% { transform: none; } }
  /* The account picked moves down the list: a chat changing account. */
  .a-pick { animation: pick 7.5s cubic-bezier(0.6, 0, 0.3, 1) infinite; }
  @keyframes pick { 0%, 28% { transform: none; } 34%, 62% { transform: translateY(36px); } 68%, 94% { transform: translateY(72px); } 100% { transform: none; } }
  /* The limit-hit chip gives way to the fresh account's — its markup is the
     finished state, so the switched chip is what shows without motion. */
  .a-out { animation: out 6s ease infinite; }
  @keyframes out { 0%, 28% { opacity: 1; } 36%, 100% { opacity: 0; } }
  .a-in { animation: in 6s ease infinite; }
  @keyframes in { 0%, 28% { opacity: 0; } 36%, 100% { opacity: 1; } }
  /* The lit card follows the switch: login while it sits left, credits right. */
  .a-left { animation: lit 5s ease-in-out infinite; }
  .a-right { animation: unlit 5s ease-in-out infinite; }
  @keyframes lit { 0%, 40% { opacity: 1; } 50%, 90% { opacity: 0.4; } 100% { opacity: 1; } }
  @keyframes unlit { 0%, 40% { opacity: 0.4; } 50%, 90% { opacity: 1; } 100% { opacity: 0.4; } }

  @media (max-width: 900px) {
    .panes { grid-template-columns: 1fr; }
    .side, .diff { display: none; }
    .grid { grid-template-columns: 1fr; }
    .grid > .cell { border-right: 0; border-bottom: 1px solid var(--edge); }
    .grid > .cell:last-child { border-bottom: 0; }
    .pill { display: none; }
    .nav-end { margin-left: auto; }
    footer .wrap { grid-template-columns: 1fr 1fr; }
    footer .brand { grid-column: 1 / -1; }
  }
  /* A phone has room for the name and the language, not a third control —
     and the hero's own download button is the next thing on screen. */
  @media (max-width: 480px) {
    nav .download { display: none; }
    header.hero { padding-top: 4.5rem; }
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation: none !important; transition: none !important; }
    .js .reveal { opacity: 1; transform: none; }
    html { scroll-behavior: auto; }
  }
</style>
</head>
<body>
<div class="sky"></div>

<div class="wrap">
  <nav>
    <a class="logo" href="${home}">${APP_MARK}${WORDMARK}</a>
    <div class="pill">
      <a href="#why">${t.nav.why}</a>
      <a href="#features">${t.nav.features}</a>
      <a href="#credits">${t.nav.pricing}</a>
      <a href="#faq">${t.nav.faq}</a>
    </div>
    <div class="nav-end">
      ${languageSwitch(lang, t)}
      ${splitButton("ghost", RELEASES_URL, t.nav.download, ICON.arrow, { download: true })}
    </div>
  </nav>

  <header class="hero">
    <span class="chip enter">${SPARKLE}${t.eyebrow}</span>
    <h1 class="enter" style="--d:.08s">${t.h1[0]} <em class="accent">${t.h1[1]}</em></h1>
    <p class="lede enter" style="--d:.16s">${t.lede}</p>
    <div class="ctas enter" style="--d:.24s">
      ${download("primary")}
      ${splitButton("ghost", "#credits", t.cta.pricing, ICON.arrow)}
    </div>
    <p class="fine enter" style="--d:.3s">${t.fine}</p>

    <figure class="window-frame enter" style="--d:.4s">
      <div class="window" aria-hidden="true">
        <div class="titlebar"><i></i><i></i><i></i><span>Run a command</span></div>
        <div class="panes">
          <div class="side">
            <p class="label">Projects</p>
            <div class="row"><b>checkout-api</b></div>
            <div class="row on">Add VietQR webhook<span class="spin"></span></div>
            <div class="row">Fix rounding in totals<span class="dot"></span></div>
            <div class="row">Refactor order states</div>
            <div class="row" style="margin-top:0.5rem"><b>web-app</b></div>
            <div class="row">Dark mode for settings</div>
          </div>
          <div class="chat">
            <div class="bubble seq" style="--d:1s">Add a webhook for bank transfers and mark the order paid when it lands.</div>
            <div class="tool seq" style="--d:1.5s">Read · server/routes/orders.ts</div>
            <div class="tool seq" style="--d:1.9s">Edit · server/api/webhooks/sepay.post.ts · +48 −2</div>
            <div class="reply seq" style="--d:2.9s">Added <code>POST /api/webhooks/sepay</code>. It checks the signature, matches the order code in the transfer note and credits the account once — a webhook delivered twice adds once.</div>
            <div class="composer">
              <p>Reply…<span class="caret"></span></p>
              <div class="toolbar">
                <span>Edits</span>
                <span class="credits">${APP_MARK}Credits</span>
                <span>Sonnet</span>
                <span class="meter"><span></span>3.3M left</span>
              </div>
            </div>
          </div>
          <div class="diff">
            <p class="label">sepay.post.ts</p>
            <div>export default defineHandler(</div>
            <div class="del">-  return { ok: false }</div>
            <div class="add seq" style="--d:2.00s">+  const order = await findOrder(</div>
            <div class="add seq" style="--d:2.12s">+    codeIn(body.content)</div>
            <div class="add seq" style="--d:2.24s">+  )</div>
            <div class="add seq" style="--d:2.36s">+  if (!order) return notFound()</div>
            <div class="add seq" style="--d:2.48s">+  await credit(order.uid, order)</div>
            <div class="add seq" style="--d:2.60s">+  return { ok: true }</div>
            <div>})</div>
          </div>
        </div>
      </div>
      <figcaption>${t.windowCaption}</figcaption>
    </figure>
  </header>

  <div class="works reveal">
    <p class="kicker">${t.worksWith}</p>
    <ul>${WORKS_WITH.map((name) => `<li>${name}</li>`).join("")}</ul>
  </div>

  <section id="why">
    <div class="head reveal">
      <span class="kicker">${t.pillars.kicker}</span>
      <h2>${t.pillars.title}</h2>
      <p>${t.pillars.body}</p>
    </div>
    <div class="grid pillars">
      ${t.pillars.items.map((item, i) => featureCell(item, i, PILLAR_ORDER)).join("\n      ")}
    </div>
  </section>

  <section id="features">
    <div class="head reveal">
      <span class="kicker">${t.features.kicker}</span>
      <h2>${t.features.title}</h2>
      <p>${t.features.body}</p>
    </div>
    <div class="grid">
      ${t.features.items.map((item, i) => featureCell(item, i)).join("\n      ")}
    </div>
  </section>

  <section id="credits">
    <div class="head reveal">
      <span class="kicker">${t.pricing.kicker}</span>
      <h2>${t.pricing.title[0]}<em class="accent">${t.pricing.title[1]}</em></h2>
      <p>${t.pricing.body}</p>
    </div>
    <div class="grid packs">
      ${packsForSale()
        .map((pack, i) => packCell(t.pricing, pack, i))
        .join("\n      ")}
    </div>
    <p class="pay">${t.pricing.pay}</p>
  </section>

  <section>
    <div class="head reveal">
      <span class="kicker">${t.steps.kicker}</span>
      <h2>${t.steps.title}</h2>
    </div>
    <div class="grid steps">
      ${t.steps.items
        .map(
          (step, i) =>
            `<div class="cell reveal" style="--d:${(i * 0.08).toFixed(2)}s"><span class="num">${nth(i)}</span><h3>${step.title}</h3><p>${step.body}</p></div>`
        )
        .join("\n      ")}
    </div>
  </section>

  <section id="faq">
    <div class="head reveal">
      <span class="kicker">${t.faq.kicker}</span>
      <h2>${t.faq.title}</h2>
    </div>
    <div class="faq">
      ${t.faq.items.map((item) => `<details class="reveal"><summary>${item.q}</summary><p>${item.a}</p></details>`).join("\n      ")}
    </div>
  </section>

  <section class="closing">
    <div class="stack reveal" aria-hidden="true"><span></span><span></span>${APP_MARK}</div>
    <h2 class="reveal">${t.closing[0]}<em class="accent">${t.closing[1]}</em></h2>
    <div class="ctas reveal">${download("primary")}</div>
  </section>
</div>

<footer>
  <div class="wrap">
    <div class="brand">
      <a class="logo" href="${home}">${APP_MARK}${WORDMARK}</a>
      <p>${t.footer.tagline}</p>
      <p class="copy">© ${year} VS Claude</p>
    </div>
    <div>
      <h4>${t.footer.product}</h4>
      <ul>
        <li><a href="#features">${t.nav.features}</a></li>
        <li><a href="#credits">${t.nav.pricing}</a></li>
        <li><a href="#faq">${t.nav.faq}</a></li>
        <li><a href="${RELEASES_URL}">${t.footer.releases}</a></li>
      </ul>
    </div>
    <div>
      <h4>${t.nav.language}</h4>
      <ul>${LANGS.map((l) => `<li><a href="${pathOf(l)}" hreflang="${COPY[l].htmlLang}">${l === "en" ? "English" : "Tiếng Việt"}</a></li>`).join("")}</ul>
    </div>
  </div>
</footer>

<script>
  // Each section comes up once, as it is reached. No observer, no hiding:
  // everything is shown at once instead.
  ;(function () {
    var items = document.querySelectorAll(".reveal")
    if (!("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("in") })
      return
    }
    var seen = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return
        entry.target.classList.add("in")
        seen.unobserve(entry.target)
      })
    }, { rootMargin: "0px 0px -8% 0px" })
    items.forEach(function (el) { seen.observe(el) })
  })()

  // Only the label: every button still goes to the releases page, which lists
  // each platform's file — a guess that is wrong costs nothing but a word.
  ;(function () {
    var ua = navigator.userAgent
    var os = /Mac/.test(ua) ? "macOS" : /Win/.test(ua) ? "Windows" : /Linux/.test(ua) && !/Android/.test(ua) ? "Linux" : null
    if (!os) return
    document.querySelectorAll("[data-download-label]").forEach(function (el) {
      el.textContent = ${JSON.stringify(t.cta.downloadFor)} + os
    })
  })()
</script>
</body>
</html>`
}
