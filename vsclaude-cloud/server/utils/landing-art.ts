/**
 * The home page's illustrations, one per feature — inline SVG, so they are
 * part of the one response and take the page's own CSS.
 *
 * Every one is drawn in its **finished** state, and the motion is keyframes
 * that start from somewhere else and arrive there (`landing.ts`'s `.a-*`
 * classes). So with motion reduced, or before the card has scrolled into view,
 * what shows is the picture complete rather than half of it: an animation
 * removed takes nothing with it.
 *
 * Colours are the page's: the violet and amber of the mark, and the diff's
 * green and red.
 */

const VIOLET = "#8B5CF6"
const LILAC = "#A78BFA"
const AMBER = "#FBBF24"
const GREEN = "#4ADE80"
const RED = "#F87171"
const LINE = "rgb(255 255 255 / 0.10)"
const PANEL = "rgb(255 255 255 / 0.035)"
const INK = "rgb(255 255 255 / 0.55)"
const FAINT = "rgb(255 255 255 / 0.22)"

/** A four-point spark — the mark's own, at any size. */
function spark(cx: number, cy: number, r: number, fill: string, cls = "") {
  const p = r * 0.16
  return `<path class="${cls}" fill="${fill}" d="M${cx} ${cy - r}Q${cx + p} ${cy - p} ${cx + r} ${cy}Q${cx + p} ${cy + p} ${cx} ${cy + r}Q${cx - p} ${cy + p} ${cx - r} ${cy}Q${cx - p} ${cy - p} ${cx} ${cy - r}Z"/>`
}

function svg(body: string, defs = "") {
  return `<svg viewBox="0 0 320 140" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${defs ? `<defs>${defs}</defs>` : ""}${body}</svg>`
}

const GRADIENT = (id: string) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${VIOLET}"/><stop offset="1" stop-color="${AMBER}"/></linearGradient>`

/** Three conversations at once, each writing its own answer. */
function chats(): string {
  const column = (x: number, i: number) => {
    const d = (n: number) => `style="--d:${(i * 0.45 + n * 0.25).toFixed(2)}s"`
    const status =
      i === 1
        ? `<circle cx="${x + 82}" cy="20" r="3.2" fill="${VIOLET}"/>`
        : `<circle cx="${x + 82}" cy="20" r="4" stroke="${FAINT}" stroke-width="1.6"/><path class="a-spin" style="transform-origin:${x + 82}px 20px" d="M${x + 82} 16a4 4 0 0 1 4 4" stroke="${AMBER}" stroke-width="1.6" stroke-linecap="round"/>`
    return `<g>
      <rect x="${x}" y="8" width="96" height="124" rx="10" fill="${PANEL}" stroke="${LINE}"/>
      <rect x="${x + 10}" y="16" width="34" height="7" rx="3.5" fill="${FAINT}"/>
      ${status}
      <rect class="a-pop" ${d(0)} x="${x + 38}" y="34" width="50" height="16" rx="8" fill="rgb(139 92 246 / 0.35)"/>
      <rect class="a-type" ${d(1)} x="${x + 10}" y="60" width="72" height="5" rx="2.5" fill="${INK}"/>
      <rect class="a-type" ${d(2)} x="${x + 10}" y="72" width="58" height="5" rx="2.5" fill="${INK}"/>
      <rect class="a-type" ${d(3)} x="${x + 10}" y="84" width="66" height="5" rx="2.5" fill="${INK}"/>
      <rect x="${x + 8}" y="106" width="80" height="18" rx="6" stroke="${LINE}" fill="rgb(0 0 0 / 0.2)"/>
      ${i === 2 ? `<circle class="a-dot" style="--d:0s" cx="${x + 20}" cy="115" r="2" fill="${LILAC}"/><circle class="a-dot" style="--d:.15s" cx="${x + 27}" cy="115" r="2" fill="${LILAC}"/><circle class="a-dot" style="--d:.3s" cx="${x + 34}" cy="115" r="2" fill="${LILAC}"/>` : ""}
    </g>`
  }
  return svg([12, 112, 212].map(column).join(""))
}

