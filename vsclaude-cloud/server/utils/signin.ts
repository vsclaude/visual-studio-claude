import { APP_MARK, APP_MARK_URL } from "./brand.ts"
import { database } from "./database.ts"

/**
 * Google sign-in for the studio, which cannot run Google's own flow.
 *
 * Firebase's popup needs an origin on the project's authorized domains, and the
 * built studio is `app://studio`, which is not one. Google also refuses OAuth
 * from an embedded browser, so the flow cannot run in a window of the app at
 * all. Instead the studio opens `/signin/<nonce>` here in the user's own
 * browser, that page runs the ordinary popup and posts the Google ID token to
 * `POST /api/signin/<nonce>`, and the studio asks `GET /api/signin/<nonce>`
 * until it is there.
 *
 * This replaced a server the studio ran on `localhost` for each attempt: a
 * port opened on the user's machine, and a page that had to ship inside the
 * app. **This server's domain has to be on the Firebase project's authorized
 * domains** (Authentication › Settings) or the popup refuses to open —
 * `localhost` is on it by default, which is what keeps `bun run dev` working.
 *
 * The nonce is the whole of the protection: whoever knows it can post an
 * answer, and whoever knows it can read one. It is 24 random bytes the studio
 * drew, in the URL of one browser tab and the studio's memory, and nowhere
 * else.
 */

/** 24 bytes, base64url — what the studio draws (`main/google-sign-in.ts`). */
const NONCE = /^[A-Za-z0-9_-]{32}$/

export function isNonce(value: string): boolean {
  return NONCE.test(value)
}

/** A token is about 1 KB. Anything much bigger is not from our page. */
export const MAX_ANSWER_BYTES = 16 * 1024

/**
 * How long an answer waits to be collected — the studio's own timeout. The
 * studio asks every second or two, so in practice an answer is gone within
 * one; this bounds a token nobody came back for.
 */
const ANSWER_TTL_S = 5 * 60

/** What the page posts and the studio collects: the Google ID token, or the
 * reason there is none. */
export type Answer = { idToken: string } | { error: string }

/** An answer as the page posted it, or null for anything that is not one. */
export function parseAnswer(body: string): Answer | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return null
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return null
  }
  const { idToken, error } = parsed as Record<string, unknown>
  if (typeof idToken === "string" && idToken.length > 0) return { idToken }
  if (idToken === undefined && typeof error === "string") return { error }
  return null
}

/**
 * Under `sign_ins` in the D1 database (`database.ts`): one row per attempt,
 * its ID token or its error, and when it stops being collectable.
 */

/** Keeps the attempt's answer; false when it already has one, so a second
 * post to the same nonce cannot replace the first. A row past its time is
 * nobody's answer any more, so it is replaced. */
export async function saveAnswer(
  nonce: string,
  answer: Answer
): Promise<boolean> {
  const db = await database()
  const now = Date.now()
  const idToken = "idToken" in answer ? answer.idToken : null
  const error = "error" in answer ? answer.error : null
  const { rows = [] } =
    await db.sql`INSERT INTO sign_ins (nonce, id_token, error, expires_at) VALUES (${nonce}, ${idToken}, ${error}, ${now + ANSWER_TTL_S * 1000}) ON CONFLICT (nonce) DO UPDATE SET id_token = excluded.id_token, error = excluded.error, expires_at = excluded.expires_at WHERE sign_ins.expires_at <= ${now} RETURNING nonce`
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
    await db.sql`DELETE FROM sign_ins WHERE nonce = ${nonce} RETURNING id_token, error, expires_at`
  const row = rows[0]
  if (!row || Number(row.expires_at) <= Date.now()) return null
  if (typeof row.id_token === "string") return { idToken: row.id_token }
  if (typeof row.error === "string") return { error: row.error }
  return null
}

/**
 * The project the studio signs in to — a copy of `FIREBASE_CONFIG` in the
 * app's `src/shared/firebase.ts`. Not a secret: a Web app's config is shipped
 * to every browser that loads it. Change both together.
 */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBzXBIKcX4_ZUDGinPNMnvv3z1H9jLwvnA",
  authDomain: "simm-chat.firebaseapp.com",
  projectId: "simm-chat",
  storageBucket: "simm-chat.firebasestorage.app",
  messagingSenderId: "935344658250",
  appId: "1:935344658250:web:9a1324c3113f3a341953b3",
  measurementId: "G-1ZFC8DPRV0",
}

