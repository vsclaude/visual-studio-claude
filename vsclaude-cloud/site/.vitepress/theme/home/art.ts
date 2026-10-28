/**
 * The home page's illustrations, one per feature — inline SVG, so they are
 * part of the page and take its own CSS.
 *
 * Every one is drawn in its **finished** state, and the motion is keyframes
 * that start from somewhere else and arrive there (`home.css`'s `.a-*`
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
const SANS = `font-family="-apple-system, Segoe UI, sans-serif"`
const MONO = `font-family="ui-monospace, Menlo, monospace"`

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

/** The chats column: one that needs you, two working, one finished unread —
 * the sections the app sorts a project's chats into. */
function chats(): string {
  const label = (y: number, text: string, d: number) =>
    `<text class="a-slide" style="--d:${d}s" x="26" y="${y}" font-size="8" letter-spacing="1.2" ${MONO} fill="${FAINT}">${text}</text>`
  const row = (y: number, title: string, mark: string, d: number, on = false) =>
    `<g class="a-slide" style="--d:${d}s">
      ${on ? `<rect x="20" y="${y - 11}" width="280" height="18" rx="5" fill="rgb(139 92 246 / 0.14)"/>` : ""}
      <text x="28" y="${y + 2}" font-size="10.5" ${SANS} fill="#e4e4e7">${title}</text>
      ${mark}
    </g>`
  const spinner = (y: number) =>
    `<circle cx="290" cy="${y - 2}" r="4" stroke="${FAINT}" stroke-width="1.6"/><path class="a-spin" style="transform-origin:290px ${y - 2}px" d="M290 ${y - 6}a4 4 0 0 1 4 4" stroke="${AMBER}" stroke-width="1.6" stroke-linecap="round"/>`
  const shield = (y: number) =>
    `<path class="a-pop" style="--d:.5s" d="M290 ${y - 8}l5 2v4c0 3.4-2.2 5.4-5 6.6-2.8-1.2-5-3.2-5-6.6v-4z" fill="rgb(251 191 36 / 0.2)" stroke="${AMBER}" stroke-width="1.3"/>`
  return svg(`
    <rect x="12" y="8" width="296" height="124" rx="10" fill="${PANEL}" stroke="${LINE}"/>
    ${label(24, "NEEDS YOU", 0)}
    ${row(40, "Run the migration?", shield(40), 0.15, true)}
    ${label(62, "RUNNING", 0.3)}
    ${row(78, "Add VietQR webhook", spinner(78), 0.45)}
    ${row(96, "Fix rounding in totals", spinner(96), 0.6)}
    ${label(116, "RECENT", 0.75)}
    <g class="a-slide" style="--d:.9s">
      <text x="28" y="128" font-size="10.5" font-weight="600" ${SANS} fill="#e4e4e7">Dark mode for settings</text>
      <circle class="a-pop" style="--d:1.4s" cx="290" cy="125" r="3.2" fill="${VIOLET}"/>
    </g>`)
}

