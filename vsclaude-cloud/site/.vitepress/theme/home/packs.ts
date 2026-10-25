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
  "vnd-20k": {},
  "vnd-50k": {},
  "vnd-100k": { bonus: 10, popular: true },
  "vnd-200k": { bonus: 20 },
}

const VND = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
})

export { formatCredits }

/** How a pack is paid — the toggle above the packs, as in the studio's
 * dialog: four by transfer, three by card, since the smallest is `bankOnly`. */
export type PaymentMethod = "bank" | "card"

/** lucide's `landmark` and `credit-card`, the icons the dialog's toggle uses. */
export const METHOD_ICON: Record<PaymentMethod, string> = {
  bank: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 22h18M6 18v-7M10 18v-7M14 18v-7M18 18v-7M12 2l8 5H4z"/></svg>',
  card: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/></svg>',
}

/**
 * The gold coin struck with the VS lettermark — the credits dialog's `Coin`
 * in the studio, as markup. `id` keeps each copy's gradients its own: four
 * coins on a page sharing one id would all paint with the first one's.
 */
export function coin(id: string, size: number): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true">
<defs><linearGradient id="${id}-rim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fde68a"/><stop offset="0.5" stop-color="#f59e0b"/><stop offset="1" stop-color="#b45309"/></linearGradient>
<linearGradient id="${id}-face" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fef3c7"/><stop offset="1" stop-color="#fbbf24"/></linearGradient></defs>
<circle cx="32" cy="32" r="30" fill="url(#${id}-rim)"/><circle cx="32" cy="32" r="23" fill="url(#${id}-face)"/>
<circle cx="32" cy="32" r="23" fill="none" stroke="#d97706" stroke-opacity="0.35" stroke-width="1.5"/>
<svg x="20" y="21" width="24" height="22" viewBox="8.85 -0.05 64.5 60.1"><g transform="skewX(-12) translate(10 0)" stroke="#b45309" stroke-opacity="0.85" stroke-width="11" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M5 5L20 55L35 5"/><path d="M61 13C57 6 49 4.5 44 6C36 8.5 36 19 43 24C48 27.5 56 30 60 35C66 43 60 55 49 55C43 55 38 52.5 35 47"/></g></svg>
<path d="M17 24a17 17 0 0 1 12-9" fill="none" stroke="#fff" stroke-opacity="0.7" stroke-width="3" stroke-linecap="round"/>
</svg>`
}

/** The packs as the page draws them, cheapest first — the size in dollars
 * (`$1.00`), as the studio writes it. */
export function packsForSale(method: PaymentMethod = "bank"): {
  id: CreditItem
  price: string
  credits: string
  bonus?: number
  popular: boolean
}[] {
  return (Object.keys(CREDIT_PACKS) as CreditItem[])
    .filter((id) => !CREDIT_PACKS[id].retired)
    .filter((id) => method === "bank" || !CREDIT_PACKS[id].bankOnly)
    .sort((a, b) => CREDIT_PACKS[a].price - CREDIT_PACKS[b].price)
    .map((id) => ({
      id,
      price: VND.format(CREDIT_PACKS[id].price),
      credits: formatCredits(CREDIT_PACKS[id].credits),
      bonus: PACK_EXTRAS[id].bonus,
      popular: PACK_EXTRAS[id].popular === true,
    }))
}
