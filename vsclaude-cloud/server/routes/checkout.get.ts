import { defineHandler } from "nitro"

import {
  ARRIVAL_CSS,
  arrivalCard,
  arrivalScript,
} from "../utils/arrival-page.ts"
import { paddleConfig } from "../utils/paddle.ts"

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
export default defineHandler(() => {
  const paddle = paddleConfig()
  const settings = JSON.stringify({
    sandbox: paddle.sandbox,
    token: paddle.clientToken,
  }).replaceAll("<", "\\u003c")

  return new Response(
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>VS Claude — Checkout</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center;
      font: 15px/1.5 system-ui, sans-serif; background: #0b0b0f; color: #e8e8ee; }
    main { max-width: 26rem; padding: 2rem; text-align: center; }
    h1 { font-size: 1.25rem; margin: 0 0 .5rem; }
    p { color: #9a9aa8; margin: 0; }${ARRIVAL_CSS}
  </style>
</head>
<body>
  <main>
    <h1 id="title">Opening checkout…</h1>
    <p id="text">Your payment is handled by Paddle.</p>
  </main>
  ${arrivalCard({
    title: "Credits added",
    note: "They never expire. Head back to VS Claude to keep going.",
    button: "Close",
  })}
  <script src="https://cdn.paddle.com/paddle/v2/paddle.js"></script>
  <script>
    const settings = ${settings}
    const say = (title, text) => {
      document.getElementById("title").textContent = title
      document.getElementById("text").textContent = text
    }
    ${arrivalScript("en-US")}
    // Paddle's webhook credits the purchase a few seconds after the payment,
    // so the page asks until it has — or says where to look if it takes long.
    const waitForCredits = async (txn) => {
      for (let asked = 0; asked < 60; asked++) {
        await new Promise((done) => setTimeout(done, 2000))
        try {
          const answer = await (await fetch("/api/checkout/" + txn)).json()
          if (answer.paid) {
            say("Thank you!", "Your purchase is done. You can close this tab and go back to VS Claude.")
            showArrival(answer.credits)
            return
          }
        } catch {}
      }
      say("Payment received", "Your credits are on their way. VS Claude shows them when they land.")
    }
    if (!settings.token) {
      say("Payments are not set up", "This server has no Paddle client token.")
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
            say("Thank you!", "Adding your credits…")
            const txn = new URLSearchParams(location.search).get("_ptxn")
            if (txn) void waitForCredits(txn)
          } else if (event.name === "checkout.closed") {
            say("Checkout closed", "Nothing was charged. You can close this tab.")
          }
        },
      })
      if (!new URLSearchParams(location.search).has("_ptxn")) {
        say("Nothing to pay for", "Start a purchase from the studio's account menu.")
      }
    }
  </script>
</body>
</html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } }
  )
})
