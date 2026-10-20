import { APP_MARK, APP_MARK_URL } from "./brand.ts"
import { database } from "./database.ts"

/**
 * Google sign-in for the studio, which cannot run Google's own flow.
 *
 * Google refuses OAuth from an embedded browser, and the built studio is
 * `app://studio`, which no OAuth client can name as a redirect — so the flow
 * cannot run in a window of the app at all. Instead the studio opens
 * `/signin/<nonce>` here in the user's own browser, that page sends it to
 * Google (`google.ts`) with the nonce as `state`, Google sends it back to
 * `/signin/callback`, and that leaves a session token of this server's own
 * (`session.ts`) under the nonce. The studio asks `GET /api/signin/<nonce>`
 * until it is there.
 *
 * This replaced a server the studio ran on `localhost` for each attempt: a
 * port opened on the user's machine, and a page that had to ship inside the
 * app. Then Firebase's popup on this page, which left a Google token for the
 * studio to hand to Firebase — replaced so that who somebody is lives in this
 * server's D1 beside what they paid, rather than in a second service.
 *
 * The nonce is the whole of the protection: whoever knows it can read the
 * answer. It is 24 random bytes the studio drew, in the URL of one browser tab,
 * Google's `state` and the studio's memory, and nowhere else.
 */

/** 24 bytes, base64url — what the studio draws (`main/google-sign-in.ts`). */
const NONCE = /^[A-Za-z0-9_-]{32}$/

export function isNonce(value: string): boolean {
  return NONCE.test(value)
}

/**
 * How long an answer waits to be collected — the studio's own timeout. The
 * studio asks every second or two, so in practice an answer is gone within
 * one; this bounds a token nobody came back for.
 */
const ANSWER_TTL_S = 5 * 60

/** What the studio collects: its session token, or the reason there is none. */
export type Answer = { token: string } | { error: string }

/**
 * Under `sign_ins` in the D1 database (`database.ts`): one row per attempt,
 * its token or its error, and when it stops being collectable.
 */

/** Keeps the attempt's answer; false when it already has one, so a second
 * callback for the same nonce cannot replace the first. A row past its time is
 * nobody's answer any more, so it is replaced. */
export async function saveAnswer(
  nonce: string,
  answer: Answer
): Promise<boolean> {
  const db = await database()
  const now = Date.now()
  const token = "token" in answer ? answer.token : null
  const error = "error" in answer ? answer.error : null
  const { rows = [] } =
    await db.sql`INSERT INTO sign_ins (nonce, token, error, expires_at) VALUES (${nonce}, ${token}, ${error}, ${now + ANSWER_TTL_S * 1000}) ON CONFLICT (nonce) DO UPDATE SET token = excluded.token, error = excluded.error, expires_at = excluded.expires_at WHERE sign_ins.expires_at <= ${now} RETURNING nonce`
  return rows.length === 1
}

/**
 * The attempt's answer, removed as it is read, or null while there is none.
 *
 * The delete and the read are one statement, so two collectors cannot both
 * take the same answer.
 */
export async function takeAnswer(nonce: string): Promise<Answer | null> {
  const db = await database()
  const { rows = [] } =
    await db.sql`DELETE FROM sign_ins WHERE nonce = ${nonce} RETURNING token, error, expires_at`
  const row = rows[0]
  if (!row || Number(row.expires_at) <= Date.now()) return null
  if (typeof row.token === "string") return { token: row.token }
  if (typeof row.error === "string") return { error: row.error }
  return null
}

/** What the page shows: the way in, the way out, or why it did not work. */
export type SignInView =
  | { kind: "start"; google: string; chooseAccount: string }
  | { kind: "done" }
  | { kind: "failed"; reason: string }

const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!
  )

const GOOGLE_MARK = `<svg viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
      </svg>`

const DONE_ART = `<svg viewBox="0 0 240 150" fill="none" aria-hidden="true">
      <circle cx="120" cy="75" r="64" fill="#34A853" fill-opacity="0.08"/>
      <circle cx="120" cy="75" r="31" stroke="#34A853" stroke-opacity="0.25" stroke-width="2"/>
      <path d="M50 22 L53.5 31.5 L63 35 L53.5 38.5 L50 48 L46.5 38.5 L37 35 L46.5 31.5Z" fill="#8B5CF6"/>
      <path d="M196 18 L198 23.5 L203.5 25.5 L198 27.5 L196 33 L194 27.5 L188.5 25.5 L194 23.5Z" fill="#FBBF24"/>
      <circle cx="176" cy="124" r="3" fill="#F0956A" fill-opacity="0.6"/>
      <circle cx="62" cy="122" r="2.5" fill="#8B5CF6" fill-opacity="0.6"/>
      <path d="M86 75 H98 M142 75 H154" stroke="#71717a" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="2 6"/>
      <defs><linearGradient id="vsc-done" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6D28D9"/><stop offset="0.5" stop-color="#C76BC4"/><stop offset="1" stop-color="#FCC63A"/></linearGradient></defs>
      <rect x="22" y="46" width="62" height="58" rx="16" fill="url(#vsc-done)"/>
      <polyline points="44,68 34,75 44,82" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      <polyline points="62,68 72,75 62,82" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="120" cy="75" r="22" fill="#34A853"/>
      <path d="M110.5 75.5 L117 82 L130 68.5" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="186" cy="70" r="16" fill="#F0956A"/>
      <circle cx="186" cy="65" r="5.5" fill="#fff"/>
      <path d="M177 85 Q186 75 195 85 Z" fill="#fff"/>
    </svg>`

