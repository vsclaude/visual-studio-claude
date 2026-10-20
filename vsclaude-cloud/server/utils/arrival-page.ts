/**
 * The card a payment page shows once the purchase's credits are on the account
 * — the page where the money was paid, not the studio, since that is where
 * somebody is looking when it lands. Shared by `/checkout` (Paddle) and
 * `/pay/<code>` (bank transfer), which poll for it differently and say it in
 * different languages.
 *
 * It is the studio's own celebration (`CreditsArrived` in the app, drawn the
 * same way — a coin landing with smaller ones thrown out, the amount counting
 * up), in plain CSS and SVG so the page needs nothing else.
 *
 * Hidden until `showArrival` is called from the page's own script, so a page
 * opened after the purchase was made shows nothing it did not just see happen.
 */

export const ARRIVAL_CSS = `
    .arrived { position: fixed; inset: 0; z-index: 2147483000; display: grid; place-items: center;
      background: rgba(5, 5, 8, .72); padding: 1rem; }
    .arrived[hidden] { display: none; }
    .arrived .card { width: min(22rem, 100%); overflow: hidden; border-radius: 16px;
      background: #16161d; text-align: center; box-shadow: 0 24px 60px rgba(0, 0, 0, .5);
      animation: arrive .35s ease-out; }
    .arrived .burst { position: relative; height: 11rem; overflow: hidden;
      background: linear-gradient(180deg, rgba(139, 92, 246, .15), rgba(251, 191, 36, .1), transparent); }
    .arrived .halo { position: absolute; left: 50%; top: 50%; width: 9rem; height: 9rem;
      margin: -4.5rem 0 0 -4.5rem; border-radius: 50%;
      background: radial-gradient(circle, rgba(252, 211, 77, .5), rgba(167, 139, 250, .2), transparent 70%);
      filter: blur(6px); animation: halo 1.6s ease-in-out infinite alternate; }
    .arrived .coin { position: absolute; left: 50%; top: 50%; display: block; line-height: 0; }
    .arrived .coin.big { margin: -42px 0 0 -42px; animation: land .7s cubic-bezier(.2, .9, .3, 1.2) both;
      filter: drop-shadow(0 10px 18px rgba(245, 158, 11, .35)); }
    .arrived .coin.small { margin: -10px 0 0 -10px; animation: scatter .9s ease-out both; }
    .arrived .spark { position: absolute; color: #fcd34d; font-size: 14px; line-height: 1;
      animation: twinkle 1.8s ease-in-out infinite; }
    .arrived .body { padding: 1.25rem 1.75rem 1.75rem; }
    .arrived h2 { font-size: 1.1rem; margin: 0; }
    .arrived .amount { margin: .25rem 0 0; font-size: 2.6rem; font-weight: 700; line-height: 1.1;
      font-variant-numeric: tabular-nums; color: transparent;
      background: linear-gradient(90deg, #a78bfa, #fbbf24);
      -webkit-background-clip: text; background-clip: text; }
    .arrived .unit { margin: .15rem 0 0; color: #9a9aa8; font-size: .85rem; }
    .arrived .note { margin: 1.1rem 0 0; font-size: .85rem; color: #9a9aa8; }
    .arrived button { margin-top: 1.25rem; width: 100%; padding: .7rem; border: 0;
      border-radius: 10px; font: inherit; font-weight: 600; color: #fff; cursor: pointer;
      background: linear-gradient(90deg, #8b5cf6, #fbbf24); }
    .arrived button:hover { opacity: .9; }
    @keyframes arrive { from { opacity: 0; transform: translateY(8px) scale(.98); } }
    @keyframes halo { from { opacity: .6; transform: scale(.92); } to { opacity: 1; transform: scale(1.06); } }
    @keyframes land { from { transform: translateY(-70px) scale(.6); opacity: 0; }
      60% { opacity: 1; } to { transform: none; opacity: 1; } }
    @keyframes scatter { from { transform: translate(0, 0) scale(.3); opacity: 0; }
      to { transform: translate(var(--x), var(--y)) scale(1); opacity: 1; } }
    @keyframes twinkle { 0%, 100% { opacity: .3; transform: scale(.8); } 50% { opacity: 1; transform: scale(1.1); } }
    @media (prefers-reduced-motion: reduce) {
      .arrived .card, .arrived .halo, .arrived .coin, .arrived .spark { animation: none; } }`

