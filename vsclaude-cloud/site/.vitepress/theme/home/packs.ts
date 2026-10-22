import {
  CREDIT_PACKS,
  type CreditItem,
} from "../../../../server/utils/billing.ts"
import { formatCredits } from "../../../../server/utils/usage.ts"

/**
 * **The prices are `CREDIT_PACKS`'**, the table the checkout charges from, so
 * the home page cannot advertise a price `/api/orders` will not ask. The page
 * is built rather than drawn per request now, so it says what the table said
 * at the last `bun run build` — which every deploy runs. What the server's
 * table does not carry — the bonus each pack is sold with and which one is
 * steered toward — is `PACK_EXTRAS` below, and it must say what the studio's
 * own dialog says (`src/shared/credits.ts` in the app).
 */

const PACK_EXTRAS: Record<CreditItem, { bonus?: number; popular?: boolean }> = {
  "credits-mini": {},
  "credits-20k": {},
  "credits-60k": { bonus: 10, popular: true },
  "credits-100k": { bonus: 20 },
}

const VND = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
})

export { formatCredits }

/** The packs as the page draws them, cheapest first — the size in dollars
 * (`$1.00`), as the studio writes it. */
export function packsForSale(): {
  id: CreditItem
  price: string
  credits: string
  bonus?: number
  popular: boolean
  bankOnly: boolean
}[] {
  return (Object.keys(CREDIT_PACKS) as CreditItem[])
    .sort((a, b) => CREDIT_PACKS[a].price - CREDIT_PACKS[b].price)
    .map((id) => ({
      id,
      price: VND.format(CREDIT_PACKS[id].price),
      credits: formatCredits(CREDIT_PACKS[id].credits),
      bonus: PACK_EXTRAS[id].bonus,
      popular: PACK_EXTRAS[id].popular === true,
      bankOnly: CREDIT_PACKS[id].bankOnly === true,
    }))
}
