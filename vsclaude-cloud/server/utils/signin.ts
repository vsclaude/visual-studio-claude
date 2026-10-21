import { database } from "./database.ts"
import { html, raw, type SafeHtml } from "./html.ts"
import { paymentDocument } from "./payment-page.ts"

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

const GOOGLE_MARK = `<svg viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
      </svg>`

/**
 * Drawn in the payment pages' shell (`payment-page.ts`) — the landing's
 * palette, the mark and the wordmark at the top — so signing in looks like the
 * product somebody is signing in to. One card, like `/checkout`'s: a badge for
 * the outcome, a title, a line under it.
 */
const SIGN_IN_CSS = `
  .panel.center { text-align: center; padding: 2.25rem 1.75rem 2rem; }
  .badge { width: 3.25rem; height: 3.25rem; margin: 0 auto 1.1rem; border-radius: 50%;
    display: grid; place-items: center; border: 1px solid var(--edge-strong); background: rgb(255 255 255 / 0.03); }
  .badge svg { width: 1.4rem; height: 1.4rem; }
  .badge.ok { border-color: rgb(134 239 172 / 0.35); background: rgb(134 239 172 / 0.08); color: var(--ok); }
  .badge.warn { border-color: rgb(252 211 77 / 0.35); background: rgb(252 211 77 / 0.08); color: var(--warn); }
  .panel .status { text-align: left; }
  .google { display: flex; align-items: center; justify-content: center; gap: 0.65rem; margin-top: 1.5rem;
    padding: 0.7rem 1rem; border-radius: 10px; background: #fff; color: #1f1f1f;
    font-weight: 500; text-decoration: none; }
  .google:hover { background: #ececf0; }
  .google svg { width: 18px; height: 18px; }
  .other { display: inline-block; margin-top: 0.9rem; color: var(--muted); font-size: 0.82rem; }
  .other:hover { color: var(--ink); }`

const CHECK = raw(
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`
)

const ALERT = raw(
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M12 7v6"/><path d="M12 17h.01"/></svg>`
)

function cardOf(view: SignInView): SafeHtml {
  if (view.kind === "done") {
    return html`<section class="panel center">
      <div class="badge ok">${CHECK}</div>
      <h1>You're signed in</h1>
      <p class="lede">Head back to VS Claude. You can close this tab.</p>
    </section>`
  }
  if (view.kind === "failed") {
    return html`<section class="panel center">
      <div class="badge warn">${ALERT}</div>
      <h1>Sign-in did not finish</h1>
      <p class="status warn" role="status">
        <span class="dot"></span><span>${view.reason}</span>
      </p>
      <p class="lede">Close this tab and try again from VS Claude.</p>
    </section>`
  }
  // Links rather than a script: the whole flow is Google's redirect, and a
  // page with nothing to run has nothing to break.
  return html`<section class="panel center">
    <h1>Sign in to VS Claude</h1>
    <p class="lede">Use the Google account you signed up with.</p>
    <a class="google" href="${view.google}"
      >${raw(GOOGLE_MARK)}Continue with Google</a
    >
    <a class="other" href="${view.chooseAccount}">Use a different account</a>
  </section>`
}

/** The page the browser sees, before Google and after it. */
export function signInPage(view: SignInView): string {
  return paymentDocument({
    lang: "en",
    title: "VS Claude — Sign in",
    secure: "Secure sign-in",
    css: SIGN_IN_CSS,
    narrow: true,
    main: cardOf(view),
    foot: "Sign-in is handled by Google. VS Claude never sees your password.",
  }).value
}