/** A gold coin, as the studio draws it (`Coin` in `credits-dialog.tsx`). */
function coin(size: number, big: boolean, id: string): string {
  const star = big
    ? `<path d="M32 19l3.6 8.2 8.9.8-6.7 5.9 2 8.7L32 38.1l-7.8 4.5 2-8.7-6.7-5.9 8.9-.8z" fill="#d97706" fill-opacity=".85"/>`
    : ""
  return `<svg width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true">
    <defs>
      <linearGradient id="${id}-rim" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#fde68a"/><stop offset=".5" stop-color="#f59e0b"/><stop offset="1" stop-color="#b45309"/>
      </linearGradient>
      <linearGradient id="${id}-face" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fef3c7"/><stop offset="1" stop-color="#fbbf24"/>
      </linearGradient>
    </defs>
    <circle cx="32" cy="32" r="30" fill="url(#${id}-rim)"/>
    <circle cx="32" cy="32" r="23" fill="url(#${id}-face)"/>
    <circle cx="32" cy="32" r="23" fill="none" stroke="#d97706" stroke-opacity=".35" stroke-width="1.5"/>
    ${star}
    <path d="M17 24a17 17 0 0 1 12-9" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="3" stroke-linecap="round"/>
  </svg>`
}

/** Where the small coins land around the big one, and when — as the app's. */
const SCATTER = [
  { x: -78, y: -18, size: 22, delay: 140 },
  { x: 74, y: -26, size: 18, delay: 200 },
  { x: -58, y: 34, size: 16, delay: 260 },
  { x: 64, y: 30, size: 20, delay: 180 },
  { x: -18, y: -52, size: 14, delay: 320 },
  { x: 30, y: 50, size: 12, delay: 380 },
]

/** The sparkles' places, as the app's. */
const SPARKS = [
  { left: "18%", top: "22%", delay: 0 },
  { left: "80%", top: "18%", delay: 600 },
  { left: "12%", top: "70%", delay: 1100 },
  { left: "86%", top: "66%", delay: 300 },
  { left: "50%", top: "8%", delay: 900 },
]

/** The markup, with `copy` written in the page's own language. */
export function arrivalCard(copy: {
  title: string
  note: string
  button: string
}): string {
  const scatter = SCATTER.map(
    (c, i) =>
      `<span class="coin small" style="--x:${c.x}px;--y:${c.y}px;animation-delay:${c.delay}ms">${coin(c.size, false, `coin-s${i}`)}</span>`
  ).join("")
  const sparks = SPARKS.map(
    (s) =>
      `<span class="spark" style="left:${s.left};top:${s.top};animation-delay:${s.delay}ms">✦</span>`
  ).join("")
  return `<div id="arrived" class="arrived" hidden>
    <div class="card" role="dialog" aria-live="polite">
      <div class="burst">
        <div class="halo"></div>
        ${sparks}
        ${scatter}
        <span class="coin big">${coin(84, true, "coin-big")}</span>
      </div>
      <div class="body">
        <h2>${copy.title}</h2>
        <p class="amount" id="arrived-amount">+0</p>
        <p class="unit">credits</p>
        <p class="note">${copy.note}</p>
        <button type="button" id="arrived-close">${copy.button}</button>
      </div>
    </div>
  </div>`
}

/**
 * The script half: `showArrival(credits)` shows the card and counts the amount
 * up from zero over most of a second — straight to it when motion is reduced.
 * `locale` is how the number is grouped: `vi-VN` reads 1.000.000.
 */
export function arrivalScript(locale: string): string {
  return `const arrived = document.getElementById("arrived")
      const arrivedAmount = document.getElementById("arrived-amount")
      document.getElementById("arrived-close").onclick = () => { arrived.hidden = true }
      const showArrival = (credits) => {
        arrived.hidden = false
        const format = (value) => "+" + value.toLocaleString(${JSON.stringify(locale)})
        if (credits <= 0 || matchMedia("(prefers-reduced-motion: reduce)").matches) {
          arrivedAmount.textContent = format(credits)
          return
        }
        const started = performance.now()
        const step = (now) => {
          const t = Math.min(1, (now - started) / 900)
          // Ease out: most of the number at once, the last digits settling.
          arrivedAmount.textContent = format(Math.round(credits * (1 - Math.pow(1 - t, 3))))
          if (t < 1) requestAnimationFrame(step)
        }
        requestAnimationFrame(step)
      }`
}