function bodyOf(view: SignInView): string {
  if (view.kind === "done") {
    return `<section id="done">
    ${DONE_ART}
    <h1>You're signed in</h1>
    <p class="lede">Head back to VS Claude. You can close this tab.</p>
  </section>`
  }
  if (view.kind === "failed") {
    return `<div id="intro">
    ${APP_MARK}
    <h1>Sign-in did not finish</h1>
    <p id="status">${escape(view.reason)}</p>
    <p class="lede">Close this tab and try again from VS Claude.</p>
  </div>`
  }
  // Links rather than a script: the whole flow is Google's redirect, and a
  // page with nothing to run has nothing to break.
  return `<div id="intro">
    ${APP_MARK}
    <h1>Sign in to VS Claude</h1>
    <p class="lede">Use the Google account you signed up with.</p>
    <p id="status">Continue to sign in with Google.</p>
    <a class="button" href="${escape(view.google)}">
      ${GOOGLE_MARK}
      Continue with Google
    </a>
    <a class="link" href="${escape(view.chooseAccount)}">Use a different account</a>
  </div>`
}

/** The page the browser sees, before Google and after it. */
export function signInPage(view: SignInView): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="referrer" content="no-referrer" />
<title>VS Claude — sign in</title>
<link rel="icon" href="${APP_MARK_URL}" />
<style>
  :root {
    color-scheme: light dark;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    --page: #f4f4f5;
    --card: #ffffff;
    --edge: #e4e4e7;
    --ink: #18181b;
    --muted: #71717a;
    --button: #ffffff;
    --button-hover: #f4f4f5;
    --button-edge: #d4d4d8;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --page: #1b1c1f;
      --card: #26282c;
      --edge: #3a3d43;
      --ink: #f4f4f5;
      --muted: #a1a1aa;
      --button: #2e3035;
      --button-hover: #383b41;
      --button-edge: #4a4d54;
    }
  }
  body {
    margin: 0;
    min-height: 100vh;
    display: grid;
    place-items: center;
    background: var(--page);
    color: var(--ink);
  }
  .card {
    width: min(23rem, 90vw);
    padding: 2.25rem 2rem 2rem;
    border: 1px solid var(--edge);
    border-radius: 14px;
    background: var(--card);
    text-align: center;
    box-shadow: 0 10px 32px rgb(0 0 0 / 0.12);
  }
  #intro > svg {
    display: block;
    width: 3.5rem;
    height: 3.5rem;
    margin: 0 auto 1rem;
  }
  #done svg {
    display: block;
    width: min(15rem, 100%);
    height: auto;
    margin: 0 auto 1.25rem;
  }
  #done h1 {
    margin-bottom: 0.35rem;
  }
  #done .lede {
    margin-bottom: 0;
  }
  h1 {
    margin: 0 0 0.35rem;
    font-size: 1.05rem;
    font-weight: 600;
  }
  .lede {
    margin: 0 0 1.5rem;
    font-size: 0.8rem;
    color: var(--muted);
  }
  #status {
    min-height: 2.6em;
    margin: 0 0 1.25rem;
    font-size: 0.875rem;
    line-height: 1.5;
    color: var(--muted);
  }
  .button {
    display: inline-flex;
    align-items: center;
    gap: 0.65rem;
    padding: 0.6rem 1.1rem;
    border: 1px solid var(--button-edge);
    border-radius: 8px;
    background: var(--button);
    color: var(--ink);
    font-size: 0.9rem;
    font-weight: 500;
    text-decoration: none;
  }
  .button:hover {
    background: var(--button-hover);
  }
  .button svg {
    width: 18px;
    height: 18px;
  }
  .link {
    display: block;
    margin: 0.9rem auto 0;
    color: var(--muted);
    font-size: 0.8rem;
  }
  .link:hover {
    color: var(--ink);
  }
</style>
</head>
<body>
<main class="card">
  ${bodyOf(view)}
</main>
</body>
</html>
`
}
