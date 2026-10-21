import { defineHandler } from "nitro"

import { arrivalCard, arrivalScript } from "../utils/arrival-page.ts"
import { paddleConfig } from "../utils/paddle.ts"
import { html, htmlResponse, json, raw } from "../utils/html.ts"
import { paymentDocument } from "../utils/payment-page.ts"

/**
 * `GET /checkout` — the page Paddle's **default payment link** points at
 * (Paddle › Checkout › Checkout configuration), on this server's own domain,
 * which Paddle has to have approved.
 *
 * It is Paddle.js, plus one thing: once Paddle says the payment went through,
 * the page waits for the webhook to credit the purchase (`/api/checkout/<txn>`)
 * and then says how many credits it added, here, where the money was paid.
 *
 * The link `POST /api/checkout` answers with is this page plus
 * `?_ptxn=<transaction>`, and Paddle.js opens that transaction's checkout on
 * its own when it sees the parameter. Paddle also sends people here to update
 * a card, which needs nothing more.
 *
 * The client token is public by design — it can open a checkout and nothing
 * else.
 */

/**
 * The card's icon follows `data-state` on it: `busy` spins, `done` is a check,
 * `idle` (closed, nothing to pay for, not set up) is a plain dot — so the page
 * reads at a glance from behind Paddle's overlay as it closes.
 */
const CHECKOUT_CSS = `
  .panel.center { text-align: center; padding: 2.25rem 1.75rem 2rem; }
  .state { position: relative; width: 3.25rem; height: 3.25rem; margin: 0 auto 1.1rem; border-radius: 50%;
    display: grid; place-items: center; border: 1px solid var(--edge-strong); background: rgb(255 255 255 / 0.03); }
  .state > * { grid-area: 1 / 1; display: none; }
  .state .spinner { width: 1.4rem; height: 1.4rem; border-radius: 50%; border: 2px solid rgb(139 92 246 / 0.25);
    border-top-color: var(--accent); animation: spin 0.8s linear infinite; }
  .state .check { width: 1.4rem; height: 1.4rem; color: var(--ok); }
  .state .idle { width: 0.55rem; height: 0.55rem; border-radius: 50%; background: var(--muted); }
  [data-state="busy"] .state .spinner { display: block; }
  [data-state="done"] .state { border-color: rgb(134 239 172 / 0.35); background: rgb(134 239 172 / 0.08); }
  [data-state="done"] .state .check { display: block; }
  [data-state="idle"] .state .idle { display: block; }
  @media (prefers-reduced-motion: reduce) { .state .spinner { animation-duration: 2.4s; } }`

export default defineHandler(() => {
  const paddle = paddleConfig()
  const settings = json({
    sandbox: paddle.sandbox,
    token: paddle.clientToken,
  })

  return htmlResponse(
    paymentDocument({
      lang: "en",
      title: "VS Claude — Checkout",
      secure: "Secure checkout",
      css: CHECKOUT_CSS,
      narrow: true,
      main: html`<section class="panel center" id="card" data-state="busy">
          <div class="state" aria-hidden="true">
            <span class="spinner"></span>
            <svg
              class="check"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
            <span class="idle"></span>
          </div>
          <h1 id="title">Opening checkout…</h1>
          <p id="text" class="lede" role="status">
            Your payment is handled by Paddle.
          </p>
        </section>
        ${raw(
          arrivalCard({
            title: "Credits added",
            note: "They never expire. Head back to VS Claude to keep going.",
            button: "Close",
          })
        )}`,
      foot: "Payments are processed by Paddle, our merchant of record.",
      scripts: html`<script src="https://cdn.paddle.com/paddle/v2/paddle.js"></script>
        <script>
          const settings = ${settings}
          const card = document.getElementById("card")
          const say = (title, text, state) => {
            document.getElementById("title").textContent = title
            document.getElementById("text").textContent = text
            card.dataset.state = state
          }
          ${raw(arrivalScript("en-US"))}
          // Paddle's webhook credits the purchase a few seconds after the payment,
          // so the page asks until it has — or says where to look if it takes long.
          const waitForCredits = async (txn) => {
            for (let asked = 0; asked < 60; asked++) {
              await new Promise((done) => setTimeout(done, 2000))
              try {
                const answer = await (
                  await fetch("/api/checkout/" + txn)
                ).json()
                if (answer.paid) {
                  say(
                    "Thank you!",
                    "Your purchase is done. You can close this tab and go back to VS Claude.",
                    "done"
                  )
                  showArrival(answer.credits)
                  return
                }
              } catch {}
            }
            say(
              "Payment received",
              "Your credits are on their way. VS Claude shows them when they land.",
              "done"
            )
          }
          if (!settings.token) {
            say(
              "Payments are not set up",
              "This server has no Paddle client token.",
              "idle"
            )
          } else {
            if (settings.sandbox) Paddle.Environment.set("sandbox")
            Paddle.Initialize({
              token: settings.token,
              // The email is the signed-in account's, prefilled by the transaction's
              // customer, so the checkout does not offer to change it.
              checkout: { settings: { allowLogout: false } },
              eventCallback(event) {
                if (event.name === "checkout.completed") {
                  // Paddle's own overlay sits over this page with its success screen,
                  // which would hide the credits card. This page says the outcome now.
                  Paddle.Checkout?.close?.()
                  say("Thank you!", "Adding your credits…", "busy")
                  const txn = new URLSearchParams(location.search).get("_ptxn")
                  if (txn) void waitForCredits(txn)
                } else if (event.name === "checkout.closed") {
                  say(
                    "Checkout closed",
                    "Nothing was charged. You can close this tab.",
                    "idle"
                  )
                }
              },
            })
            if (!new URLSearchParams(location.search).has("_ptxn")) {
              say(
                "Nothing to pay for",
                "Start a purchase from the studio's account menu.",
                "idle"
              )
            }
          }
        </script>`,
    })
  )
})