/** A diff landing line by line, and the commit it becomes. */
function diff(): string {
  const rows: [string, number, string][] = [
    [FAINT, 120, ""],
    [RED, 96, "rgb(248 113 113 / 0.12)"],
    [GREEN, 132, "rgb(74 222 128 / 0.12)"],
    [GREEN, 110, "rgb(74 222 128 / 0.12)"],
    [GREEN, 140, "rgb(74 222 128 / 0.12)"],
    [FAINT, 80, ""],
  ]
  const body = rows
    .map(([color, width, wash], i) => {
      const y = 22 + i * 17
      const sign = color === GREEN ? "+" : color === RED ? "−" : ""
      return `<g class="a-slide" style="--d:${(i * 0.18).toFixed(2)}s">
        ${wash ? `<rect x="20" y="${y - 6}" width="176" height="14" rx="3" fill="${wash}"/>` : ""}
        <text x="26" y="${y + 4}" font-size="10" font-family="ui-monospace, Menlo, monospace" fill="${color}">${sign}</text>
        <rect x="40" y="${y - 2}" width="${width}" height="5" rx="2.5" fill="${color === FAINT ? FAINT : color}" fill-opacity="${color === FAINT ? 1 : 0.75}"/>
      </g>`
    })
    .join("")
  const graph = `
    <path d="M250 24V116" stroke="${LINE}" stroke-width="2"/>
    <circle cx="250" cy="116" r="5" fill="#26262e" stroke="${FAINT}" stroke-width="2"/>
    <circle cx="250" cy="86" r="5" fill="#26262e" stroke="${FAINT}" stroke-width="2"/>
    <circle cx="250" cy="56" r="5" fill="#26262e" stroke="${FAINT}" stroke-width="2"/>
    <g class="a-pop" style="--d:1.3s"><circle cx="250" cy="24" r="8" fill="url(#diff-g)"/><path d="M246.5 24.5l2.5 2.5 5-5.5" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g>
    <rect class="a-pop" style="--d:1.5s" x="264" y="15" width="44" height="18" rx="9" fill="rgb(74 222 128 / 0.14)"/>
    <text class="a-pop" style="--d:1.5s" x="286" y="27.5" text-anchor="middle" font-size="9.5" font-family="ui-monospace, Menlo, monospace" fill="${GREEN}">+48 −2</text>`
  return svg(
    `<rect x="12" y="8" width="192" height="124" rx="10" fill="${PANEL}" stroke="${LINE}"/>${body}${graph}`,
    GRADIENT("diff-g")
  )
}

/** A branch for each chat, cut from the same trunk. */
function worktrees(): string {
  const chip = (
    x: number,
    y: number,
    label: string,
    color: string,
    d: string
  ) =>
    `<g class="a-pop" style="--d:${d}"><rect x="${x}" y="${y - 10}" width="${label.length * 6.2 + 18}" height="20" rx="10" fill="${color}" fill-opacity="0.14" stroke="${color}" stroke-opacity="0.5"/><text x="${x + 9}" y="${y + 3.5}" font-size="10" font-family="ui-monospace, Menlo, monospace" fill="${color}">${label}</text></g>`
  return svg(`
    <path d="M16 70H304" stroke="${FAINT}" stroke-width="3" stroke-linecap="round"/>
    <path class="a-draw" style="--d:.2s" pathLength="1" d="M70 70C100 70 100 30 132 30H176" stroke="${VIOLET}" stroke-width="3" stroke-linecap="round"/>
    <path class="a-draw" style="--d:.6s" pathLength="1" d="M110 70C140 70 140 110 172 110H210" stroke="${AMBER}" stroke-width="3" stroke-linecap="round"/>
    <circle cx="70" cy="70" r="6" fill="#26262e" stroke="${FAINT}" stroke-width="2.5"/>
    <circle cx="110" cy="70" r="6" fill="#26262e" stroke="${FAINT}" stroke-width="2.5"/>
    <circle cx="250" cy="70" r="6" fill="#26262e" stroke="${FAINT}" stroke-width="2.5"/>
    <circle class="a-pop" style="--d:.9s" cx="176" cy="30" r="6.5" fill="${VIOLET}"/>
    <circle class="a-pop" style="--d:1.3s" cx="210" cy="110" r="6.5" fill="${AMBER}"/>
    ${chip(188, 30, "feat/webhook", LILAC, "1s")}
    ${chip(222, 110, "fix/totals", AMBER, "1.4s")}
    <text x="16" y="94" font-size="10" font-family="ui-monospace, Menlo, monospace" fill="${FAINT}">main</text>`)
}

/** Five modes, one knob — moved mid-conversation. */
function modes(): string {
  const labels = ["Plan", "Read", "Ask", "Edits", "Full"]
  const seg = labels
    .map(
      (label, i) =>
        `<text x="${44 + i * 58}" y="100" text-anchor="middle" font-size="11" font-family="-apple-system, Segoe UI, sans-serif" fill="${INK}">${label}</text>`
    )
    .join("")
  return svg(
    `<g class="a-float">
      <path d="M160 14l26 10v18c0 17-11 27-26 33-15-6-26-16-26-33V24z" fill="url(#mode-g)" fill-opacity="0.18" stroke="url(#mode-g)" stroke-width="2"/>
      <path d="M150 44l7 7 13-14" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
    <rect x="12" y="84" width="296" height="28" rx="14" fill="${PANEL}" stroke="${LINE}"/>
    <rect class="a-knob" x="17" y="88" width="54" height="20" rx="10" fill="url(#mode-g)" fill-opacity="0.45"/>
    ${seg}`,
    GRADIENT("mode-g")
  )
}

