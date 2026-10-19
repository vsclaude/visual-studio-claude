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

/**
 * The miniature studio's icons, lucide's strokes as the app draws them. Each
 * carries `class="i"` so the window's sizing reaches these and not the nested
 * `<svg>` inside `APP_MARK`.
 */
const ui = (d: string) =>
  `<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`

const UI = {
  chat: ui('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
  search: ui('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  chart: ui('<path d="M3 3v18h18"/><path d="M8 17v-5M13 17V8M18 17v-3"/>'),
  terminal: ui('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="m7 15 3-3-3-3M12 15h5"/>'),
  settings: ui('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>'),
  plus: ui('<path d="M12 5v14M5 12h14"/>'),
  folder: ui('<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9l-.8-1.2A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"/>'),
  close: ui('<path d="M18 6 6 18M6 6l12 12"/>'),
  outline: ui('<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>'),
  popout: ui('<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>'),
  pen: ui('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
  plug: ui('<path d="M12 22v-5M9 8V2M15 8V2M18 8v5a6 6 0 0 1-12 0V8z"/>'),
  send: ui('<path d="M12 19V5M5 12l7-7 7 7"/>'),
  right: ui('<path d="m9 18 6-6-6-6"/>'),
  down: ui('<path d="m6 9 6 6 6-6"/>'),
  up: ui('<path d="m18 15-6-6-6 6"/>'),
  refresh: ui('<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>'),
  panel: ui('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18"/>'),
  branch: ui('<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="7" r="2"/><path d="M6 7v10M18 9c0 5-7 4-11 8"/>'),
  /** Claude's own asterisk, in its orange — the composer's model picker. */
  claude: ui('<path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4"/>'),
  user: ui('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>'),
  alert: ui('<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>'),
}

/** What the demo's two messages say — typed into the composer, then sent. */
const DEMO = {
  ask1: "Add a webhook for bank transfers and mark the order paid when it lands.",
  ask2: "Now add a test for a webhook delivered twice.",
}

/**
 * The hero window plays the page's story on a loop, like a GIF: a turn on
 * the Work account, the 5-hour limit, a switch to Credits, and the next turn
 * carrying on in the same conversation. Every moment is a share of `LOOP`
 * seconds, and each one gets keyframes of its own — CSS cannot put a
 * variable in a keyframe's percentage, and a delay alone would let the beats
 * drift apart instead of all starting over together.
 *
 * The markup is the **last** frame, so with motion reduced the window shows
 * the story finished: both turns, on Credits, two files changed. The log is
 * pinned to its bottom, so what overflows is the oldest line, as in the app.
 */
const LOOP = 20
const TYPE1: [number, number] = [4, 12]
const TYPE2: [number, number] = [50, 58]
const SWITCH = 46
const BEATS: Record<string, number> = {
  bubble1: 13,
  read: 18,
  edit1: 23,
  change1: 24,
  reply1: 29,
  cost1: 34,
  limit: 40,
  bubble2: 59,
  edit2: 64,
  change2: 65,
  reply2: 70,
  cost2: 75,
}
/** Where the finished story holds, then fades before it starts again. */
const HOLD = 93
const GONE = 97

function demoCss(): string {
  // A line arriving: it grows into the log, pushing the older ones up.
  const grow = (name: string, at: number) =>
    `@keyframes ${name} { 0%, ${at}% { max-height: 0; margin-top: 0; opacity: 0; } ${at + 2.5}%, ${HOLD}% { max-height: 9rem; margin-top: var(--gap); opacity: 1; } ${GONE}%, 100% { max-height: 9rem; margin-top: var(--gap); opacity: 0; } }`
  const typing = (name: string, [from, to]: [number, number]) =>
    `@keyframes ${name} { 0%, ${from}% { opacity: 0; max-width: 0; } ${from + 0.2}% { opacity: 1; max-width: 0; animation-timing-function: steps(32, end); } ${to}% { opacity: 1; max-width: 100%; } ${to + 0.3}%, 100% { opacity: 0; max-width: 100%; } }`
  const off = (a: [number, number], b: [number, number]) =>
    `0%, ${a[0]}% { opacity: 1; } ${a[0] + 0.2}%, ${a[1] + 1}% { opacity: 0; } ${a[1] + 1.2}%, ${b[0]}% { opacity: 1; } ${b[0] + 0.2}%, ${b[1] + 1}% { opacity: 0; } ${b[1] + 1.2}%, 100% { opacity: 1; }`
  // Shown from one moment to the next, and hidden either side of it.
  const during = (name: string, from: number, to: number) =>
    `@keyframes ${name} { 0%, ${from}% { opacity: 0; } ${from + 0.3}%, ${to}% { opacity: 1; } ${to + 0.3}%, 100% { opacity: 0; } }`
  return [
    ...Object.entries(BEATS).map(([name, at]) => grow(name, at)),
    typing("typed1", TYPE1),
    typing("typed2", TYPE2),
    `@keyframes hint { ${off(TYPE1, TYPE2)} }`,
    `@keyframes work { 0%, ${SWITCH}% { opacity: 1; } ${SWITCH + 0.5}%, 100% { opacity: 0; } }`,
    `@keyframes oncredits { 0%, ${SWITCH}% { opacity: 0; } ${SWITCH + 0.5}%, 100% { opacity: 1; } }`,
    during("count1", BEATS.change1, BEATS.change2),
    during("count2", BEATS.change2, GONE),
  ].join("\n  ")
}

/** Git's count of changed files, `1` then `2` as the demo writes them. */
const COUNT = `<small class="count"><i style="animation-name:count1">1</i><i style="animation-name:count2">2</i></small>`

/**
 * Which illustration sits over each feature, in the order `Copy` lists them:
 * the studio's main parts, one each. The limits meter is not among them — the
 * three problems above already make that case.
 */
const FEATURE_ORDER: FeatureArt[] = [
  "chats",
  "diff",
  "worktrees",
  "modes",
  "terminal",
  "search",
]

/** The three problems' illustrations, in the order `Copy` lists them. */
const PILLAR_ORDER: FeatureArt[] = ["profiles", "handoff", "accounts"]

/** `01`, `02` — the cells' numbers. */
const nth = (i: number) => String(i + 1).padStart(2, "0")

function featureCell(
  feature: Copy["pillars"]["items"][number],
  i: number,
  order: FeatureArt[]
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
    /* Cambria and Palatino ahead of Georgia: Windows' Georgia has no "ế",
       and the browser draws it as "ê" with a loose acute beside it. */
    --serif: ui-serif, "New York", "Iowan Old Style", Charter, Cambria, "Palatino Linotype", Georgia, serif;
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

  /* The studio in miniature, laid out the way the app is (docs/screenshots):
     a palette field alone in the title bar, then cards on a dark canvas —
     the rail, Projects, the chat over its dock, and Explorer open on Git.
     Drawn, not screenshotted, so it stays sharp. */
  /* Wider than the page's column: the app is a whole window, and at the
     column's width its text was too small to read. \`translate\` rather than
     \`transform\`, which \`.enter\`'s rise animates. */
  figure.window-frame { width: min(1240px, 100vw - 3rem); margin: 4rem 0 0 50%; translate: -50% 0; }
  .window {
    border-radius: 12px; overflow: hidden; text-align: left; border: 1px solid var(--edge-strong); background: #09090b;
    box-shadow: 0 30px 80px rgb(0 0 0 / 0.5); font-size: 0.86rem; line-height: 1.45; color: #d4d4d8;
  }
  figcaption { margin-top: 0.9rem; color: var(--faint); font-size: 0.78rem; }
  .window .i { width: 0.9rem; height: 0.9rem; flex: none; }
  .titlebar { display: flex; justify-content: center; padding: 0.4rem; }
  .palette { display: flex; align-items: center; width: 42%; padding: 0.28rem 0.6rem; border-radius: 6px; border: 1px solid var(--edge-strong); background: rgb(255 255 255 / 0.025); color: var(--muted); font-size: 0.78rem; }
  .palette span { flex: 1; text-align: center; }
  .palette kbd { font: inherit; font-size: 0.68rem; color: var(--faint); }
  .canvas { display: grid; grid-template-columns: 42px 230px minmax(0, 1fr) 260px; grid-template-rows: minmax(0, 1fr); gap: 6px; height: 560px; padding: 0 6px; }
  .window .card { min-width: 0; overflow: hidden; border-radius: 8px; background: #111114; box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.07); }
  .rail { display: flex; flex-direction: column; align-items: center; gap: 0.3rem; padding: 0.45rem 0; color: var(--muted); }
  .rail i { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 6px; }
  .rail i.on { background: rgb(255 255 255 / 0.08); color: var(--ink); }
  .rail .grow { flex: 1; }
  .side { padding: 0.55rem 0.35rem; }
  .window .label { display: flex; align-items: center; gap: 0.35rem; margin: 0 0 0.45rem; padding: 0 0.4rem; color: var(--muted); font-size: 0.68rem; letter-spacing: 0.1em; text-transform: uppercase; }
  .window .label .end { margin-left: auto; letter-spacing: 0; }
  .folder { display: flex; align-items: center; gap: 0.45rem; padding: 0.28rem 0.4rem; color: var(--ink); }
  .folder .i { color: #818cf8; }
  .row { display: flex; align-items: center; gap: 0.5rem; padding: 0.26rem 0.4rem 0.26rem 1.1rem; border-radius: 5px; color: #c4c4cc; white-space: nowrap; }
  .row.on { background: rgb(255 255 255 / 0.07); color: var(--ink); }
  .row.unread { color: var(--ink); font-weight: 600; }
  .row time { margin-left: auto; color: var(--faint); font-size: 0.72rem; font-weight: 400; }
  .dot { width: 0.4rem; height: 0.4rem; border-radius: 50%; background: var(--accent); margin-left: auto; }
  .spin { width: 0.7rem; height: 0.7rem; margin-left: auto; border-radius: 50%; border: 2px solid rgb(255 255 255 / 0.15); border-top-color: var(--accent-soft); animation: spin 0.9s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .middle { display: grid; grid-template-rows: minmax(0, 1fr) auto; gap: 6px; min-width: 0; min-height: 0; }
  /* \`min-height: 0\`, or the grid sizes the pane to the whole log and the
     composer goes out of the bottom instead of the oldest line out of the top. */
  .pane { display: flex; flex-direction: column; min-height: 0; }
  .tabs { display: flex; border-bottom: 1px solid var(--edge); color: var(--muted); font-family: var(--mono); font-size: 0.76rem; }
  .tabs span { display: flex; align-items: center; gap: 0.4rem; padding: 0.42rem 0.8rem; border-right: 1px solid var(--edge); white-space: nowrap; }
  .tabs .on { color: var(--ink); box-shadow: inset 0 2px 0 #818cf8; }
  .tabs .on .i:last-child { width: 0.66rem; height: 0.66rem; margin-left: 0.25rem; color: var(--faint); }
  .ts { font: 700 0.6rem/1 var(--sans); color: #3b82f6; }
  .pane-head { display: flex; align-items: center; padding: 0.45rem 0.9rem; border-bottom: 1px solid var(--edge); color: var(--ink); font-size: 0.92rem; }
  .pane-head span { display: flex; gap: 0.75rem; margin-left: auto; color: var(--muted); }
  .chat { flex: 1; min-height: 0; display: flex; flex-direction: column; padding: 0 2rem 0.8rem; }
  /* Pinned to its bottom, so a line arriving pushes the oldest out of the
     top, the way a transcript scrolls. */
  .log { flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; justify-content: flex-end; padding-bottom: 0.9rem; --gap: 0.65rem; }
  .log > *, .files > * { flex: none; overflow: hidden; margin-top: var(--gap); }
  .files { --gap: 0rem; }
  .limit { display: flex; align-items: center; gap: 0.45rem; padding: 0.45rem 0.65rem; border-radius: 6px; border: 1px solid rgb(248 113 113 / 0.45); background: rgb(248 113 113 / 0.06); color: #fca5a5; }
  .bubble { padding: 0.42rem 0.7rem; border-radius: 6px; background: rgb(255 255 255 / 0.06); color: var(--ink); }
  .tool { display: flex; align-items: center; gap: 0.35rem; color: var(--muted); font-size: 0.78rem; }
  .tool span { color: var(--faint); font-family: var(--mono); font-size: 0.74rem; }
  .reply { color: #e4e4e7; }
  .reply code { padding: 0.05rem 0.3rem; border-radius: 4px; background: rgb(255 255 255 / 0.07); font-family: var(--mono); font-size: 0.76rem; }
  .cost { color: var(--faint); font-size: 0.74rem; }
  .composer { margin-top: auto; padding: 0.55rem 0.65rem; border: 1px solid var(--edge-strong); border-radius: 8px; background: rgb(255 255 255 / 0.02); }
  .composer p { position: relative; margin: 0 0 0.9rem; color: var(--faint); white-space: nowrap; }
  /* What is being typed lies over the placeholder, revealed a step at a
     time; the border is its caret. Hidden in the last frame: it was sent. */
  .typed { position: absolute; inset: 0 auto 0 0; overflow: hidden; opacity: 0; color: var(--ink); border-right: 1px solid var(--ink); }
  .toolbar { display: flex; align-items: center; gap: 0.8rem; color: var(--muted); font-size: 0.76rem; white-space: nowrap; }
  .toolbar > span { display: inline-flex; align-items: center; gap: 0.3rem; }
  .toolbar .model, .toolbar .credits { color: var(--ink); }
  .claude { display: inline-flex; color: #d97757; }
  .credits > svg { width: 0.9rem; height: 0.9rem; }
  /* The account the chat runs on: Work at its limit, then Credits, in one
     slot. The last frame is Credits, so Work is hidden unless animated. */
  .toolbar > .stack-in { display: inline-grid; }
  .stack-in > span { grid-area: 1 / 1; display: inline-flex; align-items: center; gap: 0.3rem; color: var(--ink); }
  .stack-in .work { opacity: 0; }
  .meter.full span::after { width: 100%; background: #f87171; }
  .count { display: inline-grid; }
  .count i { grid-area: 1 / 1; font-style: normal; }
  .count i:first-child { opacity: 0; }
  .change.new { color: #4ade80; }
  .meter { display: inline-flex; align-items: center; gap: 0.35rem; margin-left: 0.15rem; color: var(--muted); }
  .meter span { display: block; width: 1.8rem; height: 0.25rem; border-radius: 999px; background: rgb(255 255 255 / 0.1); overflow: hidden; }
  .meter span::after { content: ""; display: block; width: 72%; height: 100%; background: var(--accent-soft); }
  .toolbar .end { margin-left: auto; gap: 0.6rem; }
  .send { display: grid; place-items: center; width: 1.3rem; height: 1.3rem; border-radius: 50%; border: 1px solid var(--edge-strong); }
  .dock { display: flex; align-items: center; gap: 0.6rem; padding: 0.38rem 0.7rem; color: var(--muted); }
  .dock span { display: inline-flex; align-items: center; gap: 0.35rem; color: var(--body); }
  .explorer { display: flex; flex-direction: column; gap: 0.45rem; padding: 0.45rem; }
  .seg { display: flex; align-items: center; gap: 0.15rem; color: var(--muted); white-space: nowrap; }
  .seg span { padding: 0.18rem 0.45rem; border-radius: 5px; }
  .seg .on { background: rgb(255 255 255 / 0.08); color: var(--ink); }
  .seg small { margin-left: 0.2rem; color: var(--faint); font-family: var(--mono); font-size: 0.66rem; }
  .seg em { display: flex; gap: 0.6rem; margin-left: auto; padding-right: 0.2rem; }
  .window .message { padding: 0.42rem 0.55rem 1.3rem; border-radius: 6px; border: 1px solid var(--edge-strong); color: var(--faint); }
  .window .commit { display: flex; align-items: center; justify-content: space-between; }
  .window .commit > span { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.18rem 0.45rem; border-radius: 5px; background: rgb(255 255 255 / 0.06); color: var(--ink); }
  .window .commit b { padding: 0.18rem 0.55rem; border-radius: 5px; background: #4f46e5; color: #fff; font-weight: 500; }
  .explorer .label { margin: 0.25rem 0 0; padding: 0; }
  .dir, .change { display: flex; align-items: center; gap: 0.4rem; padding: 0.14rem 0.2rem; white-space: nowrap; }
  .dir { color: var(--body); }
  .dir .i { width: 0.7rem; color: var(--faint); }
  .change { padding-left: 1.1rem; color: #fbbf24; }
  .change b:last-child { margin-left: auto; font-family: var(--mono); font-size: 0.68rem; font-weight: 400; }
  .window .status { display: flex; justify-content: space-between; padding: 0.32rem 0.7rem; color: var(--faint); font-size: 0.72rem; }
  .window .status span { display: inline-flex; align-items: center; gap: 0.35rem; }

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
  .stack > svg { position: absolute; left: 50%; top: 50%; width: 128px; height: 128px; transform: translate(-50%, -50%); filter: drop-shadow(0 18px 40px rgb(0 0 0 / 0.6)); }
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
  /* The window's story on a loop (\`demoCss\` above \`landingPage\`): each part
     names its own keyframes inline, and shares the clock here. */
  .beat, .typed, .hint, .work, .stack-in .credits, .count i { animation: ${LOOP}s linear infinite both; }
  .hint { animation-name: hint; }
  ${demoCss()}
  .caret { display: inline-block; width: 1px; height: 0.95em; margin-left: 2px; vertical-align: -0.12em; background: var(--muted); animation: blink 1.1s steps(1) infinite; }
  .meter:not(.full) span::after { animation: drain 9s ease-in-out infinite; }
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
    .canvas { grid-template-columns: minmax(0, 1fr); }
    .rail, .side, .explorer, .window .status span:last-child, .toolbar .mcp, .toolbar .end { display: none; }
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
    nav .download, .toolbar .mode { display: none; }
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
        <div class="titlebar"><div class="palette">${UI.search}<span>Run a command</span><kbd>⌘P</kbd></div></div>
        <div class="canvas">
          <div class="card rail">
            <i class="on">${UI.chat}</i><i>${UI.search}</i><i>${UI.chart}</i>
            <span class="grow"></span><i>${UI.terminal}</i><i>${UI.settings}</i>
          </div>
          <div class="card side">
            <p class="label">Projects<span class="end">${UI.plus}</span></p>
            <div class="folder">${UI.folder}checkout-api</div>
            <div class="row on">Add VietQR webhook<span class="spin"></span></div>
            <div class="row unread">Fix rounding in totals<span class="dot"></span></div>
            <div class="row">Refactor order states<time>1d</time></div>
            <div class="folder">${UI.folder}web-app</div>
            <div class="row">Dark mode for settings<time>3d</time></div>
            <div class="row">Empty states on search<time>1w</time></div>
          </div>
          <div class="middle">
            <div class="card pane">
              <div class="tabs">
                <span><b class="ts">TS</b>orders.ts</span>
                <span class="on">${UI.chat}Add VietQR webhook${UI.close}</span>
              </div>
              <div class="pane-head">Add VietQR webhook<span>${UI.outline}${UI.search}${UI.popout}</span></div>
              <div class="chat">
                <div class="log">
                  <div class="bubble beat" style="animation-name:bubble1">${DEMO.ask1}</div>
                  <div class="tool beat" style="animation-name:read">${UI.right}Read<span>server/routes/orders.ts</span></div>
                  <div class="tool beat" style="animation-name:edit1">${UI.right}Edit<span>server/api/webhooks/sepay.post.ts · +48 −2</span></div>
                  <div class="reply beat" style="animation-name:reply1">Added <code>POST /api/webhooks/sepay</code>. It checks the signature, matches the order code in the transfer note and credits the account once.</div>
                  <div class="cost beat" style="animation-name:cost1">Sonnet 5.5 · Work · 18.2k prompt, 94% cached · 1.1k out · 14s</div>
                  <div class="limit beat" style="animation-name:limit">${UI.alert}Work is out of its 5-hour window. Pick another account to carry on.</div>
                  <div class="bubble beat" style="animation-name:bubble2">${DEMO.ask2}</div>
                  <div class="tool beat" style="animation-name:edit2">${UI.right}Write<span>test/sepay.test.ts · +31</span></div>
                  <div class="reply beat" style="animation-name:reply2">Added <code>test/sepay.test.ts</code>: the second delivery is ignored and the order is credited once. 6 passed.</div>
                  <div class="cost beat" style="animation-name:cost2">Sonnet 5.5 · Credits · 21.4k prompt, 96% cached · 0.9k out · 9s</div>
                </div>
                <div class="composer">
                  <p><span class="hint">Ask to make changes in this project…<span class="caret"></span></span><span class="typed" style="animation-name:typed1">${DEMO.ask1}</span><span class="typed" style="animation-name:typed2">${DEMO.ask2}</span></p>
                  <div class="toolbar">
                    <span class="model"><span class="claude">${UI.claude}</span>Sonnet 5.5 · Medium</span>
                    <span class="mode">${UI.pen}Edits</span>
                    <span class="mcp">${UI.plug}MCP</span>
                    <span class="stack-in">
                      <span class="work" style="animation-name:work">${UI.user}Work<span class="meter full"><span></span>5h 100%</span></span>
                      <span class="credits" style="animation-name:oncredits">${APP_MARK}Credits<span class="meter"><span></span>3.3M left</span></span>
                    </span>
                    <span class="end">${UI.plus}<b class="send">${UI.send}</b></span>
                  </div>
                </div>
              </div>
            </div>
            <div class="card dock">${UI.up}<span>${UI.terminal}Terminal</span>${UI.plus}${UI.down}</div>
          </div>
          <div class="card explorer">
            <div class="seg"><span>All files</span><span class="on">Git${COUNT}</span><em>${UI.refresh}${UI.panel}</em></div>
            <div class="seg"><span class="on">Changes${COUNT}</span><span>Commits</span></div>
            <div class="message">Message (⌘↩ to commit)</div>
            <div class="commit"><span><span class="claude">${UI.claude}</span>Draft</span><b>Commit</b></div>
            <p class="label">${UI.down}Changes<span class="end">${COUNT}</span></p>
            <div class="files">
              <div class="beat" style="animation-name:change1"><div class="dir">${UI.down}server/api/webhooks</div><div class="change"><b class="ts">TS</b>sepay.post.ts<b>M</b></div></div>
              <div class="beat" style="animation-name:change2"><div class="dir">${UI.down}test</div><div class="change new"><b class="ts">TS</b>sepay.test.ts<b>U</b></div></div>
            </div>
          </div>
        </div>
        <div class="status"><span>${UI.branch}main</span><span>This app 0.4% CPU · 96 MB</span></div>
      </div>
      <figcaption>${t.windowCaption}</figcaption>
    </figure>
  </header>

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
      ${t.features.items.map((item, i) => featureCell(item, i, FEATURE_ORDER)).join("\n      ")}
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