/** A diff landing line by line, a message drafted for it, and the commit. */
function diff(): string {
  const rows: [string, number, string][] = [
    [FAINT, 100, ""],
    [RED, 80, "rgb(248 113 113 / 0.12)"],
    [GREEN, 110, "rgb(74 222 128 / 0.12)"],
    [GREEN, 92, "rgb(74 222 128 / 0.12)"],
    [GREEN, 116, "rgb(74 222 128 / 0.12)"],
    [FAINT, 66, ""],
  ]
  const body = rows
    .map(([color, width, wash], i) => {
      const y = 24 + i * 17
      const sign = color === GREEN ? "+" : color === RED ? "−" : ""
      return `<g class="a-slide" style="--d:${(i * 0.15).toFixed(2)}s">
        ${wash ? `<rect x="18" y="${y - 6}" width="146" height="14" rx="3" fill="${wash}"/>` : ""}
        <text x="24" y="${y + 4}" font-size="10" ${MONO} fill="${color}">${sign}</text>
        <rect x="36" y="${y - 2}" width="${width}" height="5" rx="2.5" fill="${color}" fill-opacity="${color === FAINT ? 1 : 0.75}"/>
      </g>`
    })
    .join("")
  const file = (y: number, name: string, mark: string, color: string) =>
    `<text x="186" y="${y}" font-size="9.5" ${MONO} fill="#e4e4e7">${name}</text><text x="298" y="${y}" text-anchor="end" font-size="9.5" font-weight="600" ${MONO} fill="${color}">${mark}</text>`
  const commit = `
    <rect x="176" y="8" width="132" height="124" rx="10" fill="${PANEL}" stroke="${LINE}"/>
    <text x="186" y="25" font-size="8" letter-spacing="1.2" ${MONO} fill="${FAINT}">CHANGES · 2</text>
    ${file(42, "sepay.post.ts", "M", AMBER)}
    ${file(57, "sepay.test.ts", "U", GREEN)}
    <rect x="184" y="68" width="116" height="30" rx="5" fill="rgb(0 0 0 / 0.25)" stroke="${LINE}"/>
    <rect class="a-type" style="--d:.9s" x="190" y="76" width="96" height="4.5" rx="2.25" fill="${INK}"/>
    <rect class="a-type" style="--d:1.1s" x="190" y="86" width="70" height="4.5" rx="2.25" fill="${INK}"/>
    <g class="a-pop" style="--d:.7s">
      <rect x="184" y="106" width="48" height="18" rx="5" fill="${PANEL}" stroke="${LINE}"/>
      ${spark(194, 115, 4.5, AMBER)}
      <text x="203" y="118.5" font-size="9" ${SANS} fill="${INK}">Draft</text>
    </g>
    <g class="a-pop" style="--d:1.5s">
      <rect x="238" y="106" width="62" height="18" rx="5" fill="url(#diff-g)"/>
      <text x="269" y="118.5" text-anchor="middle" font-size="9.5" font-weight="600" ${SANS} fill="#fff">Commit</text>
    </g>`
  return svg(
    `<rect x="12" y="8" width="158" height="124" rx="10" fill="${PANEL}" stroke="${LINE}"/>${body}${commit}`,
    GRADIENT("diff-g")
  )
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
    <text class="a-slide" style="--d:1.1s" x="24" y="72" ${mono} fill="${GREEN}">✓ license          6 passed</text>
    <text class="a-slide" style="--d:1.35s" x="24" y="88" ${mono} fill="${GREEN}">✓ landing         5 passed</text>
    <text class="a-slide" style="--d:1.6s" x="24" y="104" ${mono} fill="${INK}">128 checks passed in 1.4s</text>
    <text x="24" y="122" ${mono} fill="${LILAC}">$</text>
    <rect class="a-blink" x="36" y="113" width="7" height="12" fill="#e4e4e7"/>`)
}

/** The Accounts list under the chats: every account's 5-hour and weekly
 * meters at once — which one still has room. */
function profiles(): string {
  const rows: [string, string, number, number][] = [
    ["Work", VIOLET, 1, 0.62],
    ["Personal", AMBER, 0.08, 0.3],
    ["Team", LILAC, 0.45, 0.7],
  ]
  const meter = (y: number, label: string, share: number, d: number) => {
    const color = share >= 1 ? RED : share > 0.8 ? AMBER : GREEN
    return `<text x="226" y="${y + 3}" text-anchor="end" font-size="8" ${MONO} fill="${FAINT}">${label}</text>
      <rect x="232" y="${y - 1.5}" width="62" height="4" rx="2" fill="rgb(255 255 255 / 0.08)"/>
      <rect class="a-type" style="--d:${d}s" x="232" y="${y - 1.5}" width="${Math.max(3, 62 * share)}" height="4" rx="2" fill="${color}"/>`
  }
  const body = rows
    .map(([name, color, five, week], i) => {
      const y = 46 + i * 24
      const d = 0.2 + i * 0.2
      return `<g class="a-slide" style="--d:${(d - 0.15).toFixed(2)}s">
        <circle cx="34" cy="${y}" r="8" fill="${color}" fill-opacity="0.22" stroke="${color}" stroke-opacity="0.7"/>
        <text x="34" y="${y + 3.5}" text-anchor="middle" font-size="9" font-weight="600" ${SANS} fill="${color}">${name[0]}</text>
        <text x="50" y="${y + 3.5}" font-size="10.5" ${SANS} fill="#e4e4e7">${name}</text>
      </g>
      ${meter(y - 4, "5h", five, d)}
      ${meter(y + 5, "w", week, d + 0.1)}`
    })
    .join("")
  return svg(
    `<rect x="12" y="8" width="296" height="124" rx="10" fill="${PANEL}" stroke="${LINE}"/>
    <text x="24" y="25" font-size="8" letter-spacing="1.2" ${MONO} fill="${FAINT}">ACCOUNTS</text>
    <g class="a-pop" style="--d:1.2s"><rect x="280" y="14" width="16" height="16" rx="4" fill="${PANEL}" stroke="${LINE}"/><path d="M288 18.5v7M284.5 22h7" stroke="${INK}" stroke-width="1.5" stroke-linecap="round"/></g>
    ${body}
    <text class="a-slide" style="--d:.8s" x="24" y="122" font-size="8.5" ${MONO} fill="${FAINT}">Free · every Claude account</text>`
  )
}

/** A chat its limit stopped, and the one click that carries it on: the card's
 * `Continue with …` moves it to an account with room, transcript and all. */
function handoff(): string {
  return svg(
    `<rect x="12" y="8" width="296" height="124" rx="10" fill="${PANEL}" stroke="${LINE}"/>
    <rect x="22" y="16" width="276" height="62" rx="8" fill="rgb(255 255 255 / 0.03)" stroke="${LINE}"/>
    <text x="32" y="33" font-size="10.5" ${SANS} fill="#e4e4e7">Add VietQR webhook</text>
    <g class="a-out" opacity="0">
      <text x="32" y="47" font-size="9" ${MONO} fill="${AMBER}">Work · 5-hour limit · resets in 2h 14m</text>
      <rect x="32" y="54" width="132" height="18" rx="5" fill="url(#hand-g)"/>
      <text x="98" y="66.5" text-anchor="middle" font-size="9.5" font-weight="600" ${SANS} fill="#fff">Continue with Personal</text>
    </g>
    <g class="a-in">
      <text x="32" y="47" font-size="9" ${MONO} fill="${GREEN}">Personal · 5h 8%</text>
      <rect x="32" y="54" width="104" height="18" rx="9" fill="rgb(74 222 128 / 0.12)" stroke="rgb(74 222 128 / 0.5)"/>
      <circle cx="44" cy="63" r="3.5" stroke="${FAINT}" stroke-width="1.4"/><path class="a-spin" style="transform-origin:44px 63px" d="M44 59.5a3.5 3.5 0 0 1 3.5 3.5" stroke="${GREEN}" stroke-width="1.4" stroke-linecap="round"/>
      <text x="54" y="66.5" font-size="9.5" ${SANS} fill="${GREEN}">Carrying on…</text>
    </g>
    <path class="a-cursor" opacity="0" d="M140 62v14l3.6-3.4 2.6 5.6 2.4-1.1-2.6-5.5 4.9-.3z" fill="#fff" stroke="#0b0b0f" stroke-width="1"/>
    <g class="a-pop" style="--d:2.4s">
      <path d="M22 90H90M230 90H298" stroke="${LINE}" stroke-dasharray="3 4"/>
      <text x="160" y="93" text-anchor="middle" font-size="9" ${MONO} fill="${FAINT}">Work → Personal · context kept</text>
    </g>
    <rect class="a-type" style="--d:2.7s" x="22" y="104" width="196" height="5" rx="2.5" fill="${INK}"/>
    <rect class="a-type" style="--d:3s" x="22" y="116" width="140" height="5" rx="2.5" fill="${INK}"/>`,
    GRADIENT("hand-g")
  )
}

/** Vey Pro, bought once — the Pro dialog's card. */
function pro(): string {
  const line = (y: number, text: string, d: number) =>
    `<g class="a-slide" style="--d:${d}s">
      <path d="M40 ${y - 3}l3 3 6-6" stroke="${LILAC}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="56" y="${y + 1}" font-size="10" ${SANS} fill="#e4e4e7">${text}</text>
    </g>`
  return svg(
    `<rect x="16" y="10" width="288" height="120" rx="10" fill="${PANEL}" stroke="${LINE}"/>
    <g class="a-pop" style="--d:.1s">
      <rect x="30" y="22" width="22" height="22" rx="6" fill="url(#pro-g)"/>
      <path d="M35 38h12l1.5-9-4.5 4-3-5-3 5-4.5-4z" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>
    </g>
    <text x="62" y="32" font-size="11.5" font-weight="600" ${SANS} fill="#e4e4e7">Vey Pro</text>
    <text x="62" y="44" font-size="8.5" ${MONO} fill="${AMBER}">Every project · bought once</text>
    <text x="292" y="38" text-anchor="end" font-size="10" ${MONO} fill="${FAINT}">from 99.000 ₫</text>
    ${line(70, "As many projects as you work on", 0.4)}
    ${line(88, "Worktrees, search and tabs across them", 0.6)}
    ${line(106, "No subscription, no renewal", 0.8)}`,
    GRADIENT("pro-g")
  )
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

/** A message edited, and the files its turns wrote going back with it. */
function rewind(): string {
  const file = (y: number, name: string, d: number) =>
    `<g class="a-slide" style="--d:${d}s">
      <text x="186" y="${y + 4}" font-size="10" ${MONO} fill="#e4e4e7">${name}</text>
      <g class="a-pop" style="--d:${d + 0.3}s"><rect x="252" y="${y - 7}" width="48" height="15" rx="7.5" fill="rgb(74 222 128 / 0.14)"/><text x="276" y="${y + 3.5}" text-anchor="middle" font-size="9" ${MONO} fill="${GREEN}">↺ back</text></g>
    </g>`
  return svg(`
    <rect x="12" y="8" width="150" height="124" rx="10" fill="${PANEL}" stroke="${LINE}"/>
    <rect x="70" y="18" width="80" height="14" rx="7" fill="rgb(139 92 246 / 0.35)"/>
    <rect x="22" y="40" width="110" height="5" rx="2.5" fill="${INK}"/>
    <rect x="22" y="51" width="84" height="5" rx="2.5" fill="${INK}"/>
    <rect class="a-pop" style="--d:.2s" x="54" y="66" width="96" height="16" rx="8" fill="rgb(139 92 246 / 0.35)" stroke="${LILAC}" stroke-width="1.4"/>
    <g class="a-pop" style="--d:.45s"><rect x="20" y="66" width="28" height="16" rx="8" fill="rgb(0 0 0 / 0.3)" stroke="${LINE}"/><path d="M29 77.5l1-3.4 5.6-5.6 2.4 2.4-5.6 5.6z" stroke="${LILAC}" stroke-width="1.3" stroke-linejoin="round"/></g>
    <g opacity="0.35">
      <rect x="22" y="92" width="104" height="5" rx="2.5" fill="${FAINT}"/>
      <rect x="22" y="103" width="76" height="5" rx="2.5" fill="${FAINT}"/>
      <rect x="22" y="114" width="92" height="5" rx="2.5" fill="${FAINT}"/>
    </g>
    <path class="a-draw" style="--d:.6s" pathLength="1" d="M176 112C164 112 164 74 152 74" stroke="${AMBER}" stroke-width="2" stroke-linecap="round"/>
    <path class="a-pop" style="--d:1.1s" d="M157 70l-5 4 5 4" stroke="${AMBER}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="176" y="8" width="132" height="124" rx="10" fill="${PANEL}" stroke="${LINE}"/>
    <text x="186" y="27" font-size="9" ${SANS} fill="${FAINT}" letter-spacing="0.08em">FILES</text>
    ${file(50, "orders.ts", 0.9)}
    ${file(76, "sepay.ts", 1.1)}
    ${file(102, "totals.ts", 1.3)}`)
}

export const FEATURE_ART = {
  chats,
  diff,
  rewind,
  modes,
  terminal,
  pro,
  profiles,
  handoff,
  search,
} as const

export type FeatureArt = keyof typeof FEATURE_ART