/** A shell under the chat, running what the chat just wrote. */
function terminal(): string {
  const mono = `font-size="10.5" font-family="ui-monospace, Menlo, monospace"`
  return svg(`
    <rect x="12" y="8" width="296" height="124" rx="10" fill="rgb(0 0 0 / 0.35)" stroke="${LINE}"/>
    <circle cx="26" cy="21" r="3.5" fill="${RED}"/><circle cx="38" cy="21" r="3.5" fill="${AMBER}"/><circle cx="50" cy="21" r="3.5" fill="${GREEN}"/>
    <path d="M12 32H308" stroke="${LINE}"/>
    <clipPath id="term-clip"><rect class="a-typein" x="24" y="40" width="200" height="16"/></clipPath>
    <text x="24" y="52" ${mono} fill="${LILAC}">$</text>
    <text x="36" y="52" ${mono} fill="#e4e4e7" clip-path="url(#term-clip)">bun run test</text>
    <text class="a-slide" style="--d:1.1s" x="24" y="72" ${mono} fill="${GREEN}">✓ credits-refusal  6 passed</text>
    <text class="a-slide" style="--d:1.35s" x="24" y="88" ${mono} fill="${GREEN}">✓ landing         5 passed</text>
    <text class="a-slide" style="--d:1.6s" x="24" y="104" ${mono} fill="${INK}">128 checks passed in 1.4s</text>
    <text x="24" y="122" ${mono} fill="${LILAC}">$</text>
    <rect class="a-blink" x="36" y="113" width="7" height="12" fill="#e4e4e7"/>`)
}

/** Either account behind a chat — a switch, not a setup. */
function accounts(): string {
  return svg(
    `<g class="a-left">
      <rect x="16" y="20" width="118" height="100" rx="14" fill="${PANEL}" stroke="${LINE}"/>
      <circle cx="75" cy="56" r="14" fill="rgb(255 255 255 / 0.12)"/>
      <circle cx="75" cy="52" r="5" fill="${INK}"/><path d="M66 64c3-5 15-5 18 0" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
      <text x="75" y="96" text-anchor="middle" font-size="11" font-family="-apple-system, Segoe UI, sans-serif" fill="${INK}">Your login</text>
    </g>
    <g class="a-right">
      <rect x="186" y="20" width="118" height="100" rx="14" fill="rgb(139 92 246 / 0.10)" stroke="rgb(139 92 246 / 0.45)"/>
      <rect x="231" y="42" width="28" height="28" rx="8" fill="url(#acct-g)"/>
      ${spark(245, 56, 8, "#fff")}
      <text x="245" y="96" text-anchor="middle" font-size="11" font-family="-apple-system, Segoe UI, sans-serif" fill="#e4e4e7">Credits</text>
    </g>
    <rect x="144" y="60" width="32" height="18" rx="9" fill="${PANEL}" stroke="${LINE}"/>
    <circle class="a-switch" cx="153" cy="69" r="6" fill="url(#acct-g)"/>`,
    GRADIENT("acct-g")
  )
}

const SANS = `font-family="-apple-system, Segoe UI, sans-serif"`
const MONO = `font-family="ui-monospace, Menlo, monospace"`

/** Every account in one menu — the chat's pick moving between them. */
function profiles(): string {
  const rows: [string, string, string][] = [
    ["Work", "you@company.com", VIOLET],
    ["Personal", "you@gmail.com", AMBER],
    ["Team", "team@studio.dev", LILAC],
  ]
  const body = rows
    .map(([name, mail, color], i) => {
      const y = 26 + i * 36
      return `<circle cx="44" cy="${y + 12}" r="10" fill="${color}" fill-opacity="0.22" stroke="${color}" stroke-opacity="0.7"/>
        <text x="44" y="${y + 16}" text-anchor="middle" font-size="10" font-weight="600" ${SANS} fill="${color}">${name[0]}</text>
        <text x="64" y="${y + 9}" font-size="11" ${SANS} fill="#e4e4e7">${name}</text>
        <text x="64" y="${y + 22}" font-size="9" ${MONO} fill="${FAINT}">${mail}</text>`
    })
    .join("")
  return svg(`
    <rect x="16" y="14" width="288" height="114" rx="10" fill="${PANEL}" stroke="${LINE}"/>
    <rect class="a-pick" x="22" y="22" width="276" height="32" rx="7" fill="rgb(139 92 246 / 0.14)" stroke="rgb(139 92 246 / 0.45)"/>
    ${body}
    <path class="a-pick" d="M276 34l4 4 8-8" stroke="${LILAC}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`)
}