/** The Firebase JS SDK the page loads from Google's CDN — the version the
 * app's `firebase` dependency resolves (`FIREBASE_SDK_VERSION` there), so the
 * page and the studio agree about the protocol. Bump both together. */
const FIREBASE_SDK_VERSION = "13.0.0"

/**
 * The page the browser loads. It runs Firebase's own popup and posts the
 * result to `/api/signin/<nonce>`, reading the nonce off its own path.
 */
export function signInPage(): string {
  const sdk = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}`
  // The config is trusted, but a `<` in a string could still close the script.
  const config = JSON.stringify(FIREBASE_CONFIG).replace(/</g, "\\u003c")
  const favicon = APP_MARK_URL

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="referrer" content="no-referrer" />
<title>VS Claude — sign in</title>
<link rel="icon" href="${favicon}" />
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
  /* The button's own display rule would otherwise win over the hidden attribute. */
  [hidden] {
    display: none !important;
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
  button {
    display: inline-flex;
    align-items: center;
    gap: 0.65rem;
    padding: 0.6rem 1.1rem;
    border: 1px solid var(--button-edge);
    border-radius: 8px;
    background: var(--button);
    color: var(--ink);
    font: inherit;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
  }
  button:hover:not(:disabled) {
    background: var(--button-hover);
  }
  button:disabled {
    opacity: 0.6;
    cursor: default;
  }
  button svg {
    width: 18px;
    height: 18px;
  }
  button.link {
    display: block;
    margin: 0.9rem auto 0;
    padding: 0;
    border: 0;
    background: none;
    color: var(--muted);
    font-size: 0.8rem;
    text-decoration: underline;
  }
  button.link:hover:not(:disabled) {
    background: none;
    color: var(--ink);
  }
</style>
</head>
<body>
<main class="card">
  <div id="intro">
    ${APP_MARK}
    <h1>Sign in to VS Claude</h1>
    <p class="lede">Use the Google account you signed up with.</p>
    <p id="status">Continue to sign in with Google.</p>
    <button id="continue" type="button">
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
      </svg>
      Continue with Google
    </button>
    <button id="other" class="link" type="button">Use a different account</button>
  </div>
  <section id="done" hidden>
    <svg viewBox="0 0 240 150" fill="none" aria-hidden="true">
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
    </svg>
    <h1>You're signed in</h1>
    <p class="lede">Head back to VS Claude. You can close this tab.</p>
  </section>
</main>
<script type="module">
import { initializeApp } from "${sdk}/firebase-app.js"
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
} from "${sdk}/firebase-auth.js"

const intro = document.getElementById("intro")
const done = document.getElementById("done")
const status = document.getElementById("status")
const button = document.getElementById("continue")
const other = document.getElementById("other")
const nonce = location.pathname.split("/").pop()
const post = (answer) =>
  fetch("/api/signin/" + encodeURIComponent(nonce), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(answer),
  })

// The popup has to open inside the click. A browser blocks one opened on page
// load with no gesture behind it (auth/popup-blocked), which is why this page
// waits for the button rather than starting the flow itself.
const auth = getAuth(initializeApp(${config}))

// No \`prompt\` by default: somebody already signed in to Google with one
// account, who has said yes to this app before, gets a popup that closes on
// its own — signing in again is one click, not an account picker every time.
// Google still shows the picker when the browser has several accounts.
// The link is for choosing another one on purpose.
async function signIn(chooseAccount) {
  button.disabled = true
  other.disabled = true
  status.textContent = "Waiting for Google…"
  const provider = new GoogleAuthProvider()
  if (chooseAccount) provider.setCustomParameters({ prompt: "select_account" })
  try {
    const result = await signInWithPopup(auth, provider)
    const { idToken } = GoogleAuthProvider.credentialFromResult(result)
    const response = await post({ idToken })
    if (!response.ok) throw new Error("This sign-in was already answered.")
    // Gone rather than disabled: a button that is still there invites a second
    // press on a page that has nothing left to do.
    intro.hidden = true
    done.hidden = false
  } catch (error) {
    // The attempt takes one answer, so a retry on this page would reach
    // nothing. The button goes and the tab says to start again from the app.
    await post({ error: String(error?.message ?? error) }).catch(() => {})
    button.hidden = true
    other.hidden = true
    status.textContent =
      "Sign-in did not finish. Close this tab and try again from VS Claude."
  }
}

button.addEventListener("click", () => signIn(false))
other.addEventListener("click", () => signIn(true))
</script>
</body>
</html>
`
}
