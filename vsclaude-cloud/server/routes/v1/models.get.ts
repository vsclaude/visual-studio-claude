import { defineHandler } from "nitro"

import { authenticate } from "../../utils/auth.ts"
import { MODELS } from "../../utils/limits.ts"

/**
 * `GET /v1/models` — the models this server offers, in Anthropic's list shape,
 * answered here rather than passed through: Anthropic's list is every model the
 * server's key can reach, most of them priced by nothing here.
 */
export default defineHandler(async (event) => {
  const user = await authenticate(event)
  if (user instanceof Response) return user

  const data = MODELS.map((id) => ({
    type: "model",
    id,
    display_name: id,
    created_at: "1970-01-01T00:00:00Z",
  }))
  return {
    data,
    has_more: false,
    first_id: data[0]?.id ?? null,
    last_id: data.at(-1)?.id ?? null,
  }
})
