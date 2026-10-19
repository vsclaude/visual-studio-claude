import { defineHandler } from "nitro"

import { landingPage } from "../utils/landing.ts"
import { langOf } from "../utils/landing-copy.ts"

/**
 * `GET /` — the home page (`server/utils/landing.ts`). A route of its own
 * rather than Nitro's `index.html` renderer, which answers **every** path no
 * route claims: a typo in a URL would have been the home page with a 200
 * instead of a 404.
 */
export default defineHandler(
  (event) =>
    // `?lang=vi` for Vietnamese; anything else, or nothing, is English.
    new Response(landingPage(langOf(event.url.searchParams.get("lang"))), {
      headers: {
        "content-type": "text/html; charset=utf-8",
        // Prices change with a deploy, not by the minute.
        "cache-control": "public, max-age=300",
      },
    })
)