/** A chat at its limit, moved to another account, carrying on. */
function handoff(): string {
  return svg(`
    <rect x="12" y="8" width="296" height="124" rx="10" fill="${PANEL}" stroke="${LINE}"/>
    <g class="a-out" opacity="0">
      <rect x="196" y="16" width="104" height="20" rx="10" fill="rgb(248 113 113 / 0.12)" stroke="rgb(248 113 113 / 0.5)"/>
      <text x="248" y="29.5" text-anchor="middle" font-size="9.5" ${MONO} fill="${RED}">Work · 5h 100%</text>
    </g>
    <g class="a-in">
      <rect x="196" y="16" width="104" height="20" rx="10" fill="rgb(74 222 128 / 0.12)" stroke="rgb(74 222 128 / 0.5)"/>
      <text x="248" y="29.5" text-anchor="middle" font-size="9.5" ${MONO} fill="${GREEN}">Personal · 5h 8%</text>
    </g>
    <rect x="22" y="18" width="120" height="7" rx="3.5" fill="${FAINT}"/>
    <rect x="128" y="44" width="170" height="16" rx="8" fill="rgb(139 92 246 / 0.30)"/>
    <rect x="22" y="68" width="190" height="5" rx="2.5" fill="${INK}"/>
    <rect x="22" y="79" width="150" height="5" rx="2.5" fill="${INK}"/>
    <g class="a-pop" style="--d:2.4s">
      <path d="M22 98H108M212 98H298" stroke="${LINE}" stroke-dasharray="3 4"/>
      <text x="160" y="101" text-anchor="middle" font-size="9" ${MONO} fill="${FAINT}">context kept</text>
    </g>
    <rect class="a-type" style="--d:2.8s" x="22" y="110" width="176" height="5" rx="2.5" fill="${INK}"/>
    <rect class="a-type" style="--d:3.1s" x="22" y="121" width="120" height="5" rx="2.5" fill="${INK}"/>`)
}

/** One query over every file and every chat, the matches lit where they are. */
function search(): string {
  const label = (y: number, text: string) =>
    `<text x="24" y="${y}" font-size="8" letter-spacing="1.2" ${MONO} fill="${FAINT}">${text}</text>`
  // A result: its name, a line of its text with the match lit, and a count.
  const row = (
    y: number,
    name: string,
    mark: number,
    count: string,
    d: number
  ) =>
    `<g class="a-slide" style="--d:${d}s">
      <text x="24" y="${y + 4}" font-size="10" ${SANS} fill="#e4e4e7">${name}</text>
      <rect x="132" y="${y - 2}" width="130" height="5" rx="2.5" fill="${INK}" fill-opacity="0.6"/>
      <rect class="a-pop" style="--d:${d + 0.25}s" x="${mark}" y="${y - 5}" width="34" height="11" rx="3" fill="rgb(167 139 250 / 0.35)" stroke="${LILAC}" stroke-opacity="0.6"/>
      <text x="294" y="${y + 4}" text-anchor="end" font-size="9" ${MONO} fill="${FAINT}">${count}</text>
    </g>`
  return svg(`
    <rect x="12" y="8" width="296" height="124" rx="10" fill="${PANEL}" stroke="${LINE}"/>
    <rect x="20" y="15" width="280" height="22" rx="6" fill="rgb(0 0 0 / 0.25)" stroke="${LINE}"/>
    <circle cx="32" cy="25.5" r="4" stroke="${INK}" stroke-width="1.6"/><path d="M35 28.5l3 3" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>
    <clipPath id="search-clip"><rect class="a-typein" x="44" y="18" width="56" height="16"/></clipPath>
    <text x="44" y="30" font-size="10.5" ${MONO} fill="#e4e4e7" clip-path="url(#search-clip)">webhook</text>
    <text x="292" y="29.5" text-anchor="end" font-size="9" ${MONO} fill="${FAINT}">Aa  ab  .*</text>
    ${label(52, "FILES")}
    ${row(64, "sepay.post.ts", 150, "3", 1.1)}
    ${row(82, "orders.ts", 196, "1", 1.3)}
    ${label(104, "CHATS")}
    ${row(116, "Add VietQR webhook", 168, "2", 1.5)}`)
}

export const FEATURE_ART = {
  chats,
  diff,
  worktrees,
  modes,
  terminal,
  accounts,
  profiles,
  handoff,
  search,
} as const

export type FeatureArt = keyof typeof FEATURE_ART
